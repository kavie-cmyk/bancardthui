/* Bán Card Thui — auth.js
 * Magic-link login qua Supabase Auth, thuần fetch (không dependency).
 * Session lưu trong localStorage (key 'bct_session'): {access_token, refresh_token, expires_at (ms)}.
 * Không bao giờ log token/anon key.
 */
(function (root) {
  'use strict';

  var SESSION_KEY = 'bct_session';
  var SKEW_MS = 60 * 1000; // trừ hao 60s khi check hết hạn

  // ---- storage adapter: localStorage ở browser, in-memory khi chạy node test ----
  var mem = {};
  var memStore = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; }
  };
  function store() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* private mode / node */ }
    return memStore;
  }

  function base() {
    if (!root.SUPABASE_URL) throw new Error('Thiếu cấu hình Supabase (js/config.js).');
    return root.SUPABASE_URL.replace(/\/$/, '');
  }
  function key() {
    if (!root.SUPABASE_ANON_KEY) throw new Error('Thiếu cấu hình Supabase (js/config.js).');
    return root.SUPABASE_ANON_KEY;
  }

  function loadSession() {
    try {
      var raw = store().getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && s.access_token && s.refresh_token) return s;
    } catch (e) { /* corrupt → coi như chưa login */ }
    return null;
  }

  function saveSession(s) {
    try { store().setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function clearSession() {
    try { store().removeItem(SESSION_KEY); } catch (e) {}
  }

  function isValid(s) {
    return !!(s && s.access_token && s.expires_at && s.expires_at > Date.now() + SKEW_MS);
  }

  function isLoggedIn() {
    return isValid(loadSession());
  }

  // Token user để gắn vào Authorization. null = chưa login → caller dùng anon key.
  function accessToken() {
    var s = loadSession();
    return isValid(s) ? s.access_token : null;
  }

  // Đọc #access_token=...&refresh_token=...&expires_in=... sau khi user bấm link trong email.
  // hash: chuỗi location.hash (tham số để test được; mặc định đọc location thật).
  // Trả về true nếu parse + lưu được session.
  function parseSessionFromHash(hash) {
    if (hash === undefined || hash === null) {
      if (typeof location !== 'undefined' && location.hash) hash = location.hash;
      else return false;
    }
    hash = String(hash).replace(/^#/, '');
    if (!hash) return false;
    var params = {};
    hash.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      var k = kv.slice(0, i), v = kv.slice(i + 1);
      try { params[decodeURIComponent(k)] = decodeURIComponent(v); }
      catch (e) { params[k] = v; }
    });
    if (!params.access_token || !params.refresh_token) return false;
    var expiresIn = parseInt(params.expires_in, 10);
    if (!(expiresIn > 0)) expiresIn = 3600;
    saveSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
      expires_at: Date.now() + expiresIn * 1000
    });
    // Xóa hash khỏi URL cho sạch, không reload trang
    try {
      if (typeof history !== 'undefined' && history.replaceState && typeof location !== 'undefined') {
        history.replaceState(null, '', location.pathname + location.search);
      }
    } catch (e) {}
    return true;
  }

  // Gửi magic link. Ném Error tiếng Việt khi fail.
  async function requestMagicLink(email) {
    email = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Email chưa đúng định dạng.');
    }
    var res = await fetch(base() + '/auth/v1/otp', {
      method: 'POST',
      headers: { 'apikey': key(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, create_user: false })
    });
    if (!res.ok) {
      var msg = 'Không gửi được link đăng nhập.';
      var rawMsg = '';
      try {
        var j = await res.json();
        if (j && (j.msg || j.message || j.error_description)) rawMsg = String(j.msg || j.message || j.error_description);
      } catch (e) { msg += ' (HTTP ' + res.status + ')'; }
      if (res.status === 429 || /rate limit/i.test(rawMsg)) {
        throw new Error('Supabase đang tạm chặn gửi email đăng nhập vì đã gửi quá nhiều trong giờ qua (hạn mức mặc định của gói free rất thấp). Đợi khoảng 30–60 phút rồi thử lại 1 lần; muốn hết hẳn thì cần nâng hạn mức / gắn SMTP riêng trong Supabase.');
      }
      if (rawMsg) msg += ' ' + rawMsg;
      throw new Error(msg);
    }
    return true;
  }

  // Refresh access token 1 lần. Trả về true nếu có session mới, false nếu không refresh được.
  async function refresh() {
    var s = loadSession();
    if (!s || !s.refresh_token) return false;
    try {
      var res = await fetch(base() + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'apikey': key(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!res.ok) { clearSession(); return false; }
      var j = await res.json();
      if (!j || !j.access_token) { clearSession(); return false; }
      var expiresIn = parseInt(j.expires_in, 10);
      if (!(expiresIn > 0)) expiresIn = 3600;
      saveSession({
        access_token: j.access_token,
        refresh_token: j.refresh_token || s.refresh_token,
        expires_at: Date.now() + expiresIn * 1000
      });
      return true;
    } catch (e) {
      return false; // lỗi mạng: giữ session cũ để lần sau thử lại
    }
  }

  var BCTAuth = {
    SESSION_KEY: SESSION_KEY,
    loadSession: loadSession,
    saveSession: saveSession,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn,
    accessToken: accessToken,
    parseSessionFromHash: parseSessionFromHash,
    requestMagicLink: requestMagicLink,
    refresh: refresh
  };

  root.BCTAuth = BCTAuth;
  if (typeof module !== 'undefined' && module.exports) module.exports = BCTAuth;
})(typeof window !== 'undefined' ? window : globalThis);
