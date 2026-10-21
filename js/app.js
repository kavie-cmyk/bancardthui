/* Bán Card Thui — app.js : router + views (không build step) */
(function () {
  'use strict';
  var BCT = window.BCT;

  /* ---------- icons (inline SVG, không emoji) ---------- */
  var IC = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.6 13.4L13.4 20.6a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h14v18l-2.3-1.5L14.4 21l-2.4-1.5L9.6 21l-2.3-1.5L5 21V3z"/><path d="M9 8h6M9 12h6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l10 17H2L12 3z"/><path d="M12 10v4m0 3v.5"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c-.7-1-1.8-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 2.9 6 1.4 6 4.3 0 1.3-1.3 2.2-3 2.2-1.2 0-2.3-.5-3-1.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3.2"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 015 .9c0 1.7-2.4 2-2.4 3.6M12 17v.5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3l4 4L8 20l-5 1 1-5L17 3z"/></svg>'
  };

  /* ---------- auth: magic link ---------- */
  function chromeVisible(on) {
    ['nav', 'seed-pill', 'btn-seed-toggle', 'btn-export', 'btn-logout'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = !on;
    });
  }

  function renderLogin(sent) {
    chromeVisible(false);
    document.getElementById('brand-icon').innerHTML = IC.card;
    var app = document.getElementById('app');
    app.innerHTML =
      '<div class="login-wrap">' +
      '  <div class="panel login-panel">' +
      '    <div class="login-mark">' + IC.card + '</div>' +
      '    <h2 class="login-title">Bán Card <em>Thui</em></h2>' +
      '    <p class="login-sub">Kho card của Bự — đăng nhập để mở két.</p>' +
      (sent
        ? '<div class="login-sent">' +
          '<div class="login-sent-title">Đã gửi link đăng nhập!</div>' +
          '<p class="panel-note">Kiểm tra email (cả mục spam), bấm vào link để vào app.</p>' +
          '<p class="panel-note">Link hết hạn sau 1 giờ.</p></div>'
        : '<form id="login-form">' +
          '  <div class="field">' +
          '    <label for="login-email">Email</label>' +
          '    <input type="email" id="login-email" placeholder="email của Bự" autocomplete="email" required>' +
          '  </div>' +
          '  <div class="form-err" id="login-err" hidden></div>' +
          '  <div class="form-actions"><button type="submit" class="btn" id="login-btn">Gửi link đăng nhập</button></div>' +
          '  <p class="panel-note">Không cần mật khẩu — link đăng nhập gửi qua email, bấm vào là vào.</p>' +
          '</form>') +
      '  </div>' +
      '</div>';
    if (!sent) {
      var form = document.getElementById('login-form');
      var err = document.getElementById('login-err');
      var btn = document.getElementById('login-btn');
      form.onsubmit = function (ev) {
        ev.preventDefault();
        err.hidden = true;
        var email = document.getElementById('login-email').value.trim();
        btn.disabled = true; btn.textContent = 'Đang gửi…';
        window.BCTAuth.requestMagicLink(email).then(function () {
          renderLogin(true);
        }).catch(function (e) {
          err.textContent = e.message; err.hidden = false;
          btn.disabled = false; btn.textContent = 'Gửi link đăng nhập';
        });
      };
      document.getElementById('login-email').focus();
    }
  }

  function logout() {
    window.BCTAuth.clearSession();
    S = null;
    location.hash = '#/dashboard';
    render();
  }

  /* ---------- state ---------- */
  var S;
  async function boot() {
    window.BCTAuth.parseSessionFromHash();
    if (!window.BCTAuth.isLoggedIn()) {
      renderLogin(false);
      return;
    }
    showLoading(true);
    try {
      S = await BCT.load();
      if (S._justSeeded) setSeededUI(true);
    } catch (e) {
      showLoading(false);
      chromeVisible(true);
      renderNav('#/dashboard');
      document.getElementById('app').innerHTML =
        '<div class="empty"><h3>Không kết nối được Supabase</h3><p>' + BCT.esc(e.message) + '</p>' +
        '<p class="panel-note">Kiểm tra mạng rồi tải lại trang.</p></div>';
      return;
    }
    showLoading(false);
    render();
    bindGlobalButtons();
  }

  function bindGlobalButtons() {
    var exp = document.getElementById('btn-export');
    if (exp && !exp.dataset.bound) {
      exp.dataset.bound = '1';
      exp.onclick = function () {
        withLoading(async function () {
          var data = await BCT.exportJSON();
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'bancardthui-backup-' + BCT.todayISO() + '.json';
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
          toast('Đã xuất backup JSON.');
        }).catch(function (err) { toast(err.message); });
      };
    }
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------- loading overlay ---------- */
  function showLoading(on) {
    var el = document.getElementById('loading');
    if (el) el.hidden = !on;
  }
  async function withLoading(fn) {
    showLoading(true);
    try { return await fn(); }
    finally { showLoading(false); }
  }

  /* ---------- cờ dữ liệu mẫu (chỉ UI, lưu local) ---------- */
  var SEED_FLAG = 'bct_seed_ui';
  function isSeededUI() {
    try { return localStorage.getItem(SEED_FLAG) === '1'; } catch (e) { return false; }
  }
  function setSeededUI(v) {
    try { if (v) localStorage.setItem(SEED_FLAG, '1'); else localStorage.removeItem(SEED_FLAG); } catch (e) {}
  }

  /* ---------- ảnh: fallback chain TCGdex CDN → placeholder ---------- */
  window.__imgFb = function (el) {
    var fb = el.getAttribute('data-fb');
    if (fb) { el.removeAttribute('data-fb'); el.src = fb; }
    else { el.onerror = null; el.src = BCT.placeholderImage(); }
  };
  // Thẻ <img> cho card: ảnh upload → TCGdex CDN (low/high) → onerror thử URL dự phòng → placeholder
  function cardImgTag(card, quality, cls, alt) {
    var up = (card.images && card.images.length) ? card.images[0] : null;
    var url = up || BCT.cardImageURL(card, quality);
    if (!url) return '';
    var fbAttr = '';
    if (!up) {
      var fb = BCT.cardImageFallbackURL(card, quality);
      if (fb) fbAttr = ' data-fb="' + fb + '"';
    }
    return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + url + '"' + fbAttr +
      ' alt="' + BCT.esc(alt || card.name) + '" loading="lazy" onerror="__imgFb(this)">';
  }

  function parseVND(str) {
    return Math.round(Number(String(str).replace(/[^\d]/g, '')) || 0);
  }

  function lotById(id) {
    for (var i = 0; i < S.lots.length; i++) if (S.lots[i].id === id) return S.lots[i];
    return null;
  }

  /* ---------- nav ---------- */
  var NAV = [
    { path: '#/dashboard', label: 'Tổng quan', icon: IC.grid },
    { path: '#/kho', label: 'Kho card', icon: IC.box },
    { path: '#/sets', label: 'Bộ sưu tập', icon: IC.layers },
    { path: '#/nhap', label: 'Nhập kho', icon: IC.plus },
    { path: '#/ban', label: 'Bán hàng', icon: IC.tag },
    { path: '#/rao', label: 'Rao bán', icon: IC.coin },
    { path: '#/donhang', label: 'Đơn hàng', icon: IC.receipt }
  ];

  function renderNav(active) {
    document.getElementById('nav').hidden = false;
    var exp0 = document.getElementById('btn-export'); if (exp0) exp0.hidden = false;
    var lob = document.getElementById('btn-logout');
    if (lob) {
      lob.hidden = false;
      if (!lob.dataset.bound) {
        lob.dataset.bound = '1';
        lob.onclick = function () {
          if (!confirm('Đăng xuất khỏi app?')) return;
          logout();
        };
      }
    }
    document.getElementById('nav').innerHTML = NAV.map(function (n) {
      var on = active === n.path || (n.path !== '#/dashboard' && active.indexOf(n.path) === 0 && active !== '#/dashboard');
      return '<a href="' + n.path + '" class="' + (on ? 'active' : '') + '">' + n.icon + n.label + '</a>';
    }).join('');
    document.getElementById('brand-icon').innerHTML = IC.card;
    var pill = document.getElementById('seed-pill');
    var btn = document.getElementById('btn-seed-toggle');
    if (isSeededUI()) {
      pill.hidden = false; btn.hidden = false; btn.textContent = 'Xóa dữ liệu mẫu';
      btn.onclick = function () {
        if (!confirm('Xóa toàn bộ dữ liệu mẫu và bắt đầu kho trống?')) return;
        withLoading(async function () {
          S = await BCT.wipeAll();
          setSeededUI(false);
          toast('Đã xóa dữ liệu mẫu.');
          location.hash = '#/dashboard'; render();
        }).catch(function (err) { toast(err.message); });
      };
    } else {
      pill.hidden = true; btn.hidden = false; btn.textContent = 'Nạp dữ liệu mẫu';
      btn.onclick = function () {
        if (!confirm('Nạp bộ dữ liệu mẫu (9 card, 10 đơn)? Dữ liệu hiện tại sẽ bị thay thế.')) return;
        withLoading(async function () {
          S = await BCT.reseed();
          setSeededUI(true);
          toast('Đã nạp dữ liệu mẫu.');
          location.hash = '#/dashboard'; render();
        }).catch(function (err) { toast(err.message); });
      };
    }
  }

  /* ---------- router ---------- */
  function route() {
    var h = location.hash || '#/dashboard';
    var parts = h.replace(/^#\//, '').split('?');
    var segs = parts[0].split('/').filter(Boolean);
    var query = {};
    if (parts[1]) parts[1].split('&').forEach(function (kv) {
      var p = kv.split('='); query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    return { segs: segs, query: query, raw: h };
  }

  function render() {
    if (!window.BCTAuth.isLoggedIn()) { renderLogin(false); return; }
    var r = route();
    var base = r.segs[0] || 'dashboard';
    closeSlotPanel();
    renderNav('#/' + base);
    var app = document.getElementById('app');
    window.scrollTo(0, 0);
    if (base === 'dashboard') app.innerHTML = vDashboard();
    else if (base === 'kho') app.innerHTML = (r.segs[1] && r.segs[2] === 'edit') ? vCardEdit(r.segs[1]) : (r.segs[1] ? vCardDetail(r.segs[1]) : vKho());
    else if (base === 'sets') app.innerHTML = r.segs[1] === 'manage' ? vSetManage(r.query) : (r.segs.length > 1 ? vSetDetail(decodeURIComponent(r.segs.slice(1).join('/'))) : vSets());
    else if (base === 'nhap') app.innerHTML = vNhap(r.query);
    else if (base === 'ban') app.innerHTML = vBan(r.query.card || '');
    else if (base === 'rao') app.innerHTML = vListings(r.query);
    else if (base === 'donhang') app.innerHTML = r.segs[1] ? vOrderDetail(r.segs[1]) : vDonHang();
    else app.innerHTML = vDashboard();
    bind(base, r);
  }
  window.addEventListener('hashchange', render);

  /* ================= VIEW: DASHBOARD ================= */
  function vDashboard() {
    var t = BCT.totals(S);
    var series = BCT.weeklySeries(S, 8);
    var top = BCT.topSellers(S, 5);
    var slow = BCT.slowMovers(S, 5);
    var low = BCT.lowStock(S, 2);
    var profitCls = t.profit >= 0 ? 'green' : 'red';
    var topCard = top.length ? top[0].card : null;

    var html = '';
    html += '<section class="hero"><div class="hero-copy">';
    html += '<div class="hero-kicker">Kho bài Pokémon của Bự</div>';
    html += '<h1 class="hero-title">Lãi/lỗ thực tế <span class="num ' + (t.profit >= 0 ? 'pos' : 'neg') + '">' + (t.profit >= 0 ? '+' : '−') + BCT.fmtVND(Math.abs(t.profit)) + '</span></h1>';
    html += '<p class="hero-sub">Tính theo giá vốn FIFO từng lô nhập — cùng 1 card nhập 2 đợt giá khác nhau vẫn ra lãi chuẩn từng đơn.</p>';
    html += '</div>';
    html += '<div class="foil-card"><div class="fc-inner">' + IC.card.replace('<svg', '<svg width="40" height="40"') +
      '<div class="fc-name">' + BCT.esc(topCard ? topCard.name : 'Vault') + '</div><div class="fc-tag">BEST SELLER</div></div></div>';
    html += '</section>';

    html += '<section class="kpis">';
    html += kpi('Tổng thẻ tồn kho', '<span class="mono">' + t.stock.toLocaleString('vi-VN') + '</span> <span style="font-size:14px;color:var(--muted)">thẻ</span>', '', t.orders + ' đơn đã bán · ' + t.sold.toLocaleString('vi-VN') + ' thẻ');
    html += kpi('Vốn đang ôm', BCT.fmtVND(t.capital), 'gold', 'tiền nằm trong kho hiện tại');
    html += kpi('Doanh thu', BCT.fmtVND(t.revenue), '', 'chưa trừ vốn & phí');
    html += kpi('Lãi / lỗ', (t.profit >= 0 ? '+' : '−') + BCT.fmtVND(Math.abs(t.profit)), profitCls, 'sau vốn FIFO + phí sàn + ship');
    html += '</section>';

    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Doanh thu & lãi 8 tuần gần nhất</h2>';
    html += '<div class="legend"><span><i style="background:#e8b44a"></i>Doanh thu</span><span><i style="background:#8fd694"></i>Lãi</span></div></div>';
    html += '<div class="chart-wrap">' + barChart(series) + '</div></section>';

    html += '<div class="grid-2">';
    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Top card bán chạy</h2></div>' + topList(top) + '</section>';
    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Tồn lâu & sắp hết</h2></div>' + slowAndLow(slow, low) + '</section>';
    html += '</div>';

    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Hoạt động gần đây</h2></div>' + recentActivity() + '</section>';
    return html;
  }

  function kpi(label, value, cls, hint) {
    return '<div class="kpi ' + cls + '"><div class="kpi-label">' + label + '</div>' +
      '<div class="kpi-value ' + cls + '">' + value + '</div>' +
      (hint ? '<div class="kpi-hint">' + hint + '</div>' : '') + '</div>';
  }

  function barChart(series) {
    var W = 720, H = 280, padL = 56, padB = 30, padT = 18;
    var max = 1;
    series.forEach(function (s) { max = Math.max(max, s.revenue); });
    var cw = (W - padL - 14) / series.length;
    var bw = Math.min(26, cw * 0.28);
    var html = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
    for (var g = 0; g <= 4; g++) {
      var y = padT + (H - padT - padB) * g / 4;
      var val = Math.round(max * (1 - g / 4));
      html += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - 10) + '" y2="' + y + '" stroke="rgba(255,255,255,0.07)"/>';
      html += '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="#6e6a62" font-family="IBM Plex Mono,monospace">' + shortVND(val) + '</text>';
    }
    series.forEach(function (s, i) {
      var x = padL + cw * i + cw / 2;
      var h1 = (H - padT - padB) * s.revenue / max;
      var h2 = (H - padT - padB) * Math.abs(s.profit) / max;
      var yb = H - padB;
      html += '<g><title>' + s.label + ' — DT ' + BCT.fmtVND(s.revenue) + ', lãi ' + BCT.fmtVND(s.profit) + '</title>';
      html += '<rect x="' + (x - bw - 3) + '" y="' + (yb - h1) + '" width="' + bw + '" height="' + Math.max(h1, 2) + '" rx="4" fill="#e8b44a" opacity="0.92"/>';
      var pc = s.profit >= 0 ? '#8fd694' : '#e07a6a';
      html += '<rect x="' + (x + 3) + '" y="' + (yb - h2) + '" width="' + bw + '" height="' + Math.max(h2, 2) + '" rx="4" fill="' + pc + '" opacity="0.92"/>';
      html += '<text x="' + x + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="#a8a29a" font-family="IBM Plex Mono,monospace">' + s.label + '</text></g>';
    });
    return html + '</svg>';
  }

  function shortVND(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'tr';
    if (n >= 1e3) return Math.round(n / 1e3) + 'k';
    return String(n);
  }

  function topList(top) {
    if (!top.length) return '<div class="empty" style="padding:24px">Chưa có đơn bán nào.</div>';
    return top.map(function (x, i) {
      var c = x.card;
      return '<div class="rowline"><span class="rank">' + (i + 1) + '</span>' +
        cardImgTag(c, 'low', 'thumb') +
        '<div class="grow"><div class="t"><a class="rowlink" href="#/kho/' + c.id + '" style="color:var(--ink);text-decoration:none">' + BCT.esc(c.name) + '</a></div>' +
        '<div class="s">' + BCT.esc(c.set) + '</div></div>' +
        '<div style="text-align:right"><div class="mono" style="font-weight:600">' + x.qty + ' thẻ</div>' +
        '<div class="s mono">' + BCT.fmtVND(x.revenue) + '</div></div></div>';
    }).join('');
  }

  function slowAndLow(slow, low) {
    var html = '';
    low.forEach(function (x) {
      html += '<div class="alert">' + IC.warn + '<div><b>' + BCT.esc(x.card.name) + '</b> chỉ còn <b class="mono">' + x.stock + ' thẻ</b> — cân nhắc nhập thêm hoặc giữ giá.</div></div>';
    });
    if (!slow.length && !low.length) return '<div class="empty" style="padding:24px">Kho đang trống.</div>';
    if (slow.length) {
      html += '<div class="panel-note" style="margin:10px 0 4px">Tồn lâu nhất (ngày từ lô cũ nhất):</div>';
      html += slow.map(function (x) {
        return '<div class="rowline"><div class="grow"><div class="t">' + BCT.esc(x.card.name) + '</div>' +
          '<div class="s">nhập từ ' + BCT.fmtDate(x.oldestDate) + ' · còn ' + x.stock + ' thẻ</div></div>' +
          '<div class="mono" style="color:var(--gold-soft)">' + x.days + ' ngày</div></div>';
      }).join('');
    }
    return html;
  }

  function recentActivity() {
    var evs = [];
    S.orders.forEach(function (o) {
      evs.push({ date: o.date, html: '<b>Đơn ' + BCT.fmtDate(o.date) + '</b> — bán ' + BCT.orderQty(o) + ' thẻ qua ' + BCT.CHANNELS[o.channel] + ' · lãi <b class="mono ' + (BCT.orderProfit(o) >= 0 ? 'pos' : 'neg') + '">' + BCT.fmtVND(BCT.orderProfit(o)) + '</b>', link: '#/donhang/' + o.id });
    });
    S.lots.forEach(function (l) {
      var c = BCT.getCard(S, l.cardId);
      if (c) evs.push({ date: l.importDate, html: '<b>Nhập kho</b> — ' + l.qty + '× ' + BCT.esc(c.name) + ' giá ' + BCT.fmtVND(l.costPerUnit) + '/thẻ', link: '#/kho/' + c.id });
    });
    evs.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    evs = evs.slice(0, 6);
    if (!evs.length) return '<div class="empty" style="padding:24px">Chưa có hoạt động nào.</div>';
    return evs.map(function (e) {
      return '<div class="rowline"><div class="grow"><div class="t" style="font-weight:500;font-size:13.5px">' + e.html + '</div>' +
        '<div class="s">' + BCT.fmtDate(e.date) + '</div></div>' +
        '<a href="' + e.link + '" style="color:var(--gold);font-size:13px;text-decoration:none">Xem →</a></div>';
    }).join('');
  }

  /* ================= VIEW: KHO ================= */
  var khoFilter = { q: '', set: '', rarity: '', sort: 'name', lang: 'all', holo: '', loc: '', misprintOnly: false, gradedOnly: false };

  function langChip(label, val) {
    return '<button type="button" class="chip' + (khoFilter.lang === val ? ' on' : '') + '" data-lang="' + val + '">' + label + '</button>';
  }

  function toggleChip(label, on, attr) {
    return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-toggle="' + attr + '">' + label + '</button>';
  }

  function vKho() {
    var sets = [], rarities = [], holos = [];
    S.cards.forEach(function (c) {
      if (c.set && sets.indexOf(c.set) < 0) sets.push(c.set);
      if (c.rarity && rarities.indexOf(c.rarity) < 0) rarities.push(c.rarity);
    });
    S.lots.forEach(function (l) {
      if (l.qtyRemaining > 0 && l.holoPattern && holos.indexOf(l.holoPattern) < 0) holos.push(l.holoPattern);
    });
    sets.sort(); rarities.sort();

    var html = '<h1 class="page-title">Kho card <button class="icon-btn" id="rarity-help" title="Ký hiệu độ hiếm">' + IC.help + '</button></h1>' +
      '<div class="popover" id="rarity-pop" hidden>' + rarityLegendHTML() + '</div>' +
      '<p class="page-sub">' + S.cards.length + ' loại card · bấm vào từng card để xem lô nhập & lịch sử bán</p>';
    html += '<div class="toolbar">';
    html += '<input type="search" id="f-q" placeholder="Tìm tên, set, mã số…" value="' + BCT.esc(khoFilter.q) + '">';
    html += '<select id="f-set"><option value="">Mọi set</option>' + sets.map(function (s) { return '<option value="' + BCT.esc(s) + '"' + (khoFilter.set === s ? ' selected' : '') + '>' + BCT.esc(s) + '</option>'; }).join('') + '</select>';
    html += '<select id="f-rarity"><option value="">Mọi độ hiếm</option>' + rarities.map(function (s) { return '<option value="' + BCT.esc(s) + '"' + (khoFilter.rarity === s ? ' selected' : '') + '>' + BCT.esc(s) + '</option>'; }).join('') + '</select>';
    html += '<select id="f-sort">' +
      '<option value="name"' + (khoFilter.sort === 'name' ? ' selected' : '') + '>Tên A–Z</option>' +
      '<option value="stock"' + (khoFilter.sort === 'stock' ? ' selected' : '') + '>Tồn kho ↓</option>' +
      '<option value="capital"' + (khoFilter.sort === 'capital' ? ' selected' : '') + '>Vốn đang ôm ↓</option>' +
      '</select>';
    html += '<select id="f-holo"><option value="">Mọi mẫu holo</option>' + holos.map(function (h) { return '<option value="' + BCT.esc(h) + '"' + (khoFilter.holo === h ? ' selected' : '') + '>' + BCT.esc(h) + '</option>'; }).join('') + '</select>';
    html += '<input type="search" id="f-loc" placeholder="Vị trí lưu trữ…" value="' + BCT.esc(khoFilter.loc) + '" style="max-width:170px">';
    html += '<a class="btn secondary" href="#/nhap" style="text-decoration:none">' + IC.plus + ' Nhập kho</a>';
    html += '</div>';
    html += '<div class="chip-row" id="lang-chips">' +
      langChip('Tất cả', 'all') + langChip('EN', 'en') + langChip('JP', 'jp') + langChip('Khác', 'other') +
      toggleChip('Chỉ lá lỗi in', khoFilter.misprintOnly, 'misprint') +
      toggleChip('Đã graded', khoFilter.gradedOnly, 'graded') + '</div>';
    html += '<div class="card-grid" id="card-grid">' + khoCards() + '</div>';
    if (!S.cards.length) html = '<h1 class="page-title">Kho card</h1><div class="empty"><h3>Kho đang trống</h3><p>Bấm "Nhập kho" để thêm card đầu tiên.</p><a class="btn" href="#/nhap" style="text-decoration:none;margin-top:12px">' + IC.plus + ' Nhập kho</a></div>';
    return html;
  }

  function khoCards() {
    var q = khoFilter.q.toLowerCase();
    var list = S.cards.filter(function (c) {
      if (khoFilter.set && c.set !== khoFilter.set) return false;
      if (khoFilter.rarity && c.rarity !== khoFilter.rarity) return false;
      if (khoFilter.lang !== 'all' && (c.language || 'en') !== khoFilter.lang) return false;
      if (khoFilter.holo) {
        var has = S.lots.some(function (l) {
          return l.cardId === c.id && l.qtyRemaining > 0 && l.holoPattern === khoFilter.holo;
        });
        if (!has) return false;
      }
      if (khoFilter.misprintOnly && !c.misprint) return false;
      if (khoFilter.gradedOnly && !c.graded) return false;
      if (khoFilter.loc && (c.storageLocation || '').toLowerCase().indexOf(khoFilter.loc.toLowerCase()) < 0) return false;
      if (q && (c.name + ' ' + c.set + ' ' + c.number + ' ' + (c.storageLocation || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (khoFilter.sort === 'stock') return BCT.stockOf(S, b.id) - BCT.stockOf(S, a.id);
      if (khoFilter.sort === 'capital') return (BCT.stockOf(S, b.id) * BCT.avgCostOf(S, b.id)) - (BCT.stockOf(S, a.id) * BCT.avgCostOf(S, a.id));
      return a.name.localeCompare(b.name);
    });
    if (!list.length) return '<div class="empty" style="grid-column:1/-1"><h3>Không tìm thấy card nào</h3><p>Thử đổi từ khóa hoặc bộ lọc.</p></div>';
    return list.map(function (c) {
      var st = BCT.stockOf(S, c.id);
      var avg = BCT.avgCostOf(S, c.id);
      var langTag = (c.language || 'en') !== 'en' ? '<span class="tag" style="font-size:10px">' + BCT.esc(BCT.LANGUAGES[c.language] || c.language) + '</span>' : '';
      var misTag = c.misprint ? '<span class="misprint-badge">MISPRINT</span>' : '';
      var mktLine = '';
      var rg = BCT.marketRangeVND(c);
      if (rg && rg.count > 0) {
        var tip = (c.priceSources || []).map(function (s) {
          return BCT.sourceLabel(s.source) + ': ' + BCT.fmtPrice(s.price, s.currency);
        }).join(' · ');
        var txt = rg.min === rg.max ? BCT.fmtVNDShort(rg.max)
          : BCT.fmtVNDShort(rg.min) + '–' + BCT.fmtVNDShort(rg.max);
        mktLine = '<div class="pcard-meta mkt-range" title="' + BCT.esc(tip) + '">Giá TK ≈ ' + txt + '</div>';
      }
      return '<a class="pcard" href="#/kho/' + c.id + '">' +
        '<div class="pcard-img">' + cardImgTag(c, 'low', '', c.name) +
        '<span class="qty-badge' + (st === 0 ? ' out' : '') + '">' + st + ' thẻ</span></div>' +
        '<div class="pcard-body"><h3 class="pcard-name">' + BCT.esc(c.name) + ' ' + langTag + misTag + '</h3>' +
        '<div class="pcard-meta">' + BCT.esc(c.set || '—') + (c.number ? ' · ' + BCT.esc(c.number) : '') + (c.storageLocation ? ' · 📦 ' + BCT.esc(c.storageLocation) : '') + '</div>' +
        mktLine +
        '<div class="pcard-stats"><span>Vốn TB <b>' + BCT.fmtVND(avg) + '</b></span><span>Ôm <b>' + BCT.fmtVND(st * avg) + '</b></span></div>' +
        '</div></a>';
    }).join('');
  }

  /* ---------- giá tham khảo (đa nguồn pluggable + nhập tay) ---------- */
  // Dropdown nguồn nhập tay lấy từ config → thêm nguồn mới tự hiện ở đây.
  var MANUAL_SOURCES = BCT.priceSourceDefs().map(function (d) { return [d.key, d.label]; });

  // Ghi chú nguồn auto cho nút "Kéo giá các nguồn", vd "Tự động: Cardmarket, TCGplayer · eBay (sắp có)".
  function priceFetchHint() {
    var defs = BCT.priceSourceDefs();
    var auto = [], soon = [], i;
    for (i = 0; i < defs.length; i++) {
      if (!defs[i].auto) continue;
      if (defs[i].comingSoon) soon.push(defs[i].label + ' (sắp có' + (defs[i].note ? ' — ' + defs[i].note : '') + ')');
      else auto.push(defs[i].label);
    }
    return 'Tự động: ' + (auto.join(', ') || '—') + (soon.length ? ' · ' + soon.join(', ') : '');
  }

  function marketSectionHTML(c) {
    var rows = BCT.marketSourceRows(c);
    var range = BCT.marketRangeVND(c);
    var condName = BCT.condLabel(c.condition);
    var head;
    if (range && range.count > 0) {
      head = '<div class="mkt-price">' +
        (range.min === range.max ? BCT.fmtVND(range.max)
          : BCT.fmtVND(range.min) + ' – ' + BCT.fmtVND(range.max)) +
        '</div><div class="hint">' + range.count + ' nguồn · đã × hệ số Cond ' + BCT.esc(condName) + ' (ước tính)</div>';
    } else if (range) {
      head = '<div class="mkt-price">' + BCT.fmtVND(range.max) + '</div><div class="hint">Giá đã lưu (chưa tách theo nguồn).</div>';
    } else {
      head = '<p class="panel-note">Chưa có giá tham khảo.</p>';
    }
    var list = '';
    if (rows) {
      list = '<div class="mkt-break">' + rows.map(function (r) {
        var upd = r.updated_at ? BCT.fmtDate(String(r.updated_at).slice(0, 10)) : '—';
        var kind = r.kind === 'manual' ? 'nhập tay' : BCT.esc(r.kind || '');
        return '<div class="mkt-src"><b>' + BCT.esc(r.label) + '</b> ' + BCT.fmtPrice(r.price, r.currency) +
          (kind ? ' <span class="hint">(' + kind + ')</span>' : '') +
          '<div class="hint">= ' + BCT.fmtVND(r.vnd) + ' → <b>Cond ' + BCT.esc(condName) + ': ' + BCT.fmtVND(r.vndCond) + '</b> · cập nhật ' + upd + '</div></div>';
      }).join('') + '</div>';
    }
    return '<section class="panel" style="margin-bottom:14px"><div class="panel-head"><h2 class="panel-title">Giá tham khảo</h2></div>' +
      head + list +
      '<div class="form-grid" style="margin-top:10px">' +
      '<div class="field"><label>Kéo tự động (miễn phí)</label>' +
      '<button id="mkt-fetch" class="btn secondary" type="button">Kéo giá các nguồn</button>' +
      '<div class="hint">' + BCT.esc(priceFetchHint()) + '<br>Theo setId + số lá: <span class="mono">' + BCT.esc(c.setId || '—') + '</span> / <span class="mono">' + BCT.esc(c.number || '—') + '</span></div></div>' +
      '<div class="field"><label>Nhập tay (ghi đè nguồn đó)</label>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<select id="mkt-src" style="max-width:130px">' + MANUAL_SOURCES.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select>' +
      '<input id="mkt-price" inputmode="decimal" placeholder="Giá" style="flex:1;min-width:90px">' +
      '<select id="mkt-cur" style="max-width:80px"><option value="EUR">EUR</option><option value="USD">USD</option><option value="JPY">JPY</option></select>' +
      '<button id="mkt-save" class="btn secondary" type="button">Lưu</button></div>' +
      '<div class="hint">VD: nhập tay giá eBay JP bằng JPY rồi Lưu.</div></div>' +
      '</div><div id="mkt-msg" class="hint" style="margin-top:6px"></div></section>';
  }

  function vCardDetail(id) {
    var c = BCT.getCard(S, id);
    if (!c) return '<a class="backlink" href="#/kho">' + IC.back + ' Kho card</a><div class="empty"><h3>Không tìm thấy card</h3></div>';
    var st = BCT.stockOf(S, id);
    var avg = BCT.avgCostOf(S, id);
    var lots = BCT.lotsSorted(S, id);
    var allLots = S.lots.filter(function (l) { return l.cardId === id; })
      .sort(function (a, b) { return a.importDate < b.importDate ? -1 : 1; });
    var hist = BCT.priceHistory(S, id);
    var orders = BCT.ordersOfCard(S, id);
    var lastSell = hist.length ? hist[hist.length - 1].sellPrice : 0;

    var html = '<a class="backlink" href="#/kho">' + IC.back + ' Kho card</a>';
    html += '<div class="detail-head">';
    html += cardImgTag(c, 'high', 'detail-img', c.name);
    html += '<div class="detail-info"><h1>' + BCT.esc(c.name) + '</h1>';
    var setInfo = BCT.resolveSet(S, c);
    var numLabel = c.number ? 'Lá số <b class="mono">' + BCT.esc(c.number) + (setInfo.total ? '/' + setInfo.total : '') + '</b>' : '';
    html += '<div class="meta">' + BCT.esc(setInfo.name || c.set || '') + (numLabel ? ' · ' + numLabel : '') + '</div>';
    if (BCT.isSecretCard(c, setInfo)) html += '<div style="margin-bottom:8px"><span class="secret-tag">SECRET RARE — số vượt tổng set</span></div>';
    html += '<div>' + (c.rarity ? '<span class="tag">' + BCT.esc(c.rarity) + '</span>' : '') +
      '<span class="tag">' + BCT.esc(BCT.condLabel(c.condition)) + '</span>' +
      '<span class="tag">' + BCT.esc(BCT.LANGUAGES[c.language] || 'English') + '</span>' +
      (c.graded ? '<span class="tag">' + c.graded.org + ' ' + c.graded.score + '</span>' : '') +
      (c.misprint ? '<span class="misprint-badge">MISPRINT</span>' : '') + '</div>';
    if (c.storageLocation) html += '<div class="meta" style="margin-top:6px">📦 Vị trí lưu trữ: <b>' + BCT.esc(c.storageLocation) + '</b></div>';
    if (c.graded && (c.certNumber || c.certPop != null)) {
      html += '<div class="meta" style="margin-top:6px">Cert: <b class="mono">' + BCT.esc(c.certNumber || '—') + '</b>' +
        (c.certPop != null ? ' · Pop: <b>' + c.certPop + '</b>' : '') + '</div>';
    }
    html += '<div class="stat-row">' +
      stat('Tồn kho', st + ' thẻ') + stat('Vốn TB', BCT.fmtVND(avg)) +
      stat('Tổng vốn ôm', BCT.fmtVND(st * avg)) + stat('Giá bán gần nhất', lastSell ? BCT.fmtVND(lastSell) : '—') + '</div>';
    html += '<div class="form-actions" style="margin-top:6px">' +
      '<a class="btn secondary" href="#/nhap?card=' + c.id + '" style="text-decoration:none">' + IC.plus + ' Nhập thêm lô</a>' +
      '<a class="btn" href="#/ban?card=' + c.id + '" style="text-decoration:none">' + IC.tag + ' Tạo đơn bán</a>' +
      '<a class="btn secondary" href="#/rao?card=' + c.id + '" style="text-decoration:none">' + IC.coin + ' Rao bán lá này</a>' +
      '<a class="btn secondary" href="#/kho/' + c.id + '/edit" style="text-decoration:none">' + IC.edit + ' Sửa</a>' +
      (setInfo.key && setInfo.key !== '__none__' ? '<a class="btn secondary" href="#/sets/' + encodeURIComponent(setInfo.key) + '" style="text-decoration:none">' + IC.layers + ' Xem trong Bộ sưu tập</a>' : '') +
      '</div>';
    if (c.note) html += '<p style="color:var(--muted);font-size:13px;margin-top:10px">' + BCT.esc(c.note) + '</p>';
    html += '</div></div>';
    html += marketSectionHTML(c);

    html += '<div class="grid-2">';
    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Các lô nhập (' + allLots.length + ')</h2><span class="panel-note">FIFO: bán trừ lô cũ nhất trước</span></div>';
    if (!allLots.length) html += '<p class="panel-note">Chưa có lô nào.</p>';
    else {
      html += '<table class="tbl"><thead><tr><th>Ngày nhập</th><th class="r">Còn lại / Gốc</th><th class="r">Giá cost</th><th>Phiên bản</th><th>Mẫu holo</th><th>Nguồn</th></tr></thead><tbody>';
      allLots.forEach(function (l, i) {
        html += '<tr><td>' + BCT.fmtDate(l.importDate) + (i === 0 && l.qtyRemaining > 0 ? ' <span class="tag" style="font-size:9px">FIFO trước</span>' : '') + '</td>' +
          '<td class="r">' + l.qtyRemaining + ' / ' + l.qty + '</td><td class="r">' + BCT.fmtVND(l.costPerUnit) + '</td>' +
          '<td><span class="tag">' + BCT.esc(l.variant || 'Normal') + '</span></td>' +
          '<td>' + (l.holoPattern ? '<span class="tag" style="border-color:var(--gold-dim)">' + BCT.esc(l.holoPattern) + '</span>' : '<span style="color:var(--muted)">—</span>') + '</td>' +
          '<td>' + BCT.esc(l.source || '—') + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '</section>';

    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Lịch sử giá bán</h2></div>';
    if (!hist.length) html += '<p class="panel-note">Chưa bán lần nào.</p>';
    else {
      html += '<table class="tbl"><thead><tr><th>Ngày</th><th class="r">Giá bán</th><th class="r">SL</th><th>Kênh</th></tr></thead><tbody>';
      hist.forEach(function (h) {
        html += '<tr><td>' + BCT.fmtDate(h.date) + '</td><td class="r">' + BCT.fmtVND(h.sellPrice) + '</td><td class="r">' + h.qty + '</td><td>' + BCT.CHANNELS[h.channel] + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '</section></div>';

    var myListings = BCT.listingsOfCard(S, id);
    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Tin rao bán (' + myListings.length + ')</h2><a class="btn secondary btn-sm" href="#/rao?card=' + c.id + '" style="text-decoration:none">Quản lý rao bán →</a></div>';
    if (!myListings.length) html += '<p class="panel-note">Chưa có tin rao nào cho lá này.</p>';
    else {
      html += '<table class="tbl"><thead><tr><th class="r">Giá rao</th><th class="r">SL</th><th>Kênh</th><th>Trạng thái</th></tr></thead><tbody>';
      myListings.forEach(function (l) {
        html += '<tr><td class="r">' + BCT.fmtVND(l.price) + '</td><td class="r">' + l.qty + '</td><td>' + (l.channel ? BCT.CHANNELS[l.channel] || l.channel : '—') + '</td><td><span class="tag">' + (BCT.LISTING_STATUS_LABELS[l.status] || l.status) + '</span></td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '</section>';

    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Đơn đã bán (' + orders.length + ')</h2></div>';
    if (!orders.length) html += '<p class="panel-note">Chưa có đơn nào chứa card này.</p>';
    else {
      html += '<table class="tbl"><thead><tr><th>Ngày</th><th>Kênh</th><th class="r">SL</th><th class="r">Doanh thu</th><th class="r">Lãi</th><th></th></tr></thead><tbody>';
      orders.forEach(function (o) {
        var q = 0, rev = 0;
        o.items.forEach(function (it) { if (it.cardId === id) { q += it.qty; rev += it.qty * it.sellPrice; } });
        html += '<tr><td>' + BCT.fmtDate(o.date) + '</td><td>' + BCT.CHANNELS[o.channel] + '</td><td class="r">' + q + '</td><td class="r">' + BCT.fmtVND(rev) + '</td><td class="r ' + (BCT.orderProfit(o) >= 0 ? 'pos' : 'neg') + '">' + BCT.fmtVND(BCT.orderProfit(o)) + '</td><td class="r"><a class="rowlink" href="#/donhang/' + o.id + '">Chi tiết →</a></td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '</section>';
    return html;
  }

  function stat(l, v) { return '<div class="st"><div class="l">' + l + '</div><div class="v">' + v + '</div></div>'; }

  /* ---------- legend độ hiếm Pokémon TCG ---------- */
  function rarityLegendHTML() {
    var rows = [
      ['●', 'Common', 'chấm tròn đen'],
      ['◆', 'Uncommon', 'hình thoi đen'],
      ['★', 'Rare', 'sao đen'],
      ['★★', 'Double Rare', '2 sao đen — thẻ ex thường'],
      ['★★', 'Ultra Rare', '2 sao bạc — thẻ V / VMAX / VSTAR'],
      ['★', 'Illustration Rare', 'sao vàng — art đặc biệt'],
      ['★★', 'Special Illustration Rare', '2 sao vàng — alt art'],
      ['★★★', 'Hyper Rare', '3 sao vàng — rainbow/gold'],
      ['★', 'ACE SPEC Rare', 'sao hồng — ACE SPEC'],
      ['PROMO', 'Promo', 'thẻ promo, không thuộc set chính']
    ];
    return '<div class="rarity-legend">' + rows.map(function (r) {
      return '<div class="rl-row"><span class="rl-sym">' + r[0] + '</span><span class="rl-name">' + r[1] + '</span><span class="rl-desc">' + r[2] + '</span></div>';
    }).join('') + '<div class="rl-note">Số thứ tự vượt tổng in trên thẻ (vd 115/114) = <b>secret rare</b> — thẻ hiếm nằm ngoài set chính.</div></div>';
  }

  /* ================= VIEW: BỘ SƯU TẬP (SETS) ================= */
  var setFilter = { sort: 'progress', year: 'all', groupYear: false, lang: 'all' };

  function setLangChip(label, val) {
    return '<button type="button" class="chip' + (setFilter.lang === val ? ' on' : '') + '" data-slang="' + val + '">' + label + '</button>';
  }

  function vSets() {
    var groups = BCT.setGroups(S).filter(function (g) { return g.key !== '__none__' || g.cards.length; });
    // tách nhóm chưa phân loại ra cuối
    var unclassified = groups.filter(function (g) { return g.key === '__none__'; });
    groups = groups.filter(function (g) { return g.key !== '__none__'; });

    if (setFilter.year !== 'all') {
      groups = groups.filter(function (g) {
        var y = g.info.year;
        return setFilter.year === 'unknown' ? y == null : y === Number(setFilter.year);
      });
    }
    if (setFilter.lang !== 'all') {
      groups = groups.filter(function (g) { return BCT.groupLanguage(S, g) === setFilter.lang; });
    }
    var withP = groups.map(function (g) { return { g: g, p: BCT.setProgress(S, g) }; });
    withP.sort(function (a, b) {
      if (setFilter.sort === 'name') return a.g.info.name.localeCompare(b.g.info.name);
      if (setFilter.sort === 'value') return b.p.value - a.p.value;
      var pa = a.p.pct == null ? -1 : a.p.pct, pb = b.p.pct == null ? -1 : b.p.pct;
      return pb - pa;
    });

    var years = [];
    BCT.setGroups(S).forEach(function (g) {
      if (g.info.year != null && years.indexOf(g.info.year) < 0) years.push(g.info.year);
    });
    years.sort(function (a, b) { return b - a; });

    var html = '<h1 class="page-title">Bộ sưu tập</h1><p class="page-sub">Tiến độ sưu tập theo từng set — bấm vào set để xem checklist từng lá</p>';
    html += '<div class="toolbar">';
    html += '<select id="s-sort">' +
      '<option value="progress"' + (setFilter.sort === 'progress' ? ' selected' : '') + '>Tiến độ ↓</option>' +
      '<option value="name"' + (setFilter.sort === 'name' ? ' selected' : '') + '>Tên A–Z</option>' +
      '<option value="value"' + (setFilter.sort === 'value' ? ' selected' : '') + '>Giá trị kho ↓</option></select>';
    html += '<select id="s-year"><option value="all">Mọi năm</option>' +
      years.map(function (y) { return '<option value="' + y + '"' + (setFilter.year === String(y) ? ' selected' : '') + '>Năm ' + y + '</option>'; }).join('') +
      '<option value="unknown"' + (setFilter.year === 'unknown' ? ' selected' : '') + '>Chưa rõ năm</option></select>';
    html += '<label class="chk"><input type="checkbox" id="s-groupyear"' + (setFilter.groupYear ? ' checked' : '') + '> Nhóm theo năm</label>';
    html += '<a class="btn secondary btn-sm" href="#/sets/manage" style="text-decoration:none;margin-left:auto">' + IC.edit + ' Quản lý set</a>';
    html += '</div>';
    html += '<div class="chip-row" id="set-lang-chips">' +
      setLangChip('Tất cả', 'all') + setLangChip('EN', 'en') + setLangChip('JP', 'jp') + setLangChip('Khác', 'other') + '</div>';

    if (!withP.length && !unclassified.length) {
      return html + '<div class="empty"><h3>Chưa có set nào</h3><p>Nhập kho và gắn set cho card để theo dõi tiến độ sưu tập.</p></div>';
    }

    if (setFilter.groupYear) {
      var yg = {};
      withP.forEach(function (x) {
        var k = x.g.info.year == null ? '__unknown__' : String(x.g.info.year);
        (yg[k] = yg[k] || []).push(x);
      });
      var keys = Object.keys(yg).sort(function (a, b) {
        if (a === '__unknown__') return 1; if (b === '__unknown__') return -1;
        return Number(b) - Number(a);
      });
      keys.forEach(function (k) {
        html += '<h2 class="year-head">' + (k === '__unknown__' ? 'Chưa rõ năm' : 'Năm ' + k) + ' <span class="year-count">' + yg[k].length + ' set</span></h2>';
        html += '<div class="set-grid">' + yg[k].map(setCardHTML).join('') + '</div>';
      });
    } else {
      html += '<div class="set-grid">' + withP.map(setCardHTML).join('') + '</div>';
    }

    if (unclassified.length) {
      var uq = unclassified[0].cards.reduce(function (t, c) { return t + BCT.stockOf(S, c.id); }, 0);
      html += '<h2 class="year-head">Chưa phân loại <span class="year-count">' + unclassified[0].cards.length + ' card</span></h2>';
      html += '<p class="page-sub">Các card này chưa gắn set — sửa card để gắn set rồi theo dõi tiến độ.</p>';
      html += '<div class="set-grid"><div class="set-card"><div class="set-name">Chưa phân loại</div>' +
        '<div class="set-stat"><span>' + unclassified[0].cards.length + ' loại card</span><span>' + uq + ' thẻ tồn</span></div></div></div>';
    }
    return html;
  }

  function setCardHTML(x) {
    var g = x.g, p = x.p, info = g.info;
    var link = '#/sets/' + encodeURIComponent(g.key);
    var html = '<a class="set-card" href="' + link + '">';
    html += '<div class="set-name">' + BCT.esc(info.name) + '</div>';
    if (info.custom) html += '<div><span class="tag" style="font-size:10px">Tự tạo</span></div>';
    var gl = BCT.groupLanguage(S, g);
    if (gl) html += '<div><span class="tag lang-tag" style="font-size:10px">' + BCT.esc(BCT.LANGUAGES[gl]) + '</span></div>';
    if (info.year != null) html += '<div class="set-year">' + info.year + '</div>';
    if (p.total != null) {
      html += '<div class="progress"><div class="progress-bar" style="width:' + p.pct + '%"></div></div>';
      html += '<div class="set-progress-num">' + p.unique + '/' + p.total + ' lá <span class="mono">(' + p.pct + '%)</span></div>';
      html += '<div class="set-stat"><span>Còn thiếu <b>' + p.missing + '</b> lá</span><span>Tồn <b>' + p.qty + '</b> thẻ</span></div>';
    } else {
      html += '<div class="set-unknown">Chưa rõ tổng số lá của set này</div>';
      html += '<div class="set-manual"><input inputmode="numeric" placeholder="VD: 198" data-setkey="' + BCT.esc(g.key) + '">' +
        '<button class="btn secondary btn-sm" data-setkey="' + BCT.esc(g.key) + '">Lưu</button></div>';
      html += '<div class="set-stat"><span>Tồn <b>' + p.qty + '</b> thẻ</span></div>';
    }
    html += '<div class="set-stat"><span>Giá trị kho <b class="mono">' + BCT.fmtVND(p.value) + '</b></span>';
    if (p.secrets.length) html += '<span class="secret-tag">' + p.secrets.length + ' secret</span>';
    html += '</div></a>';
    return html;
  }

  /* ================= VIEW: QUẢN LÝ SET TỰ TẠO ================= */
  function vSetManage(q) {
    q = q || {};
    var editing = q.edit ? BCT.getCustomSet(S, q.edit) : null;
    var html = '<a class="backlink" href="#/sets">' + IC.back + ' Bộ sưu tập</a>';
    html += '<h1 class="page-title">Quản lý set</h1>';
    html += '<p class="page-sub">220 set chuẩn từ TCGdex chỉ đọc — chỉ set tự tạo mới sửa/xóa được.</p>';

    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Set tự tạo (' + S.customSets.length + ')</h2></div>';
    if (!S.customSets.length) {
      html += '<p class="panel-note">Chưa có set tự tạo nào. Dùng form bên dưới để thêm set riêng của Bự (vd set promo, set custom).</p>';
    } else {
      html += '<table class="tbl"><thead><tr><th>Tên set</th><th>Năm</th><th class="r">Lá chính / Tổng</th><th class="r">Card đang gắn</th><th></th></tr></thead><tbody>';
      S.customSets.forEach(function (s) {
        var n = BCT.cardsOfCustomSet(S, s.id).length;
        html += '<tr><td><b>' + BCT.esc(s.name) + '</b>' + (s.note ? '<div class="s">' + BCT.esc(s.note) + '</div>' : '') + '</td>' +
          '<td>' + (s.year != null ? s.year : '—') + '</td>' +
          '<td class="r">' + s.official + ' / ' + s.total + '</td>' +
          '<td class="r">' + n + '</td>' +
          '<td class="r"><a class="rowlink" href="#/sets/manage?edit=' + s.id + '">Sửa</a> · ' +
          '<a class="rowlink" href="javascript:void(0)" data-cset-del="' + s.id + '" style="color:#e07a6a">Xóa</a></td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '<div id="cset-confirm"></div></section>';

    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">' + (editing ? 'Sửa set tự tạo' : 'Thêm set mới') + '</h2></div>';
    html += '<form id="f-cset"><div class="form-grid">';
    if (editing) html += '<input type="hidden" id="cs-id" value="' + editing.id + '">';
    html += '<div class="field"><label>Tên set *</label><input id="cs-name" placeholder="VD: Promo Box Bự" value="' + BCT.esc(editing ? editing.name : '') + '"></div>';
    html += '<div class="field"><label>Năm phát hành</label><input id="cs-year" inputmode="numeric" placeholder="VD: 2024" value="' + (editing && editing.year != null ? editing.year : '') + '"><div class="hint">Để trống nếu không rõ.</div></div>';
    html += '<div class="field"><label>Tổng số lá *</label><input id="cs-total" inputmode="numeric" placeholder="VD: 60" value="' + (editing ? editing.total : '') + '"><div class="hint">Gồm cả secret rare.</div></div>';
    html += '<div class="field"><label>Số lá chính *</label><input id="cs-official" inputmode="numeric" placeholder="VD: 54" value="' + (editing ? editing.official : '') + '"><div class="hint">Không vượt tổng số lá.</div></div>';
    html += '<div class="field full"><label>Ghi chú</label><input id="cs-note" placeholder="VD: set tự in cho event" value="' + BCT.esc(editing ? editing.note : '') + '"></div>';
    html += '</div><div class="form-err" id="cs-err" hidden></div>';
    html += '<div class="form-actions"><button class="btn" type="submit">' + IC.check + (editing ? ' Lưu thay đổi' : ' Thêm set') + '</button>' +
      (editing ? '<a class="btn secondary" href="#/sets/manage" style="text-decoration:none">Hủy</a>' : '') + '</div>';
    html += '</form></section>';
    return html;
  }

  function showCsetErr(msg) {
    var el = document.getElementById('cs-err');
    if (el) { el.textContent = msg; el.hidden = false; }
    else toast(msg);
  }

  /* ================= VIEW: CHECKLIST 1 SET ================= */
  var setDetailFilter = { missingOnly: false, mode: 'set' };

  function vSetDetail(key) {
    var groups = BCT.setGroups(S);
    var g = null;
    for (var i = 0; i < groups.length; i++) if (groups[i].key === key) { g = groups[i]; break; }
    if (!g) return '<a class="backlink" href="#/sets">' + IC.back + ' Bộ sưu tập</a><div class="empty"><h3>Không tìm thấy set</h3></div>';
    var info = g.info;
    var p = BCT.setProgress(S, g);
    var missingOnly = setDetailFilter.missingOnly;
    var mode = setDetailFilter.mode || 'set';

    var html = '<a class="backlink" href="#/sets">' + IC.back + ' Bộ sưu tập</a>';
    html += '<h1 class="page-title">' + BCT.esc(info.name) + '</h1>';
    html += '<p class="page-sub">' + (info.year != null ? 'Phát hành <b>' + info.year + '</b> · ' : '') +
      (p.total != null ? '<b>' + p.unique + '/' + p.total + ' lá</b> (' + p.pct + '%)' +
        (info.official != null ? ' · ' + info.official + ' lá chính + ' + (p.total - info.official) + ' secret' : '') : 'Chưa rõ tổng số lá') +
      ' · tồn ' + p.qty + ' thẻ · giá trị kho ' + BCT.fmtVND(p.value) + '</p>';

    if (p.rarest.length) {
      html += '<div class="panel" style="margin-bottom:18px"><div class="panel-head"><h2 class="panel-title">Lá hiếm nhất đang có</h2></div>';
      html += '<div class="rarest-row">' + p.rarest.map(function (c) {
        return '<a class="rarest-chip" href="#/kho/' + c.id + '"><span class="secret-tag">' + BCT.esc(c.rarity) + '</span> ' + BCT.esc(c.name) +
          ' <span class="mono">#' + BCT.esc(c.number || '?') + '</span></a>';
      }).join('') + '</div></div>';
    }

    if (p.total == null) {
      html += '<div class="empty"><h3>Chưa rõ tổng số lá</h3><p>Nhập tổng số lá của set này để hiện checklist.</p>' +
        '<div class="set-manual" style="justify-content:center;max-width:340px;margin:0 auto"><input inputmode="numeric" placeholder="VD: 198" data-setkey="' + BCT.esc(g.key) + '">' +
        '<button class="btn" data-setkey="' + BCT.esc(g.key) + '">Lưu tổng số lá</button></div></div>';
      return html;
    }

    html += '<div class="toolbar"><div class="seg" id="sd-mode">' +
      '<button type="button" data-mode="set"' + (mode === 'set' ? ' class="on"' : '') + '>Set chuẩn</button>' +
      '<button type="button" data-mode="master"' + (mode === 'master' ? ' class="on"' : '') + '>Master</button></div>' +
      '<label class="chk"><input type="checkbox" id="sd-missing"' + (missingOnly ? ' checked' : '') + '> Chỉ hiện lá thiếu</label>' +
      (mode === 'master' ? '<span class="panel-note" style="margin:0">Chế độ Master: xem breakdown phiên bản từng ô — tiến độ set không đổi.</span>' : '') +
      '</div>';
    html += '<div class="num-grid">';
    for (var n = 1; n <= p.total; n++) {
      var ids = p.ownedNums[n];
      var isSecret = info.official != null && n > info.official;
      if (missingOnly && ids) continue;
      if (ids) {
        var cid = ids[0];
        var c = BCT.getCard(S, cid);
        var q = BCT.stockOf(S, cid);
        var masterExtra = '';
        var thumbHTML = '';
        if (mode === 'master') {
          var bd = BCT.variantBreakdown(S, cid);
          masterExtra = '<span class="num-var">' + bd.map(function (b) {
            return BCT.esc(b.variant) + (b.holoPattern ? ' · ' + BCT.esc(b.holoPattern) : '') + ' ×' + b.qty;
          }).join(' · ') + '</span>';
        } else if (c) {
          thumbHTML = cardImgTag(c, 'low', 'num-thumb', c.name);
        }
        html += '<button type="button" class="num-cell owned' + (isSecret ? ' secret' : '') + (thumbHTML ? ' has-thumb' : '') + '" data-num="' + n + '" title="' + BCT.esc(c ? c.name : '') + (c && c.rarity ? ' — ' + BCT.esc(c.rarity) : '') + ' — bấm để xem/sửa">' +
          thumbHTML +
          '<span class="num-stack"><span class="num-n">' + n + '</span>' + masterExtra + '</span><span class="num-qty">×' + q + '</span>' +
          (isSecret ? '<span class="num-secret">SECRET</span>' : '') + '</button>';
      } else {
        html += '<a class="num-cell missing' + (isSecret ? ' secret' : '') + '" href="#/nhap?newcard=1&setkey=' + encodeURIComponent(g.key) + '&num=' + n + '" title="Lá số ' + n + ' — chưa có. Bấm để nhập lá này"><span class="num-n">' + n + '</span><span class="num-add">+ thêm</span>' +
          (isSecret ? '<span class="num-secret">SECRET</span>' : '') + '</a>';
      }
    }
    html += '</div>';
    return html;
  }

  function closeSlotPanel() {
    var ov = document.getElementById('slot-overlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  // Panel thao tác khi bấm vào 1 ô đã có trong checklist:
  // xem card đang chiếm ô + Sửa lá + Đổi số/set + Gỡ khỏi set
  function openSlotPanel(key, n) {
    closeSlotPanel();
    var groups = BCT.setGroups(S);
    var g = null;
    for (var i = 0; i < groups.length; i++) if (groups[i].key === key) { g = groups[i]; break; }
    if (!g) return;
    var info = g.info;
    var p = BCT.setProgress(S, g);
    var ids = p.ownedNums[n] || [];
    if (!ids.length) return;

    var html = '<div class="slot-sheet">';
    html += '<div class="slot-head"><h3>Lá số <span class="mono">' + n + '</span> — ' + BCT.esc(info.name) + '</h3><button type="button" class="slot-x" id="slot-close">×</button></div>';

    ids.forEach(function (cid) {
      var c = BCT.getCard(S, cid);
      if (!c) return;
      var bd = BCT.variantBreakdown(S, cid);
      html += '<div class="slot-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>' + BCT.esc(c.name) + '</b><span class="mono">' + BCT.stockOf(S, cid) + ' thẻ</span></div>';
      html += '<div style="margin:6px 0">' + (c.rarity ? '<span class="tag">' + BCT.esc(c.rarity) + '</span>' : '') + '</div>';
      html += '<div>' + bd.map(function (b) { return '<span class="vchip">' + BCT.esc(b.variant) + (b.holoPattern ? ' · ' + BCT.esc(b.holoPattern) : '') + ' ×' + b.qty + '</span>'; }).join('') + '</div>';
      html += '<div class="form-actions" style="margin-top:8px"><a class="btn secondary btn-sm" href="#/kho/' + cid + '" style="text-decoration:none">Chi tiết</a>' +
        '<a class="btn secondary btn-sm" href="#/kho/' + cid + '/edit" style="text-decoration:none">' + IC.edit + ' Sửa lá</a></div></div>';
    });

    html += '<h4 style="margin:14px 0 8px;font-size:14px">Đổi số / set của lá này</h4>';
    html += '<div class="form-grid">';
    if (ids.length > 1) {
      html += '<div class="field full"><label>Lá cần đổi</label><select id="sp-card">' + ids.map(function (cid) {
        var c = BCT.getCard(S, cid);
        return '<option value="' + cid + '">' + BCT.esc(c ? c.name : cid) + '</option>';
      }).join('') + '</select></div>';
    }
    html += '<div class="field"><label>Số thứ tự mới</label><input id="sp-number" inputmode="numeric" value="' + n + '"></div>';
    html += '<div class="field"><label>Set</label><input id="sp-set" list="set-list" autocomplete="off" value="' + BCT.esc(info.name || '') + '"><datalist id="set-list">' + setDatalistOptions() + '</datalist><div class="hint">Gõ tên set trong danh sách 220 set.</div></div>';
    html += '<div class="field"><label>Độ hiếm</label><select id="sp-rarity"><option value="">— Giữ nguyên —</option>' +
      BCT.RARITIES.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></div>';
    html += '</div>';
    html += '<div class="form-actions"><button type="button" class="btn" id="sp-save">' + IC.check + ' Lưu</button>' +
      '<button type="button" class="btn secondary" id="sp-unassign">Gỡ khỏi set</button></div>';
    html += '<p class="panel-note" style="margin-top:8px">Đổi số/set chỉ dời lá bài — các lô nhập & đơn đã bán giữ nguyên, tiến độ set cập nhật ngay.</p>';
    html += '</div>';

    var ov = document.createElement('div');
    ov.className = 'slot-overlay';
    ov.id = 'slot-overlay';
    ov.innerHTML = html;
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeSlotPanel(); });
    document.getElementById('slot-close').addEventListener('click', closeSlotPanel);

    var multi = ids.length > 1;
    var targetId = function () {
      if (!multi) return ids[0];
      var sel = document.getElementById('sp-card');
      return (sel && sel.value) ? sel.value : ids[0];
    };
    document.getElementById('sp-save').addEventListener('click', function () {
      withLoading(async function () {
        var c = BCT.getCard(S, targetId());
        if (!c) throw new Error('Không tìm thấy card.');
        var setName = document.getElementById('sp-set').value.trim();
        var hit = lookupSetByName(setName);
        var rar = document.getElementById('sp-rarity').value;
        await BCT.updateCard(S, targetId(), {
          number: document.getElementById('sp-number').value.trim(),
          set: setName, setId: hit ? hit.id : null,
          rarity: rar || c.rarity
        });
        closeSlotPanel(); toast('Đã cập nhật lá bài.'); render();
      }).catch(function (err) { toast(err.message); });
    });
    document.getElementById('sp-unassign').addEventListener('click', function () {
      if (!confirm('Gỡ lá này khỏi set? Card vẫn nằm trong Kho.')) return;
      withLoading(async function () {
        var c = BCT.getCard(S, targetId());
        if (c) {
          await BCT.updateCard(S, targetId(), { setId: null, set: '' });
          closeSlotPanel(); toast('Đã gỡ khỏi set.'); render();
        }
      }).catch(function (err) { toast(err.message); });
    });
  }

  /* ================= VIEW: SỬA CARD ================= */
  function vCardEdit(id) {
    var c = BCT.getCard(S, id);
    if (!c) return '<a class="backlink" href="#/kho">' + IC.back + ' Kho card</a><div class="empty"><h3>Không tìm thấy card</h3></div>';
    var html = '<a class="backlink" href="#/kho/' + c.id + '">' + IC.back + ' ' + BCT.esc(c.name) + '</a>';
    html += '<h1 class="page-title">Sửa card</h1><p class="page-sub">Cập nhật thông tin card — không ảnh hưởng các lô nhập & đơn đã bán</p>';
    html += '<form id="f-edit"><section class="panel"><div class="form-grid">';
    html += '<div class="field"><label>Tên card *</label><input id="e-name" value="' + BCT.esc(c.name) + '"></div>';
    html += '<div class="field"><label>Set</label><input id="e-set" list="set-list" value="' + BCT.esc(c.set || '') + '" autocomplete="off"><datalist id="set-list">' + setDatalistOptions() + '</datalist><div class="hint" id="e-set-hint">' + setHintHTML(c.set || '') + '</div></div>';
    html += '<div class="field"><label>Số thứ tự trong set</label><input id="e-number" value="' + BCT.esc(c.number || '') + '" placeholder="VD: 025"></div>';
    html += '<div class="field"><label>Độ hiếm</label><select id="e-rarity"><option value="">— Chọn —</option>' +
      BCT.RARITIES.map(function (r) { return '<option' + (c.rarity === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>';
    html += '<div class="field"><label>Ngôn ngữ</label><select id="e-lang">' +
      Object.keys(BCT.LANGUAGES).map(function (k) { return '<option value="' + k + '"' + ((c.language || 'en') === k ? ' selected' : '') + '>' + BCT.LANGUAGES[k] + '</option>'; }).join('') + '</select></div>';
    html += '<div class="field"><label>Condition</label><select id="e-cond">' +
      BCT.CONDITIONS.map(function (k) { return '<option' + (BCT.condLabel(c.condition) === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div>';
    html += '<div class="field"><label>Vị trí lưu trữ</label><input id="e-storage" value="' + BCT.esc(c.storageLocation || '') + '" placeholder="VD: Hộp A3"></div>';
    html += '<div class="field"><label>Lỗi in</label><label class="chk"><input type="checkbox" id="e-misprint"' + (c.misprint ? ' checked' : '') + '> Misprint (lỗi in)</label></div>';
    html += '<div class="field"><label>Mã cert (PSA/BGS)</label><input id="e-cert" value="' + BCT.esc(c.certNumber || '') + '" placeholder="VD: 12345678"></div>';
    html += '<div class="field"><label>Pop (số lá cùng điểm)</label><input id="e-pop" inputmode="numeric" value="' + (c.certPop != null ? c.certPop : '') + '" placeholder="VD: 42"></div>';
    html += '<div class="field"><label>Graded</label><div style="display:flex;gap:8px"><select id="e-graded-org" style="flex:1"><option value="">Không graded</option>' +
      ['PSA', 'BGS'].map(function (o) { return '<option' + (c.graded && c.graded.org === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
      '</select><input id="e-graded-score" placeholder="Điểm" style="width:80px" inputmode="decimal" value="' + BCT.esc(c.graded ? c.graded.score : '') + '"></div></div>';
    html += '<div class="field full"><label>Ghi chú</label><textarea id="e-note">' + BCT.esc(c.note || '') + '</textarea></div>';
    html += '</div><div class="form-actions"><button class="btn" type="submit">' + IC.check + ' Lưu thay đổi</button><a class="btn secondary" href="#/kho/' + c.id + '" style="text-decoration:none">Hủy</a></div>';
    html += '</section></form>';
    return html;
  }

  /* ---------- bind: quản lý set tự tạo ---------- */
  function bindSetManage() {
    var form = $('f-cset');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      withLoading(async function () {
        var input = {
          name: $('cs-name').value, year: $('cs-year').value,
          total: $('cs-total').value, official: $('cs-official').value, note: $('cs-note').value
        };
        var idEl = $('cs-id');
        if (idEl && idEl.value) {
          await BCT.updateCustomSet(S, idEl.value, input);
          toast('Đã lưu thay đổi set.');
        } else {
          var s = await BCT.createCustomSet(S, input);
          toast('Đã thêm set "' + s.name + '".');
        }
        if (location.hash === '#/sets/manage') render();
        else location.hash = '#/sets/manage';
      }).catch(function (err) { showCsetErr(err.message); });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-cset-del]'), function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-cset-del');
        var s = BCT.getCustomSet(S, id);
        if (!s) return;
        var n = BCT.cardsOfCustomSet(S, id).length;
        if (!n) {
          if (!confirm('Xóa set "' + s.name + '"?')) return;
          withLoading(async function () {
            await BCT.deleteCustomSet(S, id);
            toast('Đã xóa set.'); render();
          }).catch(function (err) { toast(err.message); });
          return;
        }
        // Có card đang gắn → panel xác nhận, bắt buộc chuyển card sang Chưa phân loại
        var box = $('cset-confirm');
        box.innerHTML = '<div class="confirm-box"><div><b>Set "' + BCT.esc(s.name) + '" đang có ' + n + ' card.</b><br>' +
          '<label class="chk" style="margin-top:8px"><input type="checkbox" id="cc-move" checked disabled> Chuyển ' + n + ' lá sang <b>Chưa phân loại</b> (bắt buộc)</label></div>' +
          '<div class="form-actions" style="margin-top:10px"><button class="btn danger" id="cc-yes">Xóa set</button>' +
          '<button class="btn secondary" id="cc-no">Hủy</button></div></div>';
        $('cc-no').addEventListener('click', function () { box.innerHTML = ''; });
        $('cc-yes').addEventListener('click', function () {
          if (!$('cc-move').checked) { toast('Phải chuyển card sang Chưa phân loại trước khi xóa.'); return; }
          withLoading(async function () {
            var moved = await BCT.deleteCustomSet(S, id);
            toast('Đã xóa set · ' + moved + ' lá chuyển sang Chưa phân loại.'); render();
          }).catch(function (err) { toast(err.message); });
        });
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  /* ================= VIEW: NHẬP KHO ================= */
  var pendingImages = [];

  function setDatalistOptions() {
    var out = '';
    (S.customSets || []).forEach(function (s) {
      out += '<option value="' + BCT.esc(s.name) + '" label="Tự tạo">';
    });
    if (window.BCT_SETS) out += window.BCT_SETS.list.map(function (s) {
      return '<option value="' + BCT.esc(s.name) + '">';
    }).join('');
    return out;
  }

  // Tìm set theo tên user gõ → ưu tiên set tự tạo, rồi mới tới TCGdex
  function lookupSetByName(name) {
    if (!name) return null;
    var cs = BCT.customSetByName(S, name);
    if (cs) return { id: cs.id, name: cs.name, total: cs.total, official: cs.official, year: cs.year, custom: true };
    if (!window.BCT_SETS) return null;
    return window.BCT_SETS.byName(name);
  }

  // Tìm set theo id (dùng cho prefill từ checklist) → ưu tiên set tự tạo
  function lookupSetById(id) {
    if (!id) return null;
    var cs = BCT.getCustomSet(S, id);
    if (cs) return { id: cs.id, name: cs.name, total: cs.total, official: cs.official, year: cs.year, custom: true };
    if (window.BCT_SETS && window.BCT_SETS.byId) return window.BCT_SETS.byId(id);
    return null;
  }

  function setHintHTML(name) {
    var s = lookupSetByName(name);
    if (!s) return 'Gõ tên set hoặc nhập tên khác tự do.';
    var secret = s.total - s.official;
    return (s.custom ? '<span class="tag" style="font-size:10px">Tự tạo</span> ' : '') +
      'Set này có <b>' + s.official + ' lá chính</b>' + (secret > 0 ? ' + <b>' + secret + ' secret</b>' : '') +
      ' (tổng ' + s.total + ' lá).';
  }

  function vNhap(q) {
    q = q || {};
    pendingImages = [];
    var prefillCardId = q.card || '';
    // Prefill từ checklist: #/nhap?newcard=1&setkey=<id>&num=<n>
    var forceNew = q.newcard === '1';
    var preSetName = '', preNum = q.num || '';
    if (forceNew && q.setkey) {
      var ps = lookupSetById(q.setkey);
      if (ps) preSetName = ps.name;
    }
    var html = '<h1 class="page-title">Nhập kho</h1><p class="page-sub">Mỗi lần nhập là một lô riêng — giá cost khác nhau theo ngày được giữ nguyên để tính FIFO</p>';
    html += '<form id="f-nhap"><section class="panel">';
    html += '<div class="form-grid">';
    html += '<div class="field full"><label>Card</label><select id="n-card">' +
      '<option value="__new"' + (forceNew ? ' selected' : '') + '>+ Tạo card mới</option>' +
      S.cards.map(function (c) { return '<option value="' + c.id + '"' + (prefillCardId === c.id ? ' selected' : '') + '>' + BCT.esc(c.name) + ' — ' + BCT.esc(c.set || '') + ' (tồn ' + BCT.stockOf(S, c.id) + ')</option>'; }).join('') +
      '</select>' + (forceNew && preSetName ? '<div class="hint" style="margin-top:6px">Đang thêm lá số <b class="mono">' + BCT.esc(preNum) + '</b> vào set <b>' + BCT.esc(preSetName) + '</b> (từ checklist).</div>' : '') + '</div>';
    html += '<div id="new-card-fields" style="display:contents">' +
      '<div class="field"><label>Tên card *</label><input id="n-name" placeholder="VD: Charizard ex"></div>' +
      '<div class="field"><label>Set</label><input id="n-set" list="set-list" placeholder="Gõ để tìm set…" autocomplete="off" value="' + BCT.esc(preSetName) + '"><datalist id="set-list">' +
      setDatalistOptions() + '</datalist><div class="hint" id="n-set-hint">' + setHintHTML(preSetName) + '</div></div>' +
      '<div class="field"><label>Số thứ tự trong set</label><input id="n-number" placeholder="VD: 025" value="' + BCT.esc(preNum) + '"><div class="hint">Số in góc dưới thẻ, vd 025.</div></div>' +
      '<div class="field"><label>Độ hiếm</label><select id="n-rarity"><option value="">— Chọn —</option>' +
      BCT.RARITIES.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Ngôn ngữ</label><select id="n-lang">' +
      Object.keys(BCT.LANGUAGES).map(function (k) { return '<option value="' + k + '">' + BCT.LANGUAGES[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Condition</label><select id="n-cond">' +
      BCT.CONDITIONS.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select><div class="hint">New Mint / A / B / C / D.</div></div>' +
      '<div class="field"><label>Vị trí lưu trữ</label><input id="n-storage" placeholder="VD: Hộp A3, Binder 2 - trang 15"></div>' +
      '<div class="field"><label>Lỗi in</label><label class="chk"><input type="checkbox" id="n-misprint"> Misprint (lỗi in)</label></div>' +
      '<div class="field"><label>Mã cert (PSA/BGS)</label><input id="n-cert" placeholder="VD: 12345678"></div>' +
      '<div class="field"><label>Pop (số lá cùng điểm)</label><input id="n-pop" inputmode="numeric" placeholder="VD: 42"></div>' +
      '<div class="field"><label>Graded</label><div style="display:flex;gap:8px"><select id="n-graded-org" style="flex:1"><option value="">Không graded</option><option>PSA</option><option>BGS</option></select><input id="n-graded-score" placeholder="Điểm" style="width:80px" inputmode="decimal"></div></div>' +
      '<div class="field full"><label>Ghi chú</label><textarea id="n-note" placeholder="Tình trạng, đặc điểm…"></textarea></div>' +
      '<div class="field full"><label>Ảnh card</label><div class="img-drop" id="img-drop">Bấm để chọn ảnh (tự nén còn ~800px, JPEG) <input type="file" id="n-images" accept="image/*" multiple></div><div class="img-preview" id="img-preview"></div><div class="hint">Chụp mặt trước & mặt sau lá bài của bạn. Ảnh tải lên Supabase Storage. Bỏ trống = dùng ảnh chính thức từ TCGdex.</div></div>' +
      '</div>';
    html += '<div class="field"><label>Số lượng *</label><input id="n-qty" inputmode="numeric" placeholder="VD: 5"></div>';
    html += '<div class="field"><label>Giá cost / thẻ (VND) *</label><input id="n-cost" inputmode="numeric" placeholder="VD: 10.000"><div class="hint">Giá vốn của đúng lô này.</div></div>';
    html += '<div class="field"><label>Ngày nhập *</label><input id="n-date" type="date" value="' + BCT.todayISO() + '"></div>';
    html += '<div class="field"><label>Nguồn mua</label><input id="n-source" placeholder="VD: Chợ TCG, Shop HN…"></div>';
    html += '<div class="field"><label>Phiên bản</label><select id="n-variant">' +
      BCT.VARIANTS.map(function (v) { return '<option>' + v + '</option>'; }).join('') +
      '</select><div class="hint">Bản thường / Reverse Holo / Holo / 1st Edition.</div></div>';
    html += '<div class="field"><label>Mẫu holo</label><select id="n-holo"><option value="">— Không ghi nhận —</option>' +
      BCT.HOLO_PATTERNS.map(function (h) { return '<option>' + BCT.esc(h) + '</option>'; }).join('') +
      '</select><div class="hint">Cosmos, Poké Ball / Master Ball (reverse holo)… — ghi nhận để tra giá & sưu tầm.</div></div>';
    html += '</div>';
    html += '<div class="form-actions"><button class="btn" type="submit">' + IC.check + ' Lưu lô nhập</button><a class="btn secondary" href="#/kho" style="text-decoration:none">Hủy</a></div>';
    html += '</section></form>';
    return html;
  }

  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 800;
        var w = img.width, h = img.height;
        if (Math.max(w, h) > max) {
          var k = max / Math.max(w, h);
          w = Math.round(w * k); h = Math.round(h * k);
        }
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /* ================= VIEW: BÁN HÀNG ================= */
  function vBan(prefillCardId) {
    var inStock = S.cards.filter(function (c) { return BCT.stockOf(S, c.id) > 0; });
    var html = '<h1 class="page-title">Bán hàng</h1><p class="page-sub">Tạo đơn mới — kho tự trừ theo FIFO, lãi tính theo giá vốn thực tế từng lô</p>';
    if (!inStock.length) return html + '<div class="empty"><h3>Kho đang hết hàng</h3><p>Nhập kho trước rồi hãy tạo đơn bán.</p><a class="btn" href="#/nhap" style="text-decoration:none;margin-top:12px">' + IC.plus + ' Nhập kho</a></div>';
    html += '<form id="f-ban"><section class="panel"><div class="form-grid">';
    html += '<div class="field"><label>Card *</label><select id="b-card">' + inStock.map(function (c) {
      return '<option value="' + c.id + '"' + (prefillCardId === c.id ? ' selected' : '') + '>' + BCT.esc(c.name) + ' (tồn ' + BCT.stockOf(S, c.id) + ')</option>';
    }).join('') + '</select></div>';
    html += '<div class="field"><label>Số lượng *</label><input id="b-qty" inputmode="numeric" value="1"></div>';
    html += '<div class="field full"><div id="fifo-preview"></div></div>';
    html += '<div class="field"><label>Giá bán / thẻ (VND) *</label><input id="b-price" inputmode="numeric" placeholder="VD: 25.000"></div>';
    html += '<div class="field"><label>Kênh bán *</label><select id="b-channel">' +
      Object.keys(BCT.CHANNELS).map(function (k) { return '<option value="' + k + '">' + BCT.CHANNELS[k] + '</option>'; }).join('') + '</select></div>';
    html += '<div class="field"><label>Phí sàn (VND)</label><input id="b-fees" inputmode="numeric" value="0"><div class="hint">VD: phí eBay/Shopee.</div></div>';
    html += '<div class="field"><label>Phí ship (VND)</label><input id="b-ship" inputmode="numeric" value="0"></div>';
    html += '<div class="field"><label>Người mua</label><input id="b-buyer" placeholder="Tên / nick"></div>';
    html += '<div class="field"><label>Ngày bán</label><input id="b-date" type="date" value="' + BCT.todayISO() + '"></div>';
    html += '<div class="field full"><label>Ghi chú</label><textarea id="b-note"></textarea></div>';
    html += '</div><div class="form-actions"><button class="btn" type="submit">' + IC.check + ' Xác nhận & lưu đơn</button><a class="btn secondary" href="#/donhang" style="text-decoration:none">Hủy</a></div>';
    html += '</section></form>';
    return html;
  }

  function fifoPreviewHTML(cardId, qty) {
    try {
      var plan = BCT.previewFIFO(S, cardId, qty);
      var cost = plan.reduce(function (t, p) { return t + p.qty * p.costPerUnit; }, 0);
      var html = '<div class="fifo-box"><h4>Xem trước FIFO — sẽ trừ các lô:</h4>';
      plan.forEach(function (p) {
        var lot = lotById(p.lotId);
        html += '<div class="fifo-line"><span>' + p.qty + ' thẻ · lô nhập ' + BCT.fmtDate(p.importDate) + (lot && lot.source ? ' (' + BCT.esc(lot.source) + ')' : '') + (lot && lot.variant && lot.variant !== 'Normal' ? ' · <b>' + BCT.esc(lot.variant) + '</b>' : '') + ' · cost ' + BCT.fmtVND(p.costPerUnit) + '/thẻ</span><span class="mono">' + BCT.fmtVND(p.qty * p.costPerUnit) + '</span></div>';
      });
      html += '<div class="fifo-total"><span>Tổng vốn của ' + qty + ' thẻ</span><span class="mono">' + BCT.fmtVND(cost) + '</span></div>';
      html += '<div class="panel-note" style="margin-top:8px">Lãi dự kiến = giá bán × ' + qty + ' − ' + BCT.fmtVND(cost) + ' − phí. Tính chính xác khi Bự nhập giá bán.</div></div>';
      return html;
    } catch (e) {
      return '<div class="fifo-box"><div class="fifo-err">' + BCT.esc(e.message) + '</div></div>';
    }
  }

  /* ================= VIEW: ĐƠN HÀNG ================= */
  /* ================= VIEW: RAO BÁN (listings — Phase 2, quản lý nội bộ) ================= */
  var listingFilter = { status: '' };
  function vListings(q) {
    q = q || {};
    var prefillCardId = q.card || '';
    var listings = (S.listings || []).slice().sort(function (a, b) { return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1; });
    var shown = listingFilter.status ? listings.filter(function (l) { return l.status === listingFilter.status; }) : listings;
    var html = '<h1 class="page-title">Rao bán</h1><p class="page-sub">' + listings.length + ' tin rao · Chuẩn bị giá và số lượng trước, khi nào bán thật thì chuyển trạng thái sang "Đang rao". Đây là quản lý nội bộ — chưa phải trang bán hàng công khai.</p>';

    html += '<form id="f-rao"><section class="panel"><h3 style="margin-top:0">Tạo tin rao mới</h3><div class="form-grid">';
    html += '<div class="field full"><label>Card *</label><select id="r-card">' +
      S.cards.map(function (c) { return '<option value="' + c.id + '"' + (prefillCardId === c.id ? ' selected' : '') + '>' + BCT.esc(c.name) + ' — ' + BCT.esc(c.set || '') + ' (tồn ' + BCT.stockOf(S, c.id) + ')</option>'; }).join('') +
      '</select></div>';
    html += '<div class="field"><label>Giá rao / lá (VND) *</label><input id="r-price" inputmode="numeric" placeholder="VD: 250.000"></div>';
    html += '<div class="field"><label>Số lượng rao *</label><input id="r-qty" inputmode="numeric" value="1"></div>';
    html += '<div class="field"><label>Kênh rao</label><select id="r-channel"><option value="">— Chưa chọn —</option>' +
      Object.keys(BCT.CHANNELS).map(function (k) { return '<option value="' + k + '">' + BCT.CHANNELS[k] + '</option>'; }).join('') + '</select></div>';
    html += '<div class="field"><label>Trạng thái</label><select id="r-status">' +
      BCT.LISTING_STATUSES.map(function (s) { return '<option value="' + s + '"' + (s === 'draft' ? ' selected' : '') + '>' + BCT.LISTING_STATUS_LABELS[s] + '</option>'; }).join('') + '</select><div class="hint">Mặc định Nháp — chưa bán thì cứ để Nháp.</div></div>';
    html += '</div><div class="form-actions"><button class="btn" type="submit">' + IC.check + ' Tạo tin rao</button></div></section></form>';

    html += '<div class="toolbar"><select id="l-status-filter"><option value="">Mọi trạng thái</option>' +
      BCT.LISTING_STATUSES.map(function (s) { return '<option value="' + s + '"' + (listingFilter.status === s ? ' selected' : '') + '>' + BCT.LISTING_STATUS_LABELS[s] + '</option>'; }).join('') + '</select></div>';
    if (!shown.length) {
      html += '<section class="panel"><div class="empty"><h3>Chưa có tin rao nào</h3><p>Tạo tin rao đầu tiên ở form phía trên. Tin ở trạng thái Nháp chỉ nằm trong app quản lý này.</p></div></section>';
    } else {
      html += '<section class="panel" style="padding:6px 22px"><table class="tbl"><thead><tr><th>Card</th><th class="r">Giá rao</th><th class="r">SL rao</th><th class="r">Tồn kho</th><th>Kênh</th><th>Trạng thái</th><th></th></tr></thead><tbody>';
      html += shown.map(function (l) {
        var c = BCT.getCard(S, l.cardId);
        var stock = c ? BCT.stockOf(S, c.id) : 0;
        return '<tr><td>' + (c ? '<a class="rowlink" href="#/kho/' + c.id + '">' + BCT.esc(c.name) + '</a><div style="color:var(--muted);font-size:12px">' + BCT.esc(c.set || '') + (c.number ? ' · #' + BCT.esc(c.number) : '') + '</div>' : '(card đã bị xóa)') + '</td>' +
          '<td class="r">' + BCT.fmtVND(l.price) + '</td>' +
          '<td class="r">' + l.qty + (l.qty > stock ? ' <span class="secret-tag">VƯỢT TỒN</span>' : '') + '</td>' +
          '<td class="r">' + stock + '</td>' +
          '<td>' + (l.channel ? BCT.CHANNELS[l.channel] || l.channel : '—') + '</td>' +
          '<td><select data-listing-status="' + l.id + '">' + BCT.LISTING_STATUSES.map(function (s) { return '<option value="' + s + '"' + (l.status === s ? ' selected' : '') + '>' + BCT.LISTING_STATUS_LABELS[s] + '</option>'; }).join('') + '</select></td>' +
          '<td class="r"><button type="button" class="btn-ghost" data-listing-del="' + l.id + '">Xóa</button></td></tr>';
      }).join('');
      html += '</tbody></table></section>';
    }
    return html;
  }

  var ordFilter = { channel: '', month: '' };

  function vDonHang() {
    var html = '<h1 class="page-title">Đơn hàng</h1><p class="page-sub">' + S.orders.length + ' đơn · bấm vào từng đơn để xem trừ lô nào</p>';
    html += '<div class="toolbar">';
    html += '<select id="o-channel"><option value="">Mọi kênh</option>' + Object.keys(BCT.CHANNELS).map(function (k) {
      return '<option value="' + k + '"' + (ordFilter.channel === k ? ' selected' : '') + '>' + BCT.CHANNELS[k] + '</option>';
    }).join('') + '</select>';
    html += '<input type="month" id="o-month" value="' + BCT.esc(ordFilter.month) + '">';
    html += '<a class="btn secondary" href="#/ban" style="text-decoration:none;margin-left:auto">' + IC.plus + ' Tạo đơn mới</a>';
    html += '</div>';
    html += '<section class="panel" style="padding:6px 22px"><table class="tbl"><thead><tr><th>Ngày</th><th>Kênh</th><th>Người mua</th><th class="r">Số thẻ</th><th class="r">Doanh thu</th><th class="r">Lãi</th><th></th></tr></thead><tbody id="ord-body">' + ordRows() + '</tbody></table></section>';
    return html;
  }

  function ordRows() {
    var list = S.orders.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (ordFilter.channel) list = list.filter(function (o) { return o.channel === ordFilter.channel; });
    if (ordFilter.month) list = list.filter(function (o) { return o.date.indexOf(ordFilter.month) === 0; });
    if (!list.length) return '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Chưa có đơn nào khớp bộ lọc.</td></tr>';
    var tRev = 0, tProf = 0;
    var rows = list.map(function (o) {
      var rev = BCT.orderRevenue(o), prof = BCT.orderProfit(o);
      tRev += rev; tProf += prof;
      return '<tr><td>' + BCT.fmtDate(o.date) + '</td><td>' + BCT.CHANNELS[o.channel] + '</td><td>' + BCT.esc(o.buyer || '—') + '</td>' +
        '<td class="r">' + BCT.orderQty(o) + '</td><td class="r">' + BCT.fmtVND(rev) + '</td>' +
        '<td class="r ' + (prof >= 0 ? 'pos' : 'neg') + '">' + BCT.fmtVND(prof) + '</td>' +
        '<td class="r"><a class="rowlink" href="#/donhang/' + o.id + '">Chi tiết →</a></td></tr>';
    }).join('');
    rows += '<tr><td colspan="4" style="font-weight:700;color:var(--muted)">TỔNG (' + list.length + ' đơn)</td><td class="r" style="font-weight:700">' + BCT.fmtVND(tRev) + '</td><td class="r ' + (tProf >= 0 ? 'pos' : 'neg') + '" style="font-weight:700">' + BCT.fmtVND(tProf) + '</td><td></td></tr>';
    return rows;
  }

  function vOrderDetail(id) {
    var o = null;
    for (var i = 0; i < S.orders.length; i++) if (S.orders[i].id === id) o = S.orders[i];
    if (!o) return '<a class="backlink" href="#/donhang">' + IC.back + ' Đơn hàng</a><div class="empty"><h3>Không tìm thấy đơn</h3></div>';
    var rev = BCT.orderRevenue(o), cost = BCT.orderCost(o), prof = BCT.orderProfit(o);
    var html = '<a class="backlink" href="#/donhang">' + IC.back + ' Đơn hàng</a>';
    html += '<h1 class="page-title">Đơn ' + BCT.fmtDate(o.date) + '</h1>';
    html += '<p class="page-sub">' + BCT.CHANNELS[o.channel] + (o.buyer ? ' · người mua: <b>' + BCT.esc(o.buyer) + '</b>' : '') + (o.note ? ' · ' + BCT.esc(o.note) : '') + '</p>';
    html += '<section class="kpis" style="grid-template-columns:repeat(4,1fr)">';
    html += kpi('Doanh thu', BCT.fmtVND(rev), 'gold', '');
    html += kpi('Vốn (FIFO)', BCT.fmtVND(cost), '', '');
    html += kpi('Phí sàn + ship', BCT.fmtVND(o.fees + o.shippingFee), '', 'sàn ' + BCT.fmtVND(o.fees) + ' · ship ' + BCT.fmtVND(o.shippingFee));
    html += kpi('Lãi', BCT.fmtVND(prof), prof >= 0 ? 'green' : 'red', '');
    html += '</section>';
    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Chi tiết từng dòng — trừ lô nào</h2></div>';
    html += '<table class="tbl"><thead><tr><th>Card</th><th class="r">SL</th><th class="r">Giá bán</th><th class="r">Thành tiền</th><th class="r">Vốn (lô)</th><th class="r">Lãi dòng</th></tr></thead><tbody>';
    o.items.forEach(function (it) {
      var c = BCT.getCard(S, it.cardId);
      var lot = lotById(it.lotId);
      var lineRev = it.qty * it.sellPrice, lineCost = it.qty * it.costPerUnit;
      html += '<tr><td><b>' + BCT.esc(c ? c.name : '?') + '</b><span class="lot-tag">lô nhập ' + (lot ? BCT.fmtDate(lot.importDate) : '?') + ' · cost ' + BCT.fmtVND(it.costPerUnit) + '/thẻ' + (lot && lot.variant && lot.variant !== 'Normal' ? ' · ' + BCT.esc(lot.variant) : '') + (lot && lot.source ? ' · ' + BCT.esc(lot.source) : '') + '</span></td>' +
        '<td class="r">' + it.qty + '</td><td class="r">' + BCT.fmtVND(it.sellPrice) + '</td><td class="r">' + BCT.fmtVND(lineRev) + '</td><td class="r">' + BCT.fmtVND(lineCost) + '</td>' +
        '<td class="r ' + (lineRev - lineCost >= 0 ? 'pos' : 'neg') + '">' + BCT.fmtVND(lineRev - lineCost) + '</td></tr>';
    });
    html += '</tbody></table></section>';
    return html;
  }

  /* ================= BINDINGS ================= */
  function $(id) { return document.getElementById(id); }

  function bind(base, r) {
    if (base === 'kho' && !r.segs[1] && $('f-q')) {
      var rerender = function () { $('card-grid').innerHTML = khoCards(); };
      $('f-q').addEventListener('input', function (e) { khoFilter.q = e.target.value; rerender(); });
      $('f-set').addEventListener('change', function (e) { khoFilter.set = e.target.value; rerender(); });
      $('f-rarity').addEventListener('change', function (e) { khoFilter.rarity = e.target.value; rerender(); });
      $('f-sort').addEventListener('change', function (e) { khoFilter.sort = e.target.value; rerender(); });
      var fHolo = $('f-holo');
      if (fHolo) fHolo.addEventListener('change', function (e) { khoFilter.holo = e.target.value; render(); });
      var fLoc = $('f-loc');
      if (fLoc) fLoc.addEventListener('input', function (e) { khoFilter.loc = e.target.value; rerender(); });
      Array.prototype.forEach.call(document.querySelectorAll('#lang-chips .chip'), function (ch) {
        ch.addEventListener('click', function () {
          var lg = ch.getAttribute('data-lang');
          var tg = ch.getAttribute('data-toggle');
          if (lg != null) { khoFilter.lang = lg; render(); }
          else if (tg === 'misprint') { khoFilter.misprintOnly = !khoFilter.misprintOnly; render(); }
          else if (tg === 'graded') { khoFilter.gradedOnly = !khoFilter.gradedOnly; render(); }
        });
      });
      var helpBtn = $('rarity-help'), pop = $('rarity-pop');
      if (helpBtn && pop) helpBtn.addEventListener('click', function () { pop.hidden = !pop.hidden; });
    }

    if (base === 'kho' && r.segs[1] && !r.segs[2] && $('mkt-fetch')) {
      (function () {
        var cid = r.segs[1];
        var msgEl = $('mkt-msg');
        function mktMsg(t) { if (msgEl) msgEl.textContent = t; }
        $('mkt-fetch').addEventListener('click', function () {
          var c = BCT.getCard(S, cid);
          if (!c) return;
          if (!c.setId || !c.number) { mktMsg('Card chưa có setId/số — không kéo giá được, vui lòng nhập tay.'); return; }
          mktMsg('Đang kéo giá các nguồn…');
          withLoading(async function () {
            try {
              var srcs = await BCT.fetchMarketPrices(c.setId, c.number);
              if (!srcs) { mktMsg('Chưa có giá cho lá này trên TCGdex. Bạn vẫn có thể nhập tay bên dưới.'); return; }
              await BCT.saveMarketPrices(S, cid, srcs);
              toast('Đã cập nhật giá ' + srcs.length + ' nguồn: ' + srcs.map(function (s) { return BCT.sourceLabel(s.source); }).join(' + '));
              render();
            } catch (err) {
              mktMsg('Lỗi kéo giá: ' + (err.message || err));
            }
          });
        });
        $('mkt-save').addEventListener('click', function () {
          var raw = $('mkt-price').value.trim().replace(',', '.');
          var val = parseFloat(raw);
          if (isNaN(val) || val <= 0) { mktMsg('Nhập giá hợp lệ (> 0).'); return; }
          withLoading(async function () {
            try {
              await BCT.addManualPrice(S, cid, {
                source: $('mkt-src').value, price: val, currency: $('mkt-cur').value || 'EUR'
              });
              toast('Đã lưu giá tay (' + BCT.sourceLabel($('mkt-src').value) + ').');
              render();
            } catch (err) { mktMsg(err.message || String(err)); }
          });
        });
      })();
    }

    if (base === 'kho' && r.segs[2] === 'edit' && $('f-edit')) {
      var cid = r.segs[1];
      var eSet = $('e-set');
      if (eSet) eSet.addEventListener('input', function (e) { $('e-set-hint').innerHTML = setHintHTML(e.target.value.trim()); });
      $('f-edit').addEventListener('submit', function (e) {
        e.preventDefault();
        withLoading(async function () {
          var c = BCT.getCard(S, cid);
          if (!c) throw new Error('Không tìm thấy card.');
          var nm = $('e-name').value.trim();
          if (!nm) throw new Error('Nhập tên card.');
          var setName = eSet.value.trim();
          var hit = lookupSetByName(setName);
          var gOrg = $('e-graded-org').value, gScore = $('e-graded-score').value.trim();
          await BCT.updateCard(S, cid, {
            name: nm, set: setName, setId: hit ? hit.id : null,
            number: $('e-number').value.trim(), rarity: $('e-rarity').value,
            condition: $('e-cond').value, language: $('e-lang').value || 'en',
            storageLocation: $('e-storage').value.trim(),
            misprint: $('e-misprint').checked,
            certNumber: $('e-cert').value.trim(),
            certPop: $('e-pop').value.trim(),
            graded: gOrg ? { org: gOrg, score: gScore || '' } : null,
            note: $('e-note').value.trim()
          });
          toast('Đã lưu thay đổi.');
          location.hash = '#/kho/' + cid;
        }).catch(function (err) { toast(err.message); });
      });
    }

    if (base === 'sets') {
      // nút lưu tổng số lá thủ công (cả grid & detail)
      Array.prototype.forEach.call(document.querySelectorAll('[data-setkey]'), function (el) {
        if (el.tagName === 'BUTTON') {
          el.addEventListener('click', function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            var key = el.getAttribute('data-setkey');
            var wrap = el.parentElement;
            var input = wrap ? wrap.querySelector('input') : null;
            withLoading(async function () {
              await BCT.setManualTotal(S, key, input ? input.value : '');
              toast('Đã lưu tổng số lá cho set.');
              render();
            }).catch(function (err) { toast(err.message); });
          });
        } else if (el.tagName === 'INPUT') {
          // input nằm trong thẻ <a>: chặn navigate khi bấm vào để gõ
          el.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
          el.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') { ev.preventDefault(); var b = el.parentElement.querySelector('button'); if (b) b.click(); }
          });
        }
      });
      if (r.segs[1] === 'manage') {
        bindSetManage();
      } else if (!r.segs[1]) {
        if ($('s-sort')) $('s-sort').addEventListener('change', function (e) { setFilter.sort = e.target.value; render(); });
        if ($('s-year')) $('s-year').addEventListener('change', function (e) { setFilter.year = e.target.value; render(); });
        if ($('s-groupyear')) $('s-groupyear').addEventListener('change', function (e) { setFilter.groupYear = e.target.checked; render(); });
        Array.prototype.forEach.call(document.querySelectorAll('#set-lang-chips .chip'), function (ch) {
          ch.addEventListener('click', function () { setFilter.lang = ch.getAttribute('data-slang'); render(); });
        });
      } else {
        if ($('sd-missing')) $('sd-missing').addEventListener('change', function (e) { setDetailFilter.missingOnly = e.target.checked; render(); });
        var seg = $('sd-mode');
        if (seg) Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
          b.addEventListener('click', function () { setDetailFilter.mode = b.getAttribute('data-mode'); render(); });
        });
        var dkey = decodeURIComponent(r.segs.slice(1).join('/'));
        Array.prototype.forEach.call(document.querySelectorAll('.num-cell[data-num]'), function (el) {
          el.addEventListener('click', function () { openSlotPanel(dkey, Number(el.getAttribute('data-num'))); });
        });
      }
    }

    if (base === 'nhap') {
      var cardSel = $('n-card'), newFields = $('new-card-fields');
      var syncMode = function () { newFields.style.display = cardSel.value === '__new' ? 'contents' : 'none'; };
      cardSel.addEventListener('change', syncMode); syncMode();
      var setInput = $('n-set');
      if (setInput) setInput.addEventListener('input', function (e) { $('n-set-hint').innerHTML = setHintHTML(e.target.value.trim()); });

      var drop = $('img-drop'), fileInput = $('n-images');
      if (drop) {
        drop.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
          var files = Array.prototype.slice.call(fileInput.files).slice(0, 6);
          var jobs = files.map(resizeImage);
          Promise.all(jobs).then(function (urls) {
            pendingImages = urls;
            $('img-preview').innerHTML = urls.map(function (u) { return '<img src="' + u + '">'; }).join('');
            toast('Đã nén ' + urls.length + ' ảnh.');
          }).catch(function () { toast('Không đọc được ảnh.'); });
        });
      }

      $('f-nhap').addEventListener('submit', function (e) {
        e.preventDefault();
        withLoading(async function () {
          var qty = Math.floor(Number($('n-qty').value) || 0);
          var cost = parseVND($('n-cost').value);
          var date = $('n-date').value || BCT.todayISO();
          var source = $('n-source').value.trim();
          if (qty <= 0) throw new Error('Nhập số lượng lớn hơn 0.');
          if (cost < 0) throw new Error('Giá cost không hợp lệ.');

          var cardId;
          if (cardSel.value === '__new') {
            var name = $('n-name').value.trim();
            if (!name) throw new Error('Nhập tên card.');
            var gOrg = $('n-graded-org').value, gScore = $('n-graded-score').value.trim();
            var setName = $('n-set').value.trim();
            var setHit = lookupSetByName(setName);
            var newNum = $('n-number').value.trim();
            // Chặn tách kho do tạo trùng: cùng tên + cùng số + cùng set thì gần như chắc chắn là 1 card.
            var dup = S.cards.filter(function (x) {
              return x.name.toLowerCase() === name.toLowerCase()
                && String(x.number || '') === newNum
                && ((setHit && x.setId === setHit.id) || (x.set || '').toLowerCase() === setName.toLowerCase());
            })[0];
            if (dup && !confirm('Đã có "' + dup.name + '" (' + (dup.set || 'chưa rõ set') + (dup.number ? ' · #' + dup.number : '') + ') trong kho, đang tồn ' + BCT.stockOf(S, dup.id) + ' lá.\n\nOK = vẫn tạo card mới riêng (chỉ khi đây thật sự là lá khác)\nCancel = hủy, quay lại chọn card có sẵn ở ô Card phía trên')) {
              toast('Đã hủy tạo card trùng — hãy chọn card có sẵn ở ô Card phía trên.');
              return;
            }
            var card = await BCT.addCard(S, {
              name: name, set: setName, setId: setHit ? setHit.id : null,
              number: newNum,
              rarity: $('n-rarity').value, condition: $('n-cond').value,
              graded: gOrg ? { org: gOrg, score: gScore || '' } : null,
              language: $('n-lang').value || 'en',
              storageLocation: $('n-storage').value.trim(),
              misprint: $('n-misprint').checked,
              certNumber: $('n-cert').value.trim(),
              certPop: $('n-pop').value.trim(),
              note: $('n-note').value.trim()
            });
            cardId = card.id;
          } else {
            cardId = cardSel.value;
          }
          // Condition của lô = condition CỦA CARD. Trước đây luôn đọc ô n-cond của form
          // tạo card mới (kể cả khi nhập thêm lô cho card có sẵn) → lô bị ghi sai condition mặc định.
          var lotCard = BCT.getCard(S, cardId);
          await BCT.addLot(S, {
            cardId: cardId, qty: qty, costPerUnit: cost, importDate: date, source: source,
            variant: $('n-variant').value || 'Normal',
            holoPattern: $('n-holo').value || null,
            condition: lotCard ? BCT.condLabel(lotCard.condition) : 'A'
          });
          if (pendingImages.length) {
            await BCT.uploadImageToCard(S, cardId, pendingImages);
            toast('Đã tải lên ' + pendingImages.length + ' ảnh.');
          }
          var c = BCT.getCard(S, cardId);
          toast('Đã nhập ' + qty + '× ' + c.name + '.');
          location.hash = '#/kho/' + cardId;
        }).catch(function (err) { toast(err.message); });
      });
    }

    if (base === 'ban' && $('f-ban')) {
      var updPreview = function () {
        var cid = $('b-card').value, q = Math.floor(Number($('b-qty').value) || 0);
        $('fifo-preview').innerHTML = fifoPreviewHTML(cid, q);
      };
      $('b-card').addEventListener('change', updPreview);
      $('b-qty').addEventListener('input', updPreview);
      updPreview();

      $('f-ban').addEventListener('submit', function (e) {
        e.preventDefault();
        withLoading(async function () {
          var order = await BCT.createOrder(S, {
            date: $('b-date').value || BCT.todayISO(),
            channel: $('b-channel').value,
            buyer: $('b-buyer').value.trim(),
            fees: parseVND($('b-fees').value),
            shippingFee: parseVND($('b-ship').value),
            note: $('b-note').value.trim(),
            lines: [{ cardId: $('b-card').value, qty: $('b-qty').value, sellPrice: parseVND($('b-price').value) }]
          });
          toast('Đã lưu đơn · lãi ' + BCT.fmtVND(BCT.orderProfit(order)) + '.');
          location.hash = '#/donhang/' + order.id;
        }).catch(function (err) { toast(err.message); });
      });
    }

    if (base === 'donhang' && !r.segs[1]) {
      $('o-channel').addEventListener('change', function (e) { ordFilter.channel = e.target.value; $('ord-body').innerHTML = ordRows(); });
      $('o-month').addEventListener('change', function (e) { ordFilter.month = e.target.value; $('ord-body').innerHTML = ordRows(); });
    }

    if (base === 'rao') {
      var fRao = $('f-rao');
      if (fRao) fRao.addEventListener('submit', function (e) {
        e.preventDefault();
        withLoading(async function () {
          var listing = await BCT.createListing(S, {
            cardId: $('r-card').value,
            price: parseVND($('r-price').value),
            qty: $('r-qty').value,
            channel: $('r-channel').value || '',
            status: $('r-status').value || 'draft'
          });
          var rc = BCT.getCard(S, listing.cardId);
          toast('Đã tạo tin rao' + (rc ? ' cho ' + rc.name : '') + ' (' + BCT.LISTING_STATUS_LABELS[listing.status] + ').');
          render();
        }).catch(function (err) { toast(err.message); });
      });
      var lf = $('l-status-filter');
      if (lf) lf.addEventListener('change', function (e) { listingFilter.status = e.target.value; render(); });
      Array.prototype.forEach.call(document.querySelectorAll('[data-listing-status]'), function (el) {
        el.addEventListener('change', function () {
          var id = el.getAttribute('data-listing-status');
          withLoading(async function () {
            await BCT.updateListing(S, id, { status: el.value });
            toast('Đã đổi trạng thái tin rao sang ' + BCT.LISTING_STATUS_LABELS[el.value] + '.');
            render();
          }).catch(function (err) { toast(err.message); render(); });
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-listing-del]'), function (el) {
        el.addEventListener('click', function () {
          if (!confirm('Xóa tin rao này? Card và tồn kho không bị ảnh hưởng.')) return;
          var id = el.getAttribute('data-listing-del');
          withLoading(async function () {
            await BCT.deleteListing(S, id);
            toast('Đã xóa tin rao.');
            render();
          }).catch(function (err) { toast(err.message); });
        });
      });
    }
  }

  /* ---------- boot ---------- */
  boot();
})();
