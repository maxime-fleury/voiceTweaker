const IR_CONFIGS = {
  room:      { dur: 0.9,  predelay: 0.012, erCount: 8,  erSpread: 0.05, bright: 0.55, tilt: 2.8 },
  hall:      { dur: 1.9,  predelay: 0.024, erCount: 11, erSpread: 0.09, bright: 0.45, tilt: 2.4 },
  cathedral: { dur: 3.6,  predelay: 0.04,  erCount: 14, erSpread: 0.16, bright: 0.35, tilt: 2.1 },
  plate:     { dur: 2.2,  predelay: 0.004, erCount: 6,  erSpread: 0.02, bright: 0.78, tilt: 3.2 },
};

function generateIR(ctx, type = 'hall') {
  const cfg = IR_CONFIGS[type] || IR_CONFIGS.hall;
  const sr = ctx.sampleRate;
  const len = Math.max(64, Math.floor(sr * (cfg.predelay + cfg.dur)));
  const ir = ctx.createBuffer(2, len, sr);
  const preLen = Math.floor(sr * cfg.predelay);
  const tailLen = len - preLen;

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);

    let lpZ = 0;
    const lpBase = 0.92 - cfg.bright * 0.22;
    const decayRate = 6.9 / cfg.dur;

    for (let i = 0; i < tailLen; i++) {
      const t = i / sr;
      const n = Math.random() * 2 - 1;
      const prog = t / cfg.dur;
      const coef = Math.min(0.985, lpBase + prog * (0.985 - lpBase) * cfg.tilt * 0.5);
      lpZ = coef * lpZ + (1 - coef) * n;
      const env = Math.exp(-t * decayRate);
      data[preLen + i] = lpZ * env;
    }

    for (let k = 0; k < cfg.erCount; k++) {
      const pos = preLen + Math.floor((Math.random() * cfg.erSpread + 0.003) * sr);
      if (pos >= len) continue;
      const g = 0.55 * Math.pow(1 - k / cfg.erCount, 1.6) * (k % 2 === 0 ? 1 : -0.8);
      data[pos] += g;
    }

    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(data[i]));
    if (peak > 0) {
      const norm = 0.5 / peak;
      for (let i = 0; i < len; i++) data[i] *= norm;
    }
  }

  return ir;
}

if (typeof module !== 'undefined') module.exports = { generateIR, IR_CONFIGS };
