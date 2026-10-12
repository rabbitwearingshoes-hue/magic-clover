// 의존성 없는 Node 서버. 관객 페이지(/)와 공연자 페이지(/admin), 상태 API를 제공합니다.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'magic';
// 모든 파일이 한 폴더에 있으므로, 아래 목록의 파일만 밖으로 내보냅니다(server.js 등은 접근 불가).
const PUBLIC_DIR = __dirname;
const PUBLIC_FILES = new Set(['index.html', 'admin.html', 'stage.js', 'stage.css', 'img1.jpg', 'img2.jpg']);
const STATE_FILE = path.join(__dirname, 'state.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// room -> { name, number }. room이 없으면 "default".
let rooms = {};
try {
  rooms = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
} catch (_) {}

function save() {
  fs.writeFile(STATE_FILE, JSON.stringify(rooms), () => {});
}

function roomId(url) {
  const r = (url.searchParams.get('r') || 'default').toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(r) ? r : 'default';
}

function keyOk(req) {
  const given = Buffer.from(String(req.headers['x-admin-key'] || ''));
  const real = Buffer.from(ADMIN_KEY);
  return given.length === real.length && crypto.timingSafeEqual(given, real);
}

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 4096) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (_) {
        resolve({});
      }
    });
  });
}

function serveStatic(res, file) {
  if (!PUBLIC_FILES.has(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  const full = path.join(PUBLIC_DIR, file);
  fs.readFile(full, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(full).toLowerCase();
    const isImg = ext === '.jpg' || ext === '.png';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // 사진은 캐시해서 전환이 즉시 일어나게, 코드는 항상 최신으로.
      'Cache-Control': isImg ? 'public, max-age=86400' : 'no-store',
    });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p === '/api/state' && req.method === 'GET') {
    const s = rooms[roomId(url)];
    return sendJson(res, 200, s ? { revealed: true, name: s.name, number: s.number } : { revealed: false });
  }

  if (p === '/api/set' && req.method === 'POST') {
    if (!keyOk(req)) return sendJson(res, 401, { error: 'bad key' });
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 20);
    const number = Number(body.number);
    if (!name) return sendJson(res, 400, { error: '이름을 입력하세요' });
    if (!Number.isInteger(number) || number < 1 || number > 45) {
      return sendJson(res, 400, { error: '숫자는 1~45 사이여야 합니다' });
    }
    rooms[roomId(url)] = { name, number };
    save();
    return sendJson(res, 200, { ok: true });
  }

  if (p === '/api/reset' && req.method === 'POST') {
    if (!keyOk(req)) return sendJson(res, 401, { error: 'bad key' });
    delete rooms[roomId(url)];
    save();
    return sendJson(res, 200, { ok: true });
  }

  if (p === '/api/check' && req.method === 'POST') {
    return keyOk(req) ? sendJson(res, 200, { ok: true }) : sendJson(res, 401, { error: 'bad key' });
  }

  if (p === '/' || p === '/index.html') return serveStatic(res, 'index.html');
  if (p === '/admin') return serveStatic(res, 'admin.html');
  return serveStatic(res, p.replace(/^\/+/, ''));
});

server.listen(PORT, () => {
  console.log(`Magic clover running on http://localhost:${PORT}`);
  if (ADMIN_KEY === 'magic') console.log('주의: 기본 비밀번호(magic)입니다. ADMIN_KEY 환경변수로 바꾸세요.');
});
