class VoiceProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [];
  }

  constructor(options) {
    super();
    const TAPS = 4;
    this.taps = TAPS;
    this.n = 1 << 16;
    this.mask = this.n - 1;
    this.buf = new Float32Array(this.n);
    this.w = 0;
    this.phases = new Float32Array(TAPS);
    for (let i = 0; i < TAPS; i++) this.phases[i] = i / TAPS;

    this.env = 0;
    this.gateGain = 0;
    this.fastEnv = 0;
    this.slowEnv = 0;
    this.trScale = 1;
    this.ringPhase = 0;
    this.vibrPhase = 0;
    this.driftPhase1 = Math.random() * 2 * Math.PI;
    this.driftPhase2 = Math.random() * 2 * Math.PI;
    this.noiseHpX = 0;
    this.noiseHpY = 0;

    this.meterCount = 0;
    this.meterAcc = 0;

    this.p = {
      pitch: 0,
      grain: 85,
      gateDb: -90,
      ring: 0,
      ringFreq: 50,
      vibrDepth: 0,
      vibrRate: 5,
      humanize: 0,
      breath: 0,
      transients: 0,
    };
    const po = options && options.processorOptions;
    if (po) {
      for (const k of Object.keys(this.p)) {
        if (typeof po[k] === 'number') this.p[k] = po[k];
      }
    }
    this.port.onmessage = (e) => {
      if (e.data) Object.assign(this.p, e.data);
    };
  }

  read(d) {
    const a = this.w - 1 - d;
    const i0 = Math.floor(a);
    const t = a - i0;
    const j0 = i0 & this.mask;
    const j1 = (i0 + 1) & this.mask;
    return this.buf[j0] * (1 - t) + this.buf[j1] * t;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const out = output[0];
    if (!input || !input[0]) {
      out.fill(0);
      return true;
    }
    const inp = input[0];
    const sr = sampleRate;
    const TWO_PI = 2 * Math.PI;

    const semis = this.p.pitch;
    const vibrCents = this.p.vibrDepth * 0.6;
    const driftCents = this.p.humanize * 0.25;
    const bypass =
      Math.abs(semis) < 0.005 && vibrCents === 0 && driftCents === 0;
    const baseRatio = Math.pow(2, semis / 12);
    const G = Math.max(256, Math.round((sr * this.p.grain) / 1000));

    const vibrInc = (TWO_PI * this.p.vibrRate) / sr;
    const driftInc1 = (TWO_PI * 0.83) / sr;
    const driftInc2 = (TWO_PI * 1.97) / sr;
    const breathAmt = Math.min(1, Math.max(0, this.p.breath)) / 100;

    const thr = Math.pow(10, this.p.gateDb / 20);
    const relCo = Math.exp(-1 / (sr * 0.06));
    const gateSmooth = 1 - Math.exp(-1 / (sr * 0.004));

    const tAmt = Math.min(100, Math.max(0, this.p.transients)) / 100;
    const trThresh = 1.6 + tAmt * 1.4;
    const fAtt = Math.exp(-1 / (sr * 0.001));
    const fRel = Math.exp(-1 / (sr * 0.03));
    const sCo = 1 - Math.exp(-1 / (sr * 0.12));
    const trAtt = 1 - Math.exp(-1 / (sr * 0.004));
    const trRel = 1 - Math.exp(-1 / (sr * 0.06));

    const ringAmt = Math.min(1, Math.max(0, this.p.ring));
    const ringInc = (TWO_PI * this.p.ringFreq) / sr;

    let ratio = baseRatio;
    let acc = 0;

    for (let i = 0; i < out.length; i++) {
      if ((i & 31) === 0) {
        const vibr = vibrCents * Math.sin(this.vibrPhase);
        const drift =
          driftCents *
          (0.6 * Math.sin(this.driftPhase1) + 0.4 * Math.sin(this.driftPhase2));
        ratio = baseRatio * Math.pow(2, (vibr + drift) / 1200);
      }
      this.vibrPhase += vibrInc;
      if (this.vibrPhase > TWO_PI) this.vibrPhase -= TWO_PI;
      this.driftPhase1 += driftInc1;
      if (this.driftPhase1 > TWO_PI) this.driftPhase1 -= TWO_PI;
      this.driftPhase2 += driftInc2;
      if (this.driftPhase2 > TWO_PI) this.driftPhase2 -= TWO_PI;

      let x = inp[i];

      const ax = x < 0 ? -x : x;
      this.env = ax > this.env ? ax : this.env * relCo;
      const target = this.env > thr ? 1 : 0;
      this.gateGain += (target - this.gateGain) * gateSmooth;
      x *= this.gateGain;

      if (tAmt > 0) {
        this.fastEnv = ax > this.fastEnv ? ax : this.fastEnv * fRel;
        this.slowEnv += (ax - this.slowEnv) * sCo;
        const trig = this.fastEnv > this.slowEnv * trThresh && this.fastEnv > 1e-4;
        const tTarget = trig ? 0 : 1;
        const co = tTarget < this.trScale ? trAtt : trRel;
        this.trScale += (tTarget - this.trScale) * co;
      } else {
        this.trScale = 1;
      }

      this.buf[this.w] = x;
      this.w = (this.w + 1) & this.mask;

      let y;
      if (bypass) {
        y = x;
      } else {
        const delta = ((1 - ratio) / G) * this.trScale;
        y = 0;
        for (let t = 0; t < this.taps; t++) {
          let p = this.phases[t] + delta;
          if (p >= 1) p -= 1;
          else if (p < 0) p += 1;
          this.phases[t] = p;
          const win = 0.5 - 0.5 * Math.cos(TWO_PI * p);
          y += win * this.read(p * G);
        }
        y *= 0.5;
      }

      if (breathAmt > 0 && this.gateGain > 0.01) {
        const nz = Math.random() * 2 - 1;
        this.noiseHpY = 0.995 * (this.noiseHpY + nz - this.noiseHpX);
        this.noiseHpX = nz;
        y += this.noiseHpY * this.env * breathAmt * 0.7;
      }

      if (ringAmt > 0) {
        this.ringPhase += ringInc;
        if (this.ringPhase > TWO_PI) this.ringPhase -= TWO_PI;
        y = y * ((1 - ringAmt) + ringAmt * Math.sin(this.ringPhase));
      }

      out[i] = y;
      acc += y * y;
    }

    this.meterAcc += acc;
    this.meterCount += out.length;
    if (this.meterCount >= 1024) {
      const rms = Math.sqrt(this.meterAcc / this.meterCount);
      this.port.postMessage({ type: 'meter', rms });
      this.meterAcc = 0;
      this.meterCount = 0;
    }
    return true;
  }
}

registerProcessor('voice-processor', VoiceProcessor);
