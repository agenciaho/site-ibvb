import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { appendFile, copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, join } from 'node:path';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || '/data';
const CONTENT_FILE = join(DATA_DIR, 'conteudo.json');
const DEFAULT_CONTENT = process.env.DEFAULT_CONTENT || '/app/default-content.json';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const PLAIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_TTL = 8 * 60 * 60 * 1000;
const MAX_BODY = 256 * 1024;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 15 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

function send(res, status, payload, extra = {}) {
  res.writeHead(status, { ...jsonHeaders, ...extra });
  res.end(JSON.stringify(payload));
}

function clientIp(req) {
  return String(req.headers['x-real-ip'] || req.socket.remoteAddress || '').slice(0, 80);
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }).filter(([key]) => key));
}

function sessionCookie(req, token, maxAge) {
  const secure = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return `ibvb_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function currentSession(req) {
  const token = cookies(req).ibvb_admin;
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expires <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function requireSession(req, res, csrf = false) {
  const session = currentSession(req);
  if (!session) {
    send(res, 401, { error: 'Sessão inválida ou expirada.' });
    return null;
  }
  if (csrf && req.headers['x-csrf-token'] !== session.csrf) {
    send(res, 403, { error: 'Falha na validação de segurança. Recarregue o painel.' });
    return null;
  }
  return session;
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function validPassword(password) {
  if (!PASSWORD_HASH.startsWith('scrypt$')) {
    const supplied = Buffer.from(String(password));
    const expected = Buffer.from(PLAIN_PASSWORD);
    return expected.length >= 12 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }
  const parts = PASSWORD_HASH.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt64, expected64] = parts;
  try {
    const expected = Buffer.from(expected64, 'base64');
    const actual = scryptSync(String(password), Buffer.from(salt64, 'base64'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function adminConfigured() {
  return PASSWORD_HASH.startsWith('scrypt$') || PLAIN_PASSWORD.length >= 12;
}

function string(value, label, max = 500, required = true) {
  if (typeof value !== 'string') throw new Error(`${label} deve ser um texto.`);
  const result = value.trim();
  if (required && !result) throw new Error(`${label} é obrigatório.`);
  if (result.length > max) throw new Error(`${label} excede ${max} caracteres.`);
  return result;
}

function httpsUrl(value, label, required = true) {
  const result = string(value, label, 1000, required);
  if (!result) return '';
  try {
    const url = new URL(result);
    if (url.protocol !== 'https:') throw new Error();
  } catch {
    throw new Error(`${label} deve ser uma URL HTTPS válida.`);
  }
  return result;
}

function validateContent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Conteúdo inválido.');
  const geral = input.geral || {};
  const array = (value, label, max) => {
    if (!Array.isArray(value)) throw new Error(`${label} deve ser uma lista.`);
    if (value.length > max) throw new Error(`${label} permite no máximo ${max} itens.`);
    return value;
  };

  return {
    geral: {
      link_ao_vivo: httpsUrl(geral.link_ao_vivo, 'Link ao vivo'),
      destaque_titulo: string(geral.destaque_titulo, 'Título do destaque', 160),
      destaque_descricao: string(geral.destaque_descricao, 'Descrição do destaque', 1200),
      destaque_video: httpsUrl(geral.destaque_video, 'Vídeo em destaque'),
    },
    cultos: array(input.cultos, 'Cultos', 20).map((item, index) => ({
      dia: string(item?.dia, `Dia do culto ${index + 1}`, 60),
      nome: string(item?.nome, `Nome do culto ${index + 1}`, 160),
      hora: string(item?.hora, `Horário do culto ${index + 1}`, 80),
      desc: string(item?.desc, `Descrição do culto ${index + 1}`, 800),
    })),
    mensagens: array(input.mensagens, 'Mensagens', 3).map((item, index) => ({
      tipo: string(item?.tipo, `Categoria da mensagem ${index + 1}`, 80),
      titulo: string(item?.titulo, `Título da mensagem ${index + 1}`, 180),
      sub: string(item?.sub || '', `Legenda da mensagem ${index + 1}`, 100, false),
      video: httpsUrl(item?.video, `Vídeo da mensagem ${index + 1}`),
    })),
    eventos: array(input.eventos, 'Eventos', 100).map((item, index) => {
      const telefone = string(item?.telefone || '', `Telefone do evento ${index + 1}`, 30, false);
      if (telefone && !/^[+()\d\s-]+$/.test(telefone)) throw new Error(`Telefone do evento ${index + 1} é inválido.`);
      return {
        dia: string(item?.dia, `Dia do evento ${index + 1}`, 30),
        mes: string(item?.mes, `Mês do evento ${index + 1}`, 10),
        hora: string(item?.hora || '', `Horário do evento ${index + 1}`, 80, false),
        titulo: string(item?.titulo, `Título do evento ${index + 1}`, 180),
        desc: string(item?.desc, `Descrição do evento ${index + 1}`, 1200),
        telefone,
      };
    }),
  };
}

async function initializeData() {
  await mkdir(join(DATA_DIR, 'backups'), { recursive: true });
  try {
    await readFile(CONTENT_FILE);
  } catch {
    await copyFile(DEFAULT_CONTENT, CONTENT_FILE);
  }
}

async function saveContent(content, username, ip) {
  const serialized = `${JSON.stringify(content, null, 2)}\n`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = join(DATA_DIR, 'backups', `conteudo-${timestamp}.json`);
  const temporary = join(DATA_DIR, `.conteudo-${randomBytes(8).toString('hex')}.tmp`);
  await copyFile(CONTENT_FILE, backup);
  // O JSON e publico pelo proprio site; o worker nginx precisa conseguir le-lo.
  await writeFile(temporary, serialized, { mode: 0o644 });
  await rename(temporary, CONTENT_FILE);
  await appendFile(join(DATA_DIR, 'auditoria.log'), `${JSON.stringify({
    at: new Date().toISOString(), username, ip,
    sha256: createHash('sha256').update(serialized).digest('hex'),
  })}\n`, { mode: 0o640 });

  const files = (await readdir(join(DATA_DIR, 'backups'))).filter(name => name.endsWith('.json')).sort().reverse();
  await Promise.all(files.slice(30).map(name => rm(join(DATA_DIR, 'backups', basename(name)))));
}

function loginBlocked(ip) {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || record.since + ATTEMPT_WINDOW <= now) {
    attempts.set(ip, { count: 0, since: now });
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const record = attempts.get(ip) || { count: 0, since: Date.now() };
  record.count += 1;
  attempts.set(ip, record);
}

await initializeData();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ip = clientIp(req);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { status: 'ok', adminConfigured: adminConfigured() });
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/login') {
      if (!adminConfigured()) return send(res, 503, { error: 'Painel ainda não configurado pelo administrador.' });
      if (loginBlocked(ip)) return send(res, 429, { error: 'Muitas tentativas. Aguarde 15 minutos.' }, { 'Retry-After': '900' });
      const body = await readBody(req);
      const usernameOk = typeof body.username === 'string'
        && Buffer.byteLength(body.username) === Buffer.byteLength(ADMIN_USERNAME)
        && timingSafeEqual(Buffer.from(body.username), Buffer.from(ADMIN_USERNAME));
      const passwordOk = validPassword(body.password);
      if (!usernameOk || !passwordOk) {
        recordFailure(ip);
        return send(res, 401, { error: 'Usuário ou senha inválidos.' });
      }
      attempts.delete(ip);
      const token = randomBytes(32).toString('base64url');
      const csrf = randomBytes(24).toString('base64url');
      sessions.set(token, { username: ADMIN_USERNAME, csrf, expires: Date.now() + SESSION_TTL });
      return send(res, 200, { username: ADMIN_USERNAME, csrf }, { 'Set-Cookie': sessionCookie(req, token, SESSION_TTL / 1000) });
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/session') {
      const session = requireSession(req, res);
      if (!session) return;
      return send(res, 200, { username: session.username, csrf: session.csrf });
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
      const session = requireSession(req, res, true);
      if (!session) return;
      sessions.delete(session.token);
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/content') {
      if (!requireSession(req, res)) return;
      const content = JSON.parse(await readFile(CONTENT_FILE, 'utf8'));
      return send(res, 200, content);
    }
    if (req.method === 'PUT' && url.pathname === '/api/admin/content') {
      const session = requireSession(req, res, true);
      if (!session) return;
      const content = validateContent(await readBody(req));
      await saveContent(content, session.username, ip);
      return send(res, 200, { ok: true, savedAt: new Date().toISOString() });
    }
    return send(res, 404, { error: 'Rota não encontrada.' });
  } catch (error) {
    if (error.message === 'PAYLOAD_TOO_LARGE') return send(res, 413, { error: 'Conteúdo muito grande.' });
    if (error.message === 'INVALID_JSON') return send(res, 400, { error: 'JSON inválido.' });
    if (error instanceof TypeError || !String(error.message).includes('ENOENT')) {
      if (error.message && !error.stack?.includes('node:internal')) return send(res, 400, { error: error.message });
    }
    console.error(error);
    return send(res, 500, { error: 'Erro interno. Consulte os logs do serviço.' });
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expires <= now) sessions.delete(token);
  for (const [ip, record] of attempts) if (record.since + ATTEMPT_WINDOW <= now) attempts.delete(ip);
}, 60_000).unref();

server.listen(PORT, '0.0.0.0', () => console.log(`IBVB Admin API ouvindo na porta ${PORT}`));
