class ChunkPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.cap = 1 << 17;
    this.mask = this.cap - 1;
    this.buf = new Float32Array(this.cap);
    this.r = 0;
    this.w = 0;
    this.started = false;
    this.last = 0;
    this.underruns = 0;
    this.port.onmessage = (e) => {
      const audio = e.data && e.data.audio;
      if (!(audio instanceof Float32Array)) return;
      const avail = (this.w - this.r) & this.mask;
      if (avail + audio.length > this.cap) {
        this.r = (this.w + audio.length) & this.mask;
      }
      for (let i = 0; i < audio.length; i++) {
        this.buf[this.w] = audio[i];
        this.w = (this.w + 1) & this.mask;
      }
    };
  }

  process(inputs, outputs) {
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;

    for (let i = 0; i < out.length; i++) {
      let s;
      if (!this.started) {
        const avail = (this.w - this.r) & this.mask;
        if (avail >= 4800) this.started = true;
      }
      if (this.started) {
        const avail = (this.w - this.r) & this.mask;
        if (avail > 0) {
          s = this.buf[this.r];
          this.r = (this.r + 1) & this.mask;
          this.last = s;
        } else {
          s = this.last;
          this.underruns++;
          if (this.underruns > 256) {
            this.started = false;
            this.underruns = 0;
          }
        }
      } else {
        s = 0;
      }
      out[i] = s;
    }
    return true;
  }
}

registerProcessor('chunk-player', ChunkPlayer);
