// Entra de fato no mundo (protocolo de jogo, porta 7172) para provar que o personagem
// tem posicao valida e que o servidor envia a descricao do mapa.
const net = require('net'), crypto = require('crypto'), fs = require('fs');
const ACC = process.argv[2] || 'god', CHAR = process.argv[3] || 'Vethara God', PASS = process.argv[4] || 'god';

const jwk = crypto.createPublicKey(fs.readFileSync('C:/Repo/Vethara/server/key.pem')).export({ format: 'jwk' });
const N = BigInt('0x' + Buffer.from(jwk.n, 'base64url').toString('hex')), E = 65537n;
const modpow = (b, e, m) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
const adler32 = buf => { let a = 1, b = 0; for (const x of buf) { a = (a + x) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; };

function xtea(buf, key, decrypt) {
  const out = Buffer.from(buf);
  for (let off = 0; off + 8 <= out.length; off += 8) {
    let v0 = out.readUInt32LE(off), v1 = out.readUInt32LE(off + 4);
    if (decrypt) {
      let sum = 0xC6EF3720;
      for (let i = 0; i < 32; i++) {
        v1 = (v1 - ((((v0 << 4) ^ (v0 >>> 5)) + v0) ^ (sum + key[(sum >>> 11) & 3]))) >>> 0;
        sum = (sum - 0x9E3779B9) >>> 0;
        v0 = (v0 - ((((v1 << 4) ^ (v1 >>> 5)) + v1) ^ (sum + key[sum & 3]))) >>> 0;
      }
    }
    out.writeUInt32LE(v0, off); out.writeUInt32LE(v1, off + 4);
  }
  return out;
}

const key = [0x11111111, 0x22222222, 0x33333333, 0x44444444];
const sock = net.connect(7172, '127.0.0.1');
let stage = 'challenge', buf = Buffer.alloc(0);

sock.on('data', d => {
  buf = Buffer.concat([buf, d]);
  if (stage === 'challenge' && buf.length >= 14) {
    // desafio em claro: [u16 tam][u32 checksum][u16 tamInterno][0x1F][u32 timestamp][u8 random]
    const ts = buf.readUInt32LE(9), rnd = buf[13];
    console.log(`desafio recebido: opcode=0x${buf[8].toString(16)} timestamp=${ts} random=${rnd}`);

    const plain = Buffer.alloc(128); let p = 0;
    plain[p++] = 0;
    for (const k of key) { plain.writeUInt32LE(k, p); p += 4; }
    plain[p++] = 0; // flag de gamemaster
    for (const s of [ACC, CHAR, PASS]) { plain.writeUInt16LE(s.length, p); p += 2; plain.write(s, p, 'latin1'); p += s.length; }
    plain.writeUInt32LE(ts, p); p += 4;
    plain[p++] = rnd; // o resto fica zerado: evita falso positivo na deteccao de OTCv8

    const body = Buffer.concat([
      Buffer.from([0x0A]),
      (() => { const b = Buffer.alloc(4); b.writeUInt16LE(2, 0); b.writeUInt16LE(860, 2); return b; })(),
      Buffer.from(modpow(BigInt('0x' + plain.toString('hex')), E, N).toString(16).padStart(256, '0'), 'hex'),
    ]);
    const head = Buffer.alloc(6);
    head.writeUInt16LE(body.length + 4, 0); head.writeUInt32LE(adler32(body), 2);
    sock.write(Buffer.concat([head, body]));
    stage = 'world'; buf = Buffer.alloc(0);
    return;
  }
  if (stage === 'world' && buf.length > 8) {
    const dec = xtea(buf.slice(6), key, true);
    const len = dec.readUInt16LE(0), op = dec[2];
    if (op === 0x14 || op === 0x0B) {
      const n = dec.readUInt16LE(3);
      console.log('RECUSADO:', dec.slice(5, 5 + n).toString('latin1'));
    } else if (op === 0x0A) {
      console.log(`\nENTROU NO MUNDO`);
      console.log(`  id do jogador: ${dec.readUInt32LE(3)}`);
      console.log(`  pacote de ${len} bytes (descricao do mapa e estado inicial)`);
      const ops = new Set(); for (let i = 2; i < Math.min(dec.length, len); i++) ops.add(dec[i]);
      for (let i = 2; i < len - 5; i++) { if (dec[i] === 0x64) { const x = dec.readUInt16LE(i+1), y = dec.readUInt16LE(i+3), z = dec[i+5]; if (x > 1000 && x < 33536 && y > 1000 && y < 33024 && z < 16) { console.log(`  posicao inicial: x=${x} y=${y} z=${z}`); break; } } }
    } else {
      console.log(`resposta inesperada: opcode=0x${op.toString(16)} tam=${len}`);
    }
    sock.destroy();
  }
});
sock.on('error', e => console.log('erro de socket:', e.message));
setTimeout(() => sock.destroy(), 5000);
