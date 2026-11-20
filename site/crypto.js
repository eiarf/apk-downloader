/* ES3-compatible SHA-256 + stream cipher. Works on Android 2.x WebView. */
var APKCrypto = (function () {
  var K = [], H0 = [];
  (function () {
    var n = 2, found = 0, i, isPrime;
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    while (found < 64) {
      isPrime = true;
      for (i = 2; i * i <= n; i++) { if (n % i === 0) { isPrime = false; break; } }
      if (isPrime) {
        if (found < 8) { H0[found] = frac(Math.pow(n, 1 / 2)); }
        K[found] = frac(Math.pow(n, 1 / 3));
        found++;
      }
      n++;
    }
  })();

  function sha256(bytes) {
    var H = H0.slice(0), m = bytes.slice(0), l = bytes.length, bits = l * 8;
    var W = new Array(64), i, j, a, b, c, d, e, f, g, h, t1, t2, x, y;
    m.push(0x80);
    while (m.length % 64 !== 56) { m.push(0); }
    m.push(0, 0, 0, 0, (bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);
    for (i = 0; i < m.length; i += 64) {
      for (j = 0; j < 16; j++) {
        W[j] = (m[i + j * 4] << 24) | (m[i + j * 4 + 1] << 16) | (m[i + j * 4 + 2] << 8) | m[i + j * 4 + 3];
      }
      for (j = 16; j < 64; j++) {
        x = W[j - 15]; y = W[j - 2];
        W[j] = (W[j - 16] +
          (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) +
          W[j - 7] +
          (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10))) | 0;
      }
      a = H[0]; b = H[1]; c = H[2]; d = H[3]; e = H[4]; f = H[5]; g = H[6]; h = H[7];
      for (j = 0; j < 64; j++) {
        t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) +
          ((e & f) ^ (~e & g)) + K[j] + W[j]) | 0;
        t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) +
          ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = [];
    for (i = 0; i < 8; i++) {
      out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
    }
    return out;
  }

  function utf8Bytes(s) {
    var bin = unescape(encodeURIComponent(s)), out = [], i;
    for (i = 0; i < bin.length; i++) { out.push(bin.charCodeAt(i)); }
    return out;
  }
  function bytesToUtf8(bytes) {
    var parts = [], i, CH = 1024;
    for (i = 0; i < bytes.length; i += CH) {
      parts.push(String.fromCharCode.apply(null, bytes.slice(i, i + CH)));
    }
    return decodeURIComponent(escape(parts.join('')));
  }
  function hexToBytes(h) {
    var out = [], i;
    for (i = 0; i < h.length; i += 2) { out.push(parseInt(h.substr(i, 2), 16)); }
    return out;
  }
  function bytesToHex(b) {
    var s = '', i, x;
    for (i = 0; i < b.length; i++) { x = b[i].toString(16); s += (x.length < 2 ? '0' : '') + x; }
    return s;
  }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64ToBytes(s) {
    var out = [], buf = 0, n = 0, i, v;
    for (i = 0; i < s.length; i++) {
      v = B64.indexOf(s.charAt(i));
      if (v < 0) { continue; }
      buf = (buf << 6) | v; n += 6;
      if (n >= 8) { n -= 8; out.push((buf >> n) & 255); }
    }
    return out;
  }

  function deriveKey(password, saltHex, iterations) {
    var salt = hexToBytes(saltHex), k = sha256(utf8Bytes(password).concat(salt)), i;
    for (i = 1; i < iterations; i++) { k = sha256(k.concat(salt)); }
    return k;
  }
  function checkValue(key) {
    return bytesToHex(sha256(key.concat(utf8Bytes('check'))).slice(0, 8));
  }
  function decrypt(key, nonceHex, b64) {
    var ct = b64ToBytes(b64), out = new Array(ct.length), base = key.concat(hexToBytes(nonceHex)), blk, ks, i, j;
    for (blk = 0; blk * 32 < ct.length; blk++) {
      ks = sha256(base.concat([(blk >>> 24) & 255, (blk >>> 16) & 255, (blk >>> 8) & 255, blk & 255]));
      for (j = 0; j < 32 && blk * 32 + j < ct.length; j++) {
        i = blk * 32 + j;
        out[i] = ct[i] ^ ks[j];
      }
    }
    return bytesToUtf8(out);
  }

  return {
    sha256: sha256, deriveKey: deriveKey, checkValue: checkValue, decrypt: decrypt,
    bytesToHex: bytesToHex, hexToBytes: hexToBytes, utf8Bytes: utf8Bytes
  };
})();
if (typeof module !== 'undefined') { module.exports = APKCrypto; }
