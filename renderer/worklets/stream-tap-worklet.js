class StreamTap extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const chunkMs = (options && options.processorOptions && options.processorOptions.chunkMs) || 512;
    this.chunk = Math.max(128, Math.round((sampleRate * chunkMs) / 1000));
    this.buf = new Float32Array(this.chunk);
    this.fill = 0;
  }

  process(inputs) {
    const inp = inputs[0] && inputs[0][0];
    if (!inp) return true;
    let i = 0;
    while (i < inp.length) {
      const need = this.chunk - this.fill;
      const take = Math.min(need, inp.length - i);
      this.buf.set(inp.subarray(i, i + take), this.fill);
      this.fill += take;
      i += take;
      if (this.fill === this.chunk) {
        const out = this.buf.slice(0);
        this.port.postMessage(out, [out.buffer]);
        this.fill = 0;
      }
    }
    return true;
  }
}

registerProcessor('stream-tap', StreamTap);
