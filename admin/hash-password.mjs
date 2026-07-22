import { randomBytes, scryptSync } from 'node:crypto';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '');
if (password.length < 12) {
  console.error('A senha deve possuir pelo menos 12 caracteres.');
  process.exit(1);
}
const N = 16384;
const r = 8;
const p = 1;
const salt = randomBytes(24);
const hash = scryptSync(password, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
process.stdout.write(`scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}\n`);

