/* Dé-esser split-band : compresse la bande sibilante (~6 kHz+) dès qu'elle
   dépasse un seuil dépendant du réglage. amount 0..100. */
class DeesserProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const po = (options && options.processorOptions) || {};
    this.amount = typeof po.amount === 'number' ? Math.min(100, Math.max(0, po.amount)) : 30;

    // biquad HP Butterworth Q=0.707 @ 6 kHz (RBJ)
    const f0 = 6000;
    const w0 = (2 * Math.PI * f0) / sampleRate;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const alphaQ = sw / (2 * 0.707);
    const a0 = 1 + alphaQ;
    this.b0 = ((1 + cw) / 2) / a0;
    this.b1 = (-(1 + cw)) / a0;
    this.b2 = ((1 + cw) / 2) / a0;
    this.a1 = (-2 * cw) / a0;
    this.a2 = (1 - alphaQ) / a0;
    this.x1 = 0; this.x2 = 0;
    this.y1 = 0; this.y2 = 0;

    this.env = 0;
    this.gain = 1;
    const relCo = Math.exp(-1 / (sampleRate * 0.005));
    this.relCo = relCo;
    this.smooth = 1 - Math.exp(-1 / (sampleRate * 0.002));

    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.amount === 'number') {
        this.amount = Math.min(100, Math.max(0, e.data.amount));
      }
    };
  }

  process(inputs, outputs) {
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;
    const inp = inputs[0] && inputs[0][0];
    if (!inp) {
      out.fill(0);
      return true;
    }

    // seuil fixe sur l'enveloppe crête de la bande HP ; amount pilote la
    // réduction maximale (0 % = off, 100 % = jusqu'à ~-16 dB)
    const thr = 0.04;
    const floorG = 1 - (this.amount / 100) * 0.85;

    for (let i = 0; i < out.length; i++) {
      const x = inp[i];
      const y =
        this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 -
        this.a1 * this.y1 - this.a2 * this.y2;
      this.x2 = this.x1; this.x1 = x;
      this.y2 = this.y1; this.y1 = y;

      const ax = y < 0 ? -y : y;
      this.env = ax > this.env ? ax : this.env * this.relCo;

      let target = 1;
      if (this.amount > 0 && this.env > thr) {
        target = Math.max(floorG, thr / this.env);
      }
      this.gain += (target - this.gain) * this.smooth;

      // broadband : le gain mesuré sur la bande HP atténue tout le signal
      // (la reconstitution LP + g*HP est trahie par le déphasage du filtre)
      out[i] = x * this.gain;
    }
    return true;
  }
}

registerProcessor('deesser-processor', DeesserProcessor);
