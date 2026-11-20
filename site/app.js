/* ES3 only: no let/const, no arrow fn, no forEach, no JSON-only APIs without fallback. */
(function () {
  var D = window.APKDATA, items = [], meta = {}, KEY_STORE = 'apk_key_v1';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function parseJSON(s) {
    if (window.JSON && JSON.parse) { return JSON.parse(s); }
    return eval('(' + s + ')');
  }
  function store(k, v) {
    try { if (v === null) { window.localStorage.removeItem(k); } else { window.localStorage.setItem(k, v); } } catch (e) {}
  }
  function load(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function size(n) {
    if (n >= 1048576) { return (n / 1048576).toFixed(1) + ' MB'; }
    if (n >= 1024) { return Math.round(n / 1024) + ' KB'; }
    return n + ' B';
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(ms) {
    var d = new Date(ms);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function tryKey(key) {
    if (APKCrypto.checkValue(key) !== D.c) { return false; }
    var obj = parseJSON(APKCrypto.decrypt(key, D.nc, D.d));
    items = obj.items || [];
    meta = obj;
    return true;
  }

  function showMain() {
    $('login').style.display = 'none';
    $('main').style.display = 'block';
    $('logout').style.display = 'inline';
    var ageH = (new Date().getTime() - D.g) / 3600000, html;
    html = items.length + ' file &middot; diperbarui ' + fmtDate(D.g);
    if (meta.note) { html += '<br><span class="err">' + esc(meta.note) + '</span>'; }
    if (ageH > 20) {
      $('info').className = 'box small warn';
      html += '<br>Data sudah lama, link download mungkin kedaluwarsa. Coba lagi nanti.';
    }
    $('info').innerHTML = html;
    render('');
  }

  function render(q) {
    var out = [], lastCat = null, i, it, shown = 0;
    q = (q || '').toLowerCase();
    for (i = 0; i < items.length; i++) {
      it = items[i];
      if (q && (it.n + ' ' + (it.t || '')).toLowerCase().indexOf(q) < 0) { continue; }
      if (it.c !== lastCat) { out.push('<h2>' + esc(it.c) + '</h2>'); lastCat = it.c; }
      out.push('<div class="item"><div class="name">' + esc(it.n) + '</div>' +
        '<div class="meta">' + size(it.s) + ' &middot; ' + fmtDate(it.d) + '</div>' +
        (it.t ? '<div class="desc">' + esc(it.t) + '</div>' : '') +
        '<a class="btn" href="' + esc(it.u) + '">Download</a></div>');
      shown++;
    }
    if (!shown) { out.push('<div class="empty">Tidak ada file.</div>'); }
    $('list').innerHTML = out.join('');
  }

  function doLogin() {
    var pw = $('pw').value, btn = $('btnLogin');
    if (!pw) { return false; }
    $('msg').innerHTML = '';
    btn.value = 'Memproses...';
    btn.disabled = true;
    setTimeout(function () {
      var key, ok = false;
      try {
        key = APKCrypto.deriveKey(pw, D.s, D.it);
        ok = tryKey(key);
      } catch (e) { ok = false; }
      btn.value = 'Masuk';
      btn.disabled = false;
      if (ok) {
        if ($('remember').checked) { store(KEY_STORE, D.s + ':' + APKCrypto.bytesToHex(key)); }
        $('pw').value = '';
        showMain();
      } else {
        $('msg').innerHTML = 'Password salah.';
      }
    }, 60);
    return false;
  }

  function init() {
    if (!D) { $('msg').innerHTML = 'Data tidak ditemukan.'; return; }
    $('loginForm').onsubmit = doLogin;
    $('q').onkeyup = function () { render(this.value); };
    $('logout').onclick = function () {
      store(KEY_STORE, null);
      items = [];
      $('list').innerHTML = '';
      $('main').style.display = 'none';
      $('logout').style.display = 'none';
      $('login').style.display = 'block';
      return false;
    };
    var saved = load(KEY_STORE), parts;
    if (saved) {
      parts = saved.split(':');
      // salt stays the same between builds unless the password/salt changes
      if (parts[0] === D.s) {
        try { if (tryKey(APKCrypto.hexToBytes(parts[1]))) { showMain(); return; } } catch (e) {}
      }
    }
  }
  init();
})();
