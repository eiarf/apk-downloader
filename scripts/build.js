// Build script: fetch attachments from Discord channel(s), encrypt the list with the
// site password, and write static site to ./dist. Node 18+ (uses global fetch).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const CHANNELS = (process.env.DISCORD_CHANNEL_ID || '').split(/[\s,]+/).filter(Boolean);
const PASSWORD = process.env.SITE_PASSWORD || '';
const EXT = new RegExp('\\.(' + (process.env.FILE_EXT || 'apk,xapk,apks,apkm,zip,obb').split(',').join('|') + ')$', 'i');
const ITER = parseInt(process.env.KDF_ITER || '2000', 10);
const MAX_MSG = parseInt(process.env.MAX_MESSAGES || '3000', 10);

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');

const sha = (b) => crypto.createHash('sha256').update(b).digest();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch('https://discord.com/api/v10' + p, {
      headers: { Authorization: 'Bot ' + TOKEN, 'User-Agent': 'DiscordBot (apk-downloader, 1.0)' },
    });
    if (res.status === 429) {
      const j = await res.json().catch(() => ({}));
      await sleep(((j.retry_after || 1) * 1000) + 250);
      continue;
    }
    if (!res.ok) throw new Error(`Discord API ${p} -> ${res.status} ${await res.text()}`);
    return res.json();
  }
  throw new Error('Discord API rate limited too many times: ' + p);
}

async function fetchChannel(id) {
  const ch = await api(`/channels/${id}`);
  const out = [];
  let before = null;
  let count = 0;
  while (count < MAX_MSG) {
    const batch = await api(`/channels/${id}/messages?limit=100${before ? '&before=' + before : ''}`);
    if (!batch.length) break;
    count += batch.length;
    for (const m of batch) {
      for (const a of m.attachments || []) {
        if (!EXT.test(a.filename)) continue;
        out.push({
          n: a.filename,
          s: a.size,
          u: a.url,
          d: Date.parse(m.timestamp),
          t: (m.content || '').replace(/\s+/g, ' ').trim().slice(0, 300),
          c: ch.name || id,
        });
      }
    }
    before = batch[batch.length - 1].id;
    if (batch.length < 100) break;
  }
  return out;
}

function encrypt(obj) {
  const salt = sha('apk-site-salt:' + (process.env.SITE_SALT || process.env.GITHUB_REPOSITORY || 'local')).subarray(0, 16);
  let key = sha(Buffer.concat([Buffer.from(PASSWORD, 'utf8'), salt]));
  for (let i = 1; i < ITER; i++) key = sha(Buffer.concat([key, salt]));
  const check = sha(Buffer.concat([key, Buffer.from('check')])).subarray(0, 8).toString('hex');
  const nonce = crypto.randomBytes(16);
  const pt = Buffer.from(JSON.stringify(obj), 'utf8');
  const ct = Buffer.alloc(pt.length);
  for (let blk = 0; blk * 32 < pt.length; blk++) {
    const ctr = Buffer.alloc(4);
    ctr.writeUInt32BE(blk);
    const ks = sha(Buffer.concat([key, nonce, ctr]));
    for (let j = 0; j < 32 && blk * 32 + j < pt.length; j++) ct[blk * 32 + j] = pt[blk * 32 + j] ^ ks[j];
  }
  return { v: 1, it: ITER, s: salt.toString('hex'), c: check, nc: nonce.toString('hex'), d: ct.toString('base64'), g: Date.now() };
}

async function main() {
  if (!PASSWORD) throw new Error('SITE_PASSWORD belum di-set.');
  let items = [];
  let note = '';
  if (process.env.DEMO) {
    for (let i = 0; i < 40; i++) {
      items.push({ n: `Aplikasi-${i}_v1.${i}.apk`, s: 1000000 + i * 54321, u: 'https://example.com/a' + i + '.apk?ex=abc&hm=def',
        d: Date.now() - i * 3600e3, t: i % 3 ? 'Versi lama, ringan untuk Android 4 — ✓ <b>tes</b>' : '', c: i < 20 ? 'apk-utama' : 'game' });
    }
  } else if (!TOKEN || !CHANNELS.length) {
    note = 'Discord belum dikonfigurasi (DISCORD_BOT_TOKEN / DISCORD_CHANNEL_ID).';
    console.warn(note);
  } else {
    for (const id of CHANNELS) {
      const got = await fetchChannel(id);
      console.log(`Channel ${id}: ${got.length} file`);
      items = items.concat(got);
    }
  }
  // keep channel order, newest first inside each channel
  const chIdx = {};
  items.forEach((it) => { if (!(it.c in chIdx)) chIdx[it.c] = Object.keys(chIdx).length; });
  items.sort((a, b) => (chIdx[a.c] - chIdx[b.c]) || (b.d - a.d));

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  for (const f of fs.readdirSync(SITE)) fs.copyFileSync(path.join(SITE, f), path.join(DIST, f));
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
  const data = encrypt({ items, note });
  fs.writeFileSync(path.join(DIST, 'data.js'), 'window.APKDATA=' + JSON.stringify(data) + ';\n');
  console.log(`OK: ${items.length} file ditulis ke dist/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
