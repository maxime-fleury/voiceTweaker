/* Mode « Qualité max » : pitch shifter par vocoder phase-locked.
   Principe : décalage temporel STFT (N=2048, verrouillage de phase par régions
   de pics) écrit à positions espacées de HOP*R (étirement R), puis lecture du
   flux étiré à vitesse R -> durée réelle, hauteur x R.
   Bypass = copie exacte. Entrée/sortie mono 48 kHz. */

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

const N = 2048;
const HOP = 512;
const HALF = N / 2;
const TWO_PI = 2 * Math.PI;

function princarg(x) {
  return x - TWO_PI * Math.round(x / TWO_PI);
}

class PitchVocoder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const po = (options && options.processorOptions) || {};
    this.enabled = !!po.enabled;
    this.p = {
      pitch: typeof po.pitch === 'number' ? po.pitch : 0,
      vibrDepth: typeof po.vibrDepth === 'number' ? po.vibrDepth : 0,
      vibrRate: typeof po.vibrRate === 'number' ? po.vibrRate : 5,
      humanize: typeof po.humanize === 'number' ? po.humanize : 0,
    };

    this.fft = new FFT(N);
    this.win = new Float32Array(N);
    for (let i = 0; i < N; i++) this.win[i] = 0.5 - 0.5 * Math.cos((TWO_PI * i) / N);

    this.inRing = new Float32Array(1 << 13);
    this.inMask = (1 << 13) - 1;
    this.inW = 0;
    this.frameCount = 0;

    this.re = new Float32Array(N);
    this.im = new Float32Array(N);
    this.mag = new Float32Array(HALF + 1);
    this.ph = new Float32Array(HALF + 1);
    this.prevAn = new Float32Array(HALF + 1);
    this.prevSyn = new Float32Array(HALF + 1);
    this.delta = new Float32Array(HALF + 1);
    this.wHop = new Float32Array(HALF + 1);
    for (let k = 0; k <= HALF; k++) this.wHop[k] = (TWO_PI * HOP * k) / N;

    // OLA du flux étiré : positions monotones, tout ce qui est < emitPos est fini
    this.olaBuf = new Float32Array(1 << 16);
    this.olaMask = (1 << 16) - 1;
    this.emitPos = 0;

    // flux étiré émis + pointeur de lecture
    this.sBuf = new Float32Array(1 << 17);
    this.sMask = (1 << 17) - 1;
    this.sW = 0;
    this.rp = 0;
    this.started = false;
    this.lastOut = 0;

    this.vibrPhase = 0;
    this.driftPhase1 = Math.random() * TWO_PI;
    this.driftPhase2 = Math.random() * TWO_PI;

    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (typeof d.enabled === 'boolean') {
        if (!d.enabled && d.enabled !== this.enabled) this.resetStream();
        this.enabled = d.enabled;
      }
      if (typeof d.pitch === 'number') this.p.pitch = d.pitch;
      if (typeof d.vibrDepth === 'number') this.p.vibrDepth = d.vibrDepth;
      if (typeof d.vibrRate === 'number') this.p.vibrRate = d.vibrRate;
      if (typeof d.humanize === 'number') this.p.humanize = d.humanize;
    };
  }

  resetStream() {
    this.rp = this.sW;
    this.started = false;
    this.olaBuf.fill(0);
    this.prevSyn.fill(0);
  }

  ratioAt(vibrSin, driftVal) {
    const cents =
      this.p.pitch * 100 +
      this.p.vibrDepth * 0.6 * vibrSin +
      this.p.humanize * 0.25 * driftVal;
    return Math.pow(2, cents / 1200);
  }

  processFrame(frameEnd, R) {
    const re = this.re;
    const base = frameEnd - N;
    for (let i = 0; i < N; i++) re[i] = this.inRing[(base + i) & this.inMask] * this.win[i];
    const im = this.im;
    im.fill(0);

    this.fft.transform(re, im, false);

    const mag = this.mag, ph = this.ph;
    for (let k = 0; k <= HALF; k++) {
      mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      ph[k] = Math.atan2(im[k], re[k]);
    }

    // pics spectraux et deltas de phase verrouillés par région
    const peaks = [];
    for (let k = 1; k < HALF; k++) {
      if (mag[k] > mag[k - 1] && mag[k] >= mag[k + 1]) peaks.push(k);
    }
    if (!peaks.length) peaks.push(0);
    const delta = this.delta;
    for (const kp of peaks) {
      delta[kp] = R * (this.wHop[kp] + princarg(ph[kp] - this.prevAn[kp] - this.wHop[kp]));
    }
    let pi = 0;
    for (let k = 0; k <= HALF; k++) {
      while (pi < peaks.length - 1 && k > (peaks[pi] + peaks[pi + 1]) >> 1) pi++;
      const kp = peaks[pi];
      if (kp !== k) delta[k] = delta[kp];
    }

    // synthèse avec phases verrouillées
    const prevSyn = this.prevSyn;
    for (let k = 0; k <= HALF; k++) {
      prevSyn[k] = princarg(prevSyn[k] + delta[k]);
      re[k] = mag[k] * Math.cos(prevSyn[k]);
      im[k] = mag[k] * Math.sin(prevSyn[k]);
      if (k > 0 && k < HALF) {
        re[N - k] = re[k];
        im[N - k] = -im[k];
      }
    }

    this.fft.transform(re, im, true);

    // écriture de la trame à la position étirée P = frameCount*HOP*R
    const P = this.frameCount * HOP * R;
    const ip = Math.floor(P);
    const fr = P - ip;
    const ola = this.olaBuf, win = this.win;
    for (let i = 0; i < N; i++) {
      const v = re[i] * win[i];
      ola[(ip + i) & this.olaMask] += v * (1 - fr);
      ola[(ip + i + 1) & this.olaMask] += v * fr;
    }

    // émission de tout ce qui est finalisé (positions < P)
    while (this.emitPos < ip) {
      this.sBuf[this.sW & this.sMask] = this.olaBuf[this.emitPos & this.olaMask];
      this.olaBuf[this.emitPos & this.olaMask] = 0;
      this.sW++;
      this.emitPos++;
    }

    this.prevAn.set(ph);
  }

  process(inputs, outputs) {
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;
    const inp = inputs[0] && inputs[0][0];
    if (!inp) {
      out.fill(0);
      return true;
    }

    if (!this.enabled) {
      out.set(inp.subarray(0, out.length));
      return true;
    }

    for (let i = 0; i < inp.length; i++) {
      this.inRing[this.inW & this.inMask] = inp[i];
      this.inW++;
    }
    while (this.inW >= N + this.frameCount * HOP) {
      const R = this.ratioAt(
        Math.sin(this.vibrPhase),
        0.6 * Math.sin(this.driftPhase1) + 0.4 * Math.sin(this.driftPhase2)
      );
      this.processFrame(N + this.frameCount * HOP, R);
      this.frameCount++;
    }

    // avance des phases de modulation
    const sr = sampleRate;
    const vibrInc = (TWO_PI * this.p.vibrRate) / sr;
    const dInc1 = (TWO_PI * 0.83) / sr;
    const dInc2 = (TWO_PI * 1.97) / sr;
    for (let i = 0; i < out.length; i++) {
      this.vibrPhase += vibrInc;
      if (this.vibrPhase > TWO_PI) this.vibrPhase -= TWO_PI;
      this.driftPhase1 += dInc1;
      if (this.driftPhase1 > TWO_PI) this.driftPhase1 -= TWO_PI;
      this.driftPhase2 += dInc2;
      if (this.driftPhase2 > TWO_PI) this.driftPhase2 -= TWO_PI;
    }

    // lecture du flux étiré au rythme R
    const R = this.ratioAt(
      Math.sin(this.vibrPhase),
      0.6 * Math.sin(this.driftPhase1) + 0.4 * Math.sin(this.driftPhase2)
    );
    const sMask = this.sMask;
    for (let i = 0; i < out.length; i++) {
      const avail = this.sW - this.rp;
      if (!this.started) {
        if (avail >= N) this.started = true;
        else { out[i] = 0; continue; }
      }
      if (avail > 1 << 16) this.rp = this.sW - (1 << 15); // resync sécurité
      const pos = this.rp | 0;
      if (pos + 1 >= this.sW) {
        out[i] = this.lastOut;
        continue;
      }
      const frac = this.rp - pos;
      const a = this.sBuf[pos & sMask];
      const b = this.sBuf[(pos + 1) & sMask];
      const v = a + (b - a) * frac;
      this.rp += R;
      this.lastOut = v;
      out[i] = v;
    }
    return true;
  }
}

registerProcessor('pitch-vocoder', PitchVocoder);
