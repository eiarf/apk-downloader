# APK Downloader (ramah Android 2–4)

Website statis untuk download APK, file diambil dari channel Discord, dilindungi password,
di-host di GitHub Pages.

## Cara kerja
1. GitHub Actions jalan tiap 6 jam (dan saat push / manual).
2. Script `scripts/build.js` membaca semua pesan di channel Discord memakai **bot**, mengambil
   attachment `.apk/.xapk/.apks/.apkm/.zip/.obb`.
3. Daftar file (termasuk link Discord) **dienkripsi** dengan password, lalu di-deploy ke Pages.
   Repo publik pun tidak membocorkan link, karena data hanya ada di hasil build.
4. Di HP, password dipakai untuk membuka daftar (JavaScript ES3, jalan di WebView Android 2.x).

Link attachment Discord punya masa berlaku (~24 jam), makanya situs di-build ulang tiap 6 jam.

## Setup Discord bot
1. https://discord.com/developers/applications → New Application → **Bot** → Reset Token (salin).
2. Di tab Bot, aktifkan **MESSAGE CONTENT INTENT** (wajib, tanpa ini attachment kosong).
3. OAuth2 → URL Generator → scope `bot`, permission `View Channels` + `Read Message History`.
   Buka URL-nya dan undang bot ke server.
4. Discord → Settings → Advanced → Developer Mode ON. Klik kanan channel → **Copy Channel ID**.

## Secrets repo (Settings → Secrets and variables → Actions)
| Nama | Isi |
|---|---|
| `DISCORD_BOT_TOKEN` | token bot |
| `DISCORD_CHANNEL_ID` | ID channel, boleh beberapa dipisah koma (tiap channel = kategori) |
| `SITE_PASSWORD` | password website |

Atau via CLI:
```
gh secret set DISCORD_BOT_TOKEN
gh secret set DISCORD_CHANNEL_ID --body "123456789012345678"
gh secret set SITE_PASSWORD
gh workflow run "Build & Deploy"
```

## Tes lokal
```
$env:SITE_PASSWORD="tes"; $env:DEMO="1"; node scripts/build.js
# buka dist/index.html
```

## Catatan
- Teks pesan Discord tempat file diupload dipakai sebagai deskripsi.
- GitHub mematikan jadwal (cron) jika repo tidak ada aktivitas 60 hari; jalankan manual / push sesuatu.
