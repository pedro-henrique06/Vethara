// Teste de login no protocolo 8.60 do TFS: RSA cru + XTEA, sem cliente grafico.
const net = require('net'), crypto = require('crypto'), fs = require('fs');

const ACC = process.argv[2] || 'god', PASS = process.argv[3] || 'god';

// modulo RSA publico a partir da chave privada do servidor
const jwk = crypto.createPublicKey(fs.readFileSync('C:/Repo/Vethara/server/key.pem')).export({ format: 'jwk' });
const N = BigInt('0x' + Buffer.from(jwk.n, 'base64url').toString('hex'));
const E = 65537n;

const modpow = (b, e, m) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };

function adler32(buf) {
  let a = 1, b = 0;
  for (const byte of buf) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

function xteaDecrypt(buf, key) {
  const out = Buffer.from(buf);
  for (let off = 0; off < out.length; off += 8) {
    let v0 = out.readUInt32LE(off), v1 = out.readUInt32LE(off + 4);
    let sum = 0xC6EF3720;
    for (let i = 0; i < 32; i++) {
      v1 = (v1 - ((((v0 << 4) ^ (v0 >>> 5)) + v0) ^ (sum + key[(sum >>> 11) & 3]))) >>> 0;
      sum = (sum - 0x9E3779B9) >>> 0;
      v0 = (v0 - ((((v1 << 4) ^ (v1 >>> 5)) + v1) ^ (sum + key[sum & 3]))) >>> 0;
    }
    out.writeUInt32LE(v0, off); out.writeUInt32LE(v1, off + 4);
  }
  return out;
}

const xteaKey = [0x11111111, 0x22222222, 0x33333333, 0x44444444];

// bloco RSA: 0x00 + chave xtea + conta + senha, completado com lixo ate 128 bytes
const plain = Buffer.alloc(128);
let p = 0;
plain[p++] = 0;
for (const k of xteaKey) { plain.writeUInt32LE(k, p); p += 4; }
plain.writeUInt16LE(ACC.length, p); p += 2; plain.write(ACC, p); p += ACC.length;
plain.writeUInt16LE(PASS.length, p); p += 2; plain.write(PASS, p); p += PASS.length;
crypto.randomFillSync(plain, p, 128 - p);

const cipher = modpow(BigInt('0x' + plain.toString('hex')), E, N).toString(16).padStart(256, '0');

const body = Buffer.concat([
  Buffer.from([0x01]),                                     // identificador do protocolo de login
  (() => { const b = Buffer.alloc(4); b.writeUInt16LE(2, 0); b.writeUInt16LE(860, 2); return b; })(),
  Buffer.alloc(12),                                        // assinaturas dat/spr/pic (o servidor pula)
  Buffer.from(cipher, 'hex'),
]);

const header = Buffer.alloc(6);
header.writeUInt16LE(body.length + 4, 0);
header.writeUInt32LE(adler32(body), 2);

const sock = net.connect(7171, '127.0.0.1', () => sock.write(Buffer.concat([header, body])));
let buf = Buffer.alloc(0);
sock.on('data', d => { buf = Buffer.concat([buf, d]); });
sock.on('close', () => {
  if (!buf.length) return console.log('sem resposta (conexao fechada sem dados)');
  const dec = xteaDecrypt(buf.slice(6), xteaKey);
  let i = 2;
  const u8 = () => dec[i++];
  const u16 = () => { const v = dec.readUInt16LE(i); i += 2; return v; };
  const u32 = () => { const v = dec.readUInt32LE(i); i += 4; return v; };
  const str = () => { const n = u16(); const s = dec.slice(i, i + n).toString('latin1'); i += n; return s; };
  while (i < dec.length) {
    const op = u8();
    if (op === 0x14) console.log('MOTD:', str());
    else if (op === 0x0A || op === 0x0B) { console.log('ERRO DO SERVIDOR:', str()); break; }
    else if (op === 0x64) {
      const n = u8();
      console.log(`\nPERSONAGENS (${n}):`);
      for (let c = 0; c < n; c++) {
        const name = str(), world = str();
        const ip = [dec[i++], dec[i++], dec[i++], dec[i++]].join('.'), port = u16();
        console.log(`  ${name.padEnd(16)} mundo=${world} ${ip}:${port}`);
      }
      console.log('Premium (dias):', u16());
      break;
    } else { console.log('opcode inesperado: 0x' + op.toString(16)); break; }
  }
});
setTimeout(() => sock.destroy(), 3000);
