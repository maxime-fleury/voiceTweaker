class FFT {
  constructor(n) {
    this.n = n;
    this.levels = Math.round(Math.log2(n));
    this.cosT = new Float32Array(n / 2);
    this.sinT = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cosT[i] = Math.cos((2 * Math.PI * i) / n);
      this.sinT[i] = Math.sin((2 * Math.PI * i) / n);
    }
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0, x = i;
      for (let j = 0; j < this.levels; j++) {
        r = (r << 1) | (x & 1);
        x >>= 1;
      }
      this.rev[i] = r;
    }
  }

  transform(re, im, inverse = false) {
    const n = this.n, rev = this.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const c = this.cosT[k];
          const s = inverse ? this.sinT[k] : -this.sinT[k];
          const tre = re[j + half] * c - im[j + half] * s;
          const tim = re[j + half] * s + im[j + half] * c;
          re[j + half] = re[j] - tre;
          im[j + half] = im[j] - tim;
          re[j] += tre;
          im[j] += tim;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) {
        re[i] /= n;
        im[i] /= n;
      }
    }
  }
}

const N = 1024;
const HOP = 256;
const QC = 48;

class FormantProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [];
  }

  constructor(options) {
    super();
    this.fft = new FFT(N);
    this.win = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
    }

    this.inBuf = new Float32Array(N);
    this.inW = 0;
    this.sinceHop = 0;

    this.outBuf = new Float32Array(1 << 14);
    this.accBuf = new Float32Array(1 << 14);
    this.mask = (1 << 14) - 1;
    this.outW = 0;
    this.outR = 0;

    this.re = new Float32Array(N);
    this.im = new Float32Array(N);
    this.cepRe = new Float32Array(N);
    this.cepIm = new Float32Array(N);
    this.envLog = new Float32Array(N);
    this.gainLog = new Float32Array(N / 2 + 1);

    this.alpha = 1;
    const po = options && options.processorOptions;
    if (po && typeof po.alpha === 'number') this.alpha = po.alpha;
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.alpha === 'number') this.alpha = e.data.alpha;
    };
  }

  processFrame() {
    const { fft, win, inBuf } = this;
    const re = this.re, im = this.im;
    for (let i = 0; i < N; i++) {
      re[i] = inBuf[(this.inW + i) % N] * win[i];
      im[i] = 0;
    }

    fft.transform(re, im, false);

    const cepRe = this.cepRe, cepIm = this.cepIm;
    for (let k = 0; k < N; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      cepRe[k] = Math.log(mag + 1e-10);
      cepIm[k] = 0;
    }
    fft.transform(cepRe, cepIm, true);

    for (let q = QC + 1; q <= N / 2; q++) {
      cepRe[q] = 0;
      cepRe[N - q] = 0;
    }
    fft.transform(cepRe, cepIm, false);

    const envLog = this.envLog;
    for (let k = 0; k < N; k++) envLog[k] = cepRe[k];

    const alpha = this.alpha;
    const gainLog = this.gainLog;
    for (let k = 0; k <= N / 2; k++) {
      const src = k / alpha;
      const i0 = Math.floor(src);
      const frac = src - i0;
      const a = envLog[Math.min(i0, N / 2)];
      const b = envLog[Math.min(i0 + 1, N / 2)];
      const shifted = a + (b - a) * frac;
      gainLog[k] = shifted - envLog[k];
    }
    // lissage de la courbe de gain (7 bins) : réduit les artefacts métalliques
    const W = 3;
    let logMean = 0;
    for (let k = 0; k <= N / 2; k++) {
      let s = 0, c = 0;
      for (let j = k - W; j <= k + W; j++) {
        if (j >= 0 && j <= N / 2) { s += gainLog[j]; c++; }
      }
      const lg = s / c;
      const g = Math.exp(lg);
      re[k] *= g;
      im[k] *= g;
      if (k > 0 && k < N / 2) {
        re[N - k] *= g;
        im[N - k] *= g;
      }
      logMean += lg;
    }
    logMean /= N / 2 + 1;
    const norm = Math.exp(-logMean);
    for (let k = 0; k < N; k++) {
      re[k] *= norm;
    }

    fft.transform(re, im, true);

    for (let i = 0; i < N; i++) {
      const idx = (this.outW + i) & this.mask;
      this.outBuf[idx] += re[i] * win[i];
      this.accBuf[idx] += win[i];
    }
    this.outW = (this.outW + HOP) & this.mask;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const out = output[0];

    const bypass = Math.abs(this.alpha - 1) < 0.005;

    if (bypass) {
      if (input && input[0]) out.set(input[0].subarray(0, out.length));
      else out.fill(0);
      return true;
    }

    if (input && input[0]) {
      const inp = input[0];
      for (let i = 0; i < inp.length; i++) {
        this.inBuf[this.inW] = inp[i];
        this.inW = (this.inW + 1) % N;
        this.sinceHop++;
        if (this.sinceHop >= HOP) {
          this.sinceHop = 0;
          this.processFrame();
        }
      }
    }

    for (let i = 0; i < out.length; i++) {
      const idx = this.outR & this.mask;
      const acc = this.accBuf[idx];
      out[i] = acc > 0.05 ? this.outBuf[idx] / acc : 0;
      this.outBuf[idx] = 0;
      this.accBuf[idx] = 0;
      this.outR = (this.outR + 1) & this.mask;
    }
    return true;
  }
}

registerProcessor('formant-processor', FormantProcessor);
