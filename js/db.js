/* Bán Card Thui — db.js
 * Wrapper tối giản cho Supabase PostgREST + Storage, dùng fetch thuần (không dependency).
 * Mọi hàm ném Error với message mô tả khi request thất bại.
 */
(function (root) {
  'use strict';

  function base() {
    if (!root.SUPABASE_URL || !root.SUPABASE_ANON_KEY) {
      throw new Error('Thiếu cấu hình Supabase (js/config.js).');
    }
    return root.SUPABASE_URL.replace(/\/$/, '');
  }
  function key() { return root.SUPABASE_ANON_KEY; }

  // JWT của user đã login (js/auth.js). null = chưa login → dùng anon key như cũ.
  function userToken() {
    try {
      if (root.BCTAuth && root.BCTAuth.accessToken) return root.BCTAuth.accessToken();
    } catch (e) {}
    return null;
  }
  function bearer() {
    var t = userToken();
    return 'Bearer ' + (t || key());
  }

  function authHeaders(extra) {
    var h = {
      'apikey': key(),
      'Authorization': bearer(),
      'Content-Type': 'application/json'
    };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  // Refresh session 1 lần khi gặp 401 và đang có session. Trả về true nếu refresh thành công.
  async function refreshOnce() {
    try {
      if (root.BCTAuth && root.BCTAuth.refresh) return await root.BCTAuth.refresh();
    } catch (e) {}
    return false;
  }

  // Wrapper cho mọi request: build headers tươi mỗi attempt; gặp 401 → refresh 1 lần → retry.
  // buildHeaders: function() trả về headers; opts: method/body/...
  async function req(url, buildHeaders, opts) {
    opts = opts || {};
    for (var attempt = 0; attempt < 2; attempt++) {
      var o = {};
      for (var k in opts) {
        if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
      }
      o.headers = buildHeaders();
      var res = await fetchRetry(url, o);
      if (res.status !== 401 || attempt > 0) return res;
      var ok = await refreshOnce();
      if (!ok) return res;
    }
    return res;
  }

  function errText(status, body) {
    var msg = 'Supabase lỗi HTTP ' + status;
    try {
      var j = JSON.parse(body);
      if (j && (j.message || j.error)) msg += ': ' + (j.message || j.error);
      else if (body) msg += ': ' + String(body).slice(0, 200);
    } catch (e) { if (body) msg += ': ' + String(body).slice(0, 200); }
    return msg;
  }

  function fetchFn() {
    if (typeof fetch !== 'undefined') return fetch;
    throw new Error('Môi trường không hỗ trợ fetch.');
  }

  // Retry khi lỗi mạng (fetch throw) — proxy/mạng chập chờn. Không retry lỗi HTTP (4xx/5xx).
  // Có timeout mỗi attempt để không treo vô hạn khi connection đứng.
  async function fetchRetry(url, opts, tries, timeoutMs) {
    tries = tries || 3;
    timeoutMs = timeoutMs || 20000;
    var lastErr = null;
    for (var i = 0; i < tries; i++) {
      var ctrl = null, timer = null;
      try {
        var o2 = {};
        if (opts) { for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) o2[k] = opts[k]; } }
        if (typeof AbortController !== 'undefined') {
          ctrl = new AbortController();
          o2.signal = ctrl.signal;
          timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
        }
        var res = await fetchFn()(url, o2);
        if (timer) clearTimeout(timer);
        return res;
      } catch (e) {
        if (timer) clearTimeout(timer);
        lastErr = (e && e.name === 'AbortError')
          ? new Error('Supabase timeout (quá ' + Math.round(timeoutMs / 1000) + 's).')
          : e;
        if (i < tries - 1) await new Promise(function (r) { setTimeout(r, 500 * (i + 1)); });
      }
    }
    throw lastErr;
  }

  // opts: { select='*', eq:{col:val}, neq, gt, gte, lt, lte, like, ilike, order:'col.asc', limit, offset }
  function buildQuery(table, opts) {
    opts = opts || {};
    var p = new URLSearchParams();
    p.set('select', opts.select || '*');
    function filt(op, obj) {
      if (!obj) return;
      Object.keys(obj).forEach(function (col) {
        var v = obj[col];
        if (v === undefined || v === null) return;
        p.append(col, op + '.' + v);
      });
    }
    filt('eq', opts.eq); filt('neq', opts.neq); filt('gt', opts.gt);
    filt('gte', opts.gte); filt('lt', opts.lt); filt('lte', opts.lte);
    if (opts.like) Object.keys(opts.like).forEach(function (c) { p.append(c, 'like.' + opts.like[c]); });
    if (opts.ilike) Object.keys(opts.ilike).forEach(function (c) { p.append(c, 'ilike.' + opts.ilike[c]); });
    if (opts.order) p.set('order', opts.order);
    if (opts.limit != null) p.set('limit', String(opts.limit));
    if (opts.offset != null) p.set('offset', String(opts.offset));
    return base() + '/rest/v1/' + table + '?' + p.toString();
  }

  async function q(table, opts) {
    var res = await req(buildQuery(table, opts), function () { return authHeaders(); });
    var text = await res.text();
    if (!res.ok) throw new Error(errText(res.status, text));
    try { return JSON.parse(text); } catch (e) { throw new Error('Supabase trả về không phải JSON.'); }
  }

  async function ins(table, rows, opts) {
    opts = opts || {};
    var returning = opts.returning === false ? 'minimal' : 'representation';
    var res = await req(base() + '/rest/v1/' + table,
      function () { return authHeaders({ 'Prefer': 'return=' + returning }); },
      { method: 'POST', body: JSON.stringify(rows) });
    var text = await res.text();
    if (!res.ok) throw new Error(errText(res.status, text));
    if (returning === 'minimal') return null;
    try { return JSON.parse(text); } catch (e) { throw new Error('Supabase trả về không phải JSON.'); }
  }

  // filters: {col: val} → PATCH ?col=eq.val (cần ít nhất 1 filter để tránh update toàn bảng)
  async function upd(table, patch, filters) {
    var keys = filters ? Object.keys(filters) : [];
    if (!keys.length) throw new Error('upd() cần filters để tránh update toàn bảng.');
    var p = new URLSearchParams();
    keys.forEach(function (c) { p.append(c, 'eq.' + filters[c]); });
    var res = await req(base() + '/rest/v1/' + table + '?' + p.toString(),
      function () { return authHeaders({ 'Prefer': 'return=representation' }); },
      { method: 'PATCH', body: JSON.stringify(patch) });
    var text = await res.text();
    if (!res.ok) throw new Error(errText(res.status, text));
    try { return JSON.parse(text); } catch (e) { return []; }
  }

  async function del(table, filters) {
    var keys = filters ? Object.keys(filters) : [];
    if (!keys.length) throw new Error('del() cần filters để tránh xóa toàn bảng.');
    var p = new URLSearchParams();
    keys.forEach(function (c) { p.append(c, 'eq.' + filters[c]); });
    var res = await req(base() + '/rest/v1/' + table + '?' + p.toString(),
      function () { return authHeaders({ 'Prefer': 'return=representation' }); },
      { method: 'DELETE' });
    var text = await res.text();
    if (!res.ok) throw new Error(errText(res.status, text));
    try { return JSON.parse(text); } catch (e) { return []; }
  }

  // Xóa TOÀN BỘ bảng: dùng filter luôn-đúng trên PK (PostgREST bắt buộc có filter).
  // Pass pkCol, ví dụ delAll('cards','id') → ?id=not.is.null
  async function delAll(table, pkCol) {
    var res = await req(base() + '/rest/v1/' + table + '?' + encodeURIComponent(pkCol) + '=not.is.null',
      function () { return authHeaders({ 'Prefer': 'return=minimal' }); },
      { method: 'DELETE' });
    var text = await res.text();
    if (!res.ok) throw new Error(errText(res.status, text));
    return true;
  }

  // Upsert: POST với on_conflict + Prefer resolution=merge-duplicates
  async function upsert(table, rows, onConflict) {
    var url = base() + '/rest/v1/' + table + (onConflict ? '?on_conflict=' + encodeURIComponent(onConflict) : '');
    var res = await req(url,
      function () { return authHeaders({ 'Prefer': 'resolution=merge-duplicates,return=representation' }); },
      { method: 'POST', body: JSON.stringify(rows) });
    var text = await res.text();
    if (!res.ok) throw new Error(errText(res.status, text));
    try { return JSON.parse(text); } catch (e) { throw new Error('Supabase trả về không phải JSON.'); }
  }

  // ---- Storage ----
  async function upload(bucket, path, blob, contentType) {
    var url = base() + '/storage/v1/object/' + bucket + '/' + path;
    var res = await req(url,
      function () {
        var h = { 'apikey': key(), 'Authorization': bearer() };
        if (contentType) h['Content-Type'] = contentType;
        return h;
      },
      { method: 'POST', body: blob });
    var text = await res.text();
    if (!res.ok) throw new Error(errText(res.status, text));
    return publicUrl(bucket, path);
  }

  function publicUrl(bucket, path) {
    return base() + '/storage/v1/object/public/' + bucket + '/' + path;
  }

  // dataURL → Blob (chạy được cả browser lẫn node 18+)
  async function dataURLtoBlob(dataURL) {
    var res = await fetchRetry(dataURL);
    return res.blob();
  }

  var SB = {
    q: q, ins: ins, upd: upd, del: del, delAll: delAll, upsert: upsert,
    upload: upload, publicUrl: publicUrl, dataURLtoBlob: dataURLtoBlob,
    buildQuery: buildQuery
  };

  root.SB = SB;
  if (typeof module !== 'undefined' && module.exports) module.exports = SB;
})(typeof window !== 'undefined' ? window : globalThis);
