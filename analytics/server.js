const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_FILE = path.join(__dirname, 'hits.jsonl');
const BOOKINGS_FILE = path.join(__dirname, 'bookings.jsonl');
const PORT = 3005;

// Load shared env file (same pattern as ds-digest / ds-invoice)
try {
 const envFile = path.join(os.homedir(), 'dan-command', '.env');
 if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
   const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
   if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
 }
} catch (e) { /* env file optional */ }

// Optional integrations — degrade gracefully if env vars missing
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID  || '';
const BREVO_KEY = process.env.BREVO_API_KEY || '';

function notifyTelegram(text) {
 if (!TG_TOKEN || !TG_CHAT) return;
 const body = JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' });
 const req = https.request({
  hostname: 'api.telegram.org', port: 443,
  path: `/bot${TG_TOKEN}/sendMessage`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
 });
 req.on('error', () => {});
 req.write(body); req.end();
}

function sendBrevoEmail(to, name, service, when) {
 if (!BREVO_KEY) return;
 const body = JSON.stringify({
  sender: { name: 'DS Electrical', email: 'info@dselectricalinstallations.co.uk' },
  to: [{ email: to, name }],
  replyTo: { email: 'dstevenselectrical@gmail.com', name: 'Dan Stevens' },
  subject: `DS Electrical — booking received (${service})`,
  htmlContent: `<div style="font-family:system-ui,sans-serif;color:#222;max-width:560px"><h2 style="color:#0f0d0a;border-bottom:2px solid #d4a44a;padding-bottom:8px">Booking received</h2><p>Hi ${name},</p><p>Thanks for booking <strong>${service}</strong>${when ? ' for <strong>' + when + '</strong>' : ''} with DS Electrical Installations (SW) Ltd.</p><p>Dan will be in touch shortly to confirm the date and any access details.</p><p style="margin-top:24px">If anything's urgent in the meantime: <strong>07889 334849</strong>.</p><p style="color:#666;font-size:13px;margin-top:32px">DS Electrical Installations (SW) Ltd · NAPIT Approved · Glastonbury, Somerset · <a href="https://www.dselectricalsw.co.uk">dselectricalsw.co.uk</a></p></div>`
 });
 const req = https.request({
  hostname: 'api.brevo.com', port: 443, path: '/v3/smtp/email', method: 'POST',
  headers: { 'api-key': BREVO_KEY, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
 });
 req.on('error', () => {});
 req.write(body); req.end();
}

function readJsonBody(req, max = 8192) {
 return new Promise((resolve, reject) => {
  let body = '';
  req.on('data', c => {
   body += c;
   if (body.length > max) { req.destroy(); reject(new Error('too large')); }
  });
  req.on('end', () => {
   try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); }
  });
  req.on('error', reject);
 });
}

const server = http.createServer((req, res) => {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

 if (req.method === 'OPTIONS') {
  res.writeHead(204); res.end(); return;
 }

 // Booking submission — book-eicr / book-fuseboard / book-ev-charger
 if (req.method === 'POST' && req.url === '/api/booking') {
  readJsonBody(req).then(data => {
   const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
   // Honeypot — bots fill the hidden "website" field
   if (data.website) { res.writeHead(204); res.end(); return; }
   const entry = {
    ts: new Date().toISOString(),
    service: String(data.service || '').slice(0, 60),
    name: String(data.name || '').slice(0, 100),
    email: String(data.email || '').slice(0, 120),
    phone: String(data.phone || '').slice(0, 30),
    postcode: String(data.postcode || '').slice(0, 20),
    when: String(data.when || '').slice(0, 60),
    notes: String(data.notes || '').slice(0, 800),
    source: String(data.source || '').slice(0, 60),
    ua: (req.headers['user-agent'] || '').slice(0, 200),
    ip
   };
   if (!entry.name || (!entry.email && !entry.phone)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'name + email or phone required' })); return;
   }
   fs.appendFile(BOOKINGS_FILE, JSON.stringify(entry) + '\n', () => {});

   const lines = [
    `<b>NEW BOOKING — ${entry.service || 'enquiry'}</b>`,
    `<b>${entry.name}</b>${entry.postcode ? ' · ' + entry.postcode : ''}`,
    entry.email ? `📧 ${entry.email}` : '',
    entry.phone ? `📞 ${entry.phone}` : '',
    entry.when ? `🗓 ${entry.when}` : '',
    entry.notes ? `\n${entry.notes}` : '',
    `\n<i>via ${entry.source || 'website'}</i>`
   ].filter(Boolean).join('\n');
   notifyTelegram(lines);
   if (entry.email) sendBrevoEmail(entry.email, entry.name, entry.service || 'electrical work', entry.when);

   res.writeHead(200, { 'Content-Type': 'application/json' });
   res.end(JSON.stringify({ ok: true }));
  }).catch(() => {
   res.writeHead(400, { 'Content-Type': 'application/json' });
   res.end(JSON.stringify({ ok: false, error: 'invalid request' }));
  });
  return;
 }

 // Track hit
 if (req.method === 'POST' && req.url === '/hit') {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
   try {
    const data = JSON.parse(body);
    const entry = {
     ts: new Date().toISOString(),
     p: (data.p || '/').slice(0, 200),
     r: (data.r || '').slice(0, 500),
     ua: (req.headers['user-agent'] || '').slice(0, 300),
     ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
    };
    fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', () => {});
   } catch(e) {}
   res.writeHead(204);
   res.end();
  });
  return;
 }

 // Dashboard
 if (req.method === 'GET' && req.url === '/dashboard') {
  try {
   const raw = fs.readFileSync(LOG_FILE, 'utf8').trim();
   if (!raw) { sendDash(res, []); return; }
   const lines = raw.split('\n').map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
   sendDash(res, lines);
  } catch(e) {
   sendDash(res, []);
  }
  return;
 }

 res.writeHead(404);
 res.end('Not found');
});

function sendDash(res, hits) {
 const now = new Date();
 const today = now.toISOString().slice(0, 10);
 const weekAgo = new Date(now - 7 * 86400000).toISOString();

 const todayHits = hits.filter(h => h.ts && h.ts.startsWith(today));
 const weekHits = hits.filter(h => h.ts && h.ts >= weekAgo);

 // Page counts
 const pages = {};
 weekHits.forEach(h => { pages[h.p] = (pages[h.p] || 0) + 1; });
 const topPages = Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 20);

 // Referrers
 const refs = {};
 weekHits.forEach(h => {
  if (h.r && !h.r.includes('dselectricalsw')) {
   try { const u = new URL(h.r); refs[u.hostname] = (refs[u.hostname] || 0) + 1; } catch(e) {}
  }
 });
 const topRefs = Object.entries(refs).sort((a, b) => b[1] - a[1]).slice(0, 10);

 // Daily counts (last 7 days)
 const daily = {};
 for (let i = 0; i < 7; i++) {
  const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
  daily[d] = hits.filter(h => h.ts && h.ts.startsWith(d)).length;
 }

 // Unique IPs today
 const uniqueToday = new Set(todayHits.map(h => h.ip)).size;
 const uniqueWeek = new Set(weekHits.map(h => h.ip)).size;

 const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DS Electrical Analytics</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0a0908;color:#f0e8da;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem;color:#d4a44a}h2{font-size:1rem;color:#d4a44a;margin:2rem 0 .75rem;text-transform:uppercase;letter-spacing:.1em;font-size:.75rem}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin:1.5rem 0}.stat{background:#131110;padding:1.25rem;border-radius:8px;text-align:center;border:1px solid rgba(255,255,255,.06)}.stat-n{font-size:2rem;font-weight:900;color:#fff}.stat-l{font-size:.7rem;color:rgba(240,232,218,.5);text-transform:uppercase;letter-spacing:.1em;margin-top:.25rem}table{width:100%;border-collapse:collapse;margin:.5rem 0}td{padding:.5rem .75rem;border-bottom:1px solid rgba(255,255,255,.06);font-size:.85rem}td:last-child{text-align:right;font-weight:700;color:#d4a44a;font-family:monospace}.bar{height:6px;background:#d4a44a;border-radius:3px;margin-top:.25rem}@media(max-width:600px){.stats{grid-template-columns:1fr 1fr}}</style></head><body>'
  + '<h1>DS Electrical Analytics</h1><p style="color:rgba(240,232,218,.5);font-size:.85rem">Self-hosted. No tracking cookies. No third parties.</p>'
  + '<div class="stats"><div class="stat"><div class="stat-n">' + todayHits.length + '</div><div class="stat-l">Views Today</div></div>'
  + '<div class="stat"><div class="stat-n">' + uniqueToday + '</div><div class="stat-l">Visitors Today</div></div>'
  + '<div class="stat"><div class="stat-n">' + weekHits.length + '</div><div class="stat-l">Views This Week</div></div>'
  + '<div class="stat"><div class="stat-n">' + uniqueWeek + '</div><div class="stat-l">Visitors This Week</div></div></div>'
  + '<h2>Daily Views (Last 7 Days)</h2><table>' + Object.entries(daily).map(function(e) { return '<tr><td>' + e[0] + '</td><td>' + e[1] + '</td></tr>'; }).join('') + '</table>'
  + '<h2>Top Pages (This Week)</h2><table>' + topPages.map(function(e) { var pct = topPages[0] ? Math.round(e[1] / topPages[0][1] * 100) : 0; return '<tr><td>' + e[0] + '<div class="bar" style="width:' + pct + '%"></div></td><td>' + e[1] + '</td></tr>'; }).join('') + '</table>'
  + '<h2>Top Referrers</h2><table>' + (topRefs.length ? topRefs.map(function(e) { return '<tr><td>' + e[0] + '</td><td>' + e[1] + '</td></tr>'; }).join('') : '<tr><td colspan="2" style="color:rgba(240,232,218,.4)">No external referrers yet</td></tr>') + '</table>'
  + '<p style="margin-top:2rem;font-size:.72rem;color:rgba(240,232,218,.3)">Total all-time hits: ' + hits.length + '</p>'
  + '</body></html>';

 res.writeHead(200, {'Content-Type': 'text/html'});
 res.end(html);
}

server.listen(PORT, () => {
 console.log('Analytics running on port ' + PORT);
});
