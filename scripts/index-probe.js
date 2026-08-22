/* Sonde v4 : layout confirmé ilar|nlist u64|code_size u64|'full'|nlist u64|sizes u64[] */
const fs = require('fs');
const buf = fs.readFileSync(process.argv[2]);
const fsize = buf.length;

const d = buf.readUInt32LE(4);
const ntotal = Number(buf.readBigUInt64LE(8));
const qOff = buf.indexOf(Buffer.from('IxF2'), 8);
const qd = buf.readUInt32LE(qOff + 4);
const qnt = Number(buf.readBigUInt64LE(qOff + 8));
const ilar = buf.indexOf(Buffer.from('ilar'), qOff);

let p = ilar + 4;
const nlist = Number(buf.readBigUInt64LE(p)); p += 8;
const codeSize = Number(buf.readBigUInt64LE(p)); p += 8;
const tag = buf.toString('ascii', p, p + 4); p += 4;
const nlist2 = Number(buf.readBigUInt64LE(p)); p += 8;
console.log({ d, ntotal, nlist, codeSize, tag, nlist2 });

const sizes = new BigUint64Array(nlist);
let sum = 0;
for (let l = 0; l < nlist; l++) { sizes[l] = buf.readBigUInt64LE(p); p += 8; sum += Number(sizes[l]); }
const sizesEnd = p;
console.log('sum sizes', sum, sum === ntotal ? '== NTOTAL OK' : 'KO');

for (const idSize of [4, 8]) {
  let q = sizesEnd;
  for (let l = 0; l < nlist; l++) q += Number(sizes[l]) * (idSize + d * 4);
  console.log('idSize', idSize, 'end=', q, q === fsize ? '== FINSIZE OK' : '(delta ' + (fsize - q) + ')');
}

// ids croissants dans la liste 0 ? (faiss ajoute séquentiellement)
{
  let q = sizesEnd;
  const s0 = Number(sizes[0]);
  const ids0 = [];
  for (let i = 0; i < Math.min(5, s0); i++) ids0.push(Number(buf.readBigUInt64LE(q + i * 8)));
  const firstFloat = buf.readFloatLE(q + s0 * 8);
  console.log('ids0[0..4]', ids0.join(','), 'first float list0:', firstFloat.toFixed(3),
    isFinite(firstFloat) ? 'OK' : 'KO');
}

// centroïdes
const vecLen = qnt * qd * 4;
for (let flags = 0; flags <= 24; flags++) {
  const start = ilar - flags - vecLen;
  if (start <= qOff + 12) continue;
  let ok = true;
  for (let t = 0; t < 512; t += 11) {
    const v = buf.readFloatLE(start + ((t * 7919) % vecLen));
    if (!Number.isFinite(v) || Math.abs(v) > 1e3) { ok = false; break; }
  }
  if (ok) { console.log('centroids start=', start, '(flags=' + flags + ')'); break; }
}
