const fs = require('fs');
const path = require('path');
const { net, shell } = require('electron');

let OT = null;
try {
  OT = require('onnxruntime-node');
} catch (e) {
  OT = null;
}

function resampleLinear(src, from, to) {
  if (from === to) return src;
  const ratio = from / to;
  const outLen = Math.max(1, Math.round(src.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = src[Math.min(i0, src.length - 1)];
    const b = src[Math.min(i0 + 1, src.length - 1)];
    out[i] = a + (b - a) * frac;
  }
  return out;
}

function yinF0Series(buf, sr, frames) {
  const fMin = 60, fMax = 500;
  const tauMin = Math.floor(sr / fMax);
  const tauMax = Math.ceil(sr / fMin);
  const W = Math.min(2048, Math.floor(buf.length / 2));
  const thresh = 0.15;
  const out = new Array(frames).fill(0);

  if (buf.length < tauMax + W) return out;

  for (let f = 0; f < frames; f++) {
    const center = Math.floor(((f + 0.5) * buf.length) / frames);
    const start = center - W / 2;
    if (start < 0 || start + W + tauMax >= buf.length) continue;

    let energy = 0;
    for (let i = 0; i < W; i++) energy += buf[start + i] * buf[start + i];
    if (energy < 1e-6) continue;

    let bestTau = 0, bestVal = Infinity, prevVal = Infinity;
    const cmnd = new Float32Array(tauMax + 1);
    let runningSum = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let d = 0;
      for (let i = 0; i < W; i++) {
        const diff = buf[start + i] - buf[start + i + tau];
        d += diff * diff;
      }
      runningSum += d;
      cmnd[tau] = runningSum > 0 ? (d * tau) / runningSum : 1;
    }
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (cmnd[tau] < thresh && cmnd[tau] <= prevVal) {
        while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
        bestTau = tau;
        bestVal = cmnd[tau];
        break;
      }
      prevVal = cmnd[tau];
      if (cmnd[tau] < bestVal) {
        bestVal = cmnd[tau];
        bestTau = tau;
      }
    }
    if (bestTau > 0 && bestVal < 0.5) {
      out[f] = sr / bestTau;
    }
  }
  return out;
}

function f0ToCoarse(f) {
  if (!f || f <= 0) return 0;
  const mel = 1127 * Math.log(1 + f / 700);
  const lo = 1127 * Math.log(1 + 50 / 700);
  const hi = 1127 * Math.log(1 + 1100 / 700);
  const c = Math.round(((mel - lo) / (hi - lo)) * 255) + 1;
  return Math.max(1, Math.min(255, c));
}

class RvcEngine {
  constructor(root) {
    this.root = root;
    this.hubertSess = null;
    this.genSess = null;
    this.voiceId = null;
  }

  status() {
    const voices = [];
    try {
      for (const entry of fs.readdirSync(this.root, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === 'hubert') continue;
        const p = path.join(this.root, entry.name, 'model.onnx');
        if (fs.existsSync(p)) voices.push({ id: entry.name, label: entry.name });
      }
    } catch (e) {}
    return {
      ortOk: !!OT,
      hubertOk: fs.existsSync(path.join(this.root, 'hubert', 'hubert.onnx')),
      voices,
      loaded: this.voiceId,
      modelsRoot: this.root,
    };
  }

  async load(voiceId) {
    if (!OT) throw new Error('onnxruntime-node indisponible');
    if (!this.hubertSess) {
      const hp = path.join(this.root, 'hubert', 'hubert.onnx');
      if (!fs.existsSync(hp)) throw new Error('models/hubert/hubert.onnx introuvable');
      this.hubertSess = await OT.InferenceSession.create(hp, { executionProviders: ['cpu'] });
    }
    const vp = path.join(this.root, voiceId, 'model.onnx');
    if (!fs.existsSync(vp)) throw new Error(`Modèle introuvable : ${vp}`);
    if (this.voiceId !== voiceId) {
      if (this.genSess) await this.genSess.release();
      this.genSess = null;
    }
    this.genSess = await OT.InferenceSession.create(vp, { executionProviders: ['cpu'] });
    this.voiceId = voiceId;
    return { ok: true, inputs: this.genSess.inputNames, outputs: this.genSess.outputNames };
  }

  async convert(f32) {
    if (!this.hubertSess || !this.genSess) return f32;
    const SR = 48000, SRH = 16000;
    const x16 = resampleLinear(f32, SR, SRH);

    const hubIn = this.hubertSess.inputNames[0];
    const hFeeds = { [hubIn]: new OT.Tensor('float32', x16, [1, x16.length]) };
    const hOut = await this.hubertSess.run(hFeeds);
    const hT = hOut[this.hubertSess.outputNames[0]];
    const dims = hT.dims;
    let T, D, feats;
    if (dims.length === 3) { T = dims[1]; D = dims[2]; feats = hT.data; }
    else if (dims.length === 2) { T = dims[0]; D = dims[1]; feats = hT.data; }
    else throw new Error('Sortie HuBERT inattendue : ' + JSON.stringify(dims));
    if (D !== 256) throw new Error(`Dim HuBERT ${D} != 256 : export ONNX incompatible avec RVC`);

    const f0 = yinF0Series(f32, SR, T);
    const coarse = f0.map(f0ToCoarse);
    const pitchf = Float32Array.from(f0);
    const phone = feats instanceof Float32Array ? feats : Float32Array.from(feats);

    const variants = [
      { phone: [1, T, D], pitch: [1, T], pitchf: [1, T], pl: [1], ds: [1] },
      { phone: [T, D], pitch: [T], pitchf: [T], pl: [1], ds: [1] },
    ];

    let lastErr = null;
    for (const v of variants) {
      const tensors = {
        phone: new OT.Tensor('float32', phone, v.phone),
        phone_lengths: new OT.Tensor('int64', BigInt64Array.from([BigInt(T)]), v.pl),
        pitch: new OT.Tensor('int64', BigInt64Array.from(coarse.map(BigInt)), v.pitch),
        pitchf: new OT.Tensor('float32', pitchf, v.pitchf),
        ds: new OT.Tensor('int64', BigInt64Array.from([BigInt(0)]), v.ds),
      };
      const feeds = {};
      for (const name of this.genSess.inputNames) {
        if (/phone_len/i.test(name)) feeds[name] = tensors.phone_lengths;
        else if (/pitchf|pitch_f/i.test(name)) feeds[name] = tensors.pitchf;
        else if (/pitch/i.test(name)) feeds[name] = tensors.pitch;
        else if (/^ds$|speaker|sid/i.test(name)) feeds[name] = tensors.ds;
        else if (/phone|token|feature|hidden/i.test(name)) feeds[name] = tensors.phone;
      }
      try {
        const gOut = await this.genSess.run(feeds);
        const a = gOut[this.genSess.outputNames[0]];
        let audio = a.data;
        const adims = a.dims;
        if (adims.length > 1) {
          const lastDim = adims[adims.length - 1];
          audio = audio.slice(audio.length - lastDim);
        }
        return audio instanceof Float32Array ? audio : Float32Array.from(audio);
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error('Inférence RVC échouée : ' + (lastErr && lastErr.message));
  }

  async addUrl(name, url, depth = 0) {
    const safe = String(name).toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40);
    if (!safe) throw new Error('Nom invalide');
    const dir = path.join(this.root, safe);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, 'model.onnx');
    const cleanup = () => {
      try { fs.unlinkSync(dest); } catch (e) {}
    };
    await new Promise((resolve, reject) => {
      const request = net.request(url);
      request.on('response', (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request.abort();
          if (depth >= 5) {
            reject(new Error('Trop de redirections'));
            return;
          }
          this.addUrl(name, res.headers.location, depth + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          cleanup();
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.on('data', (chunk) => file.write(chunk));
        res.on('end', () => { file.end(); resolve(); });
        res.on('error', () => { cleanup(); reject(new Error('Téléchargement interrompu')); });
      });
      request.on('error', (err) => { cleanup(); reject(err); });
      request.end();
    });
    return { ok: true, id: safe };
  }

  openFolder() {
    shell.openPath(this.root);
  }
}

module.exports = { RvcEngine };
