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

  /* ---------- state ---------- */
  var S;
  function boot() {
    var raw = null;
    try { raw = localStorage.getItem(BCT.STORAGE_KEY); } catch (e) {}
    if (raw === null) {
      S = window.BCT_SEED.buildSeed();
      BCT.save(S);
    } else {
      S = BCT.load();
    }
  }
  function persist() { BCT.save(S); }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
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
    { path: '#/donhang', label: 'Đơn hàng', icon: IC.receipt }
  ];

  function renderNav(active) {
    document.getElementById('nav').innerHTML = NAV.map(function (n) {
      var on = active === n.path || (n.path !== '#/dashboard' && active.indexOf(n.path) === 0 && active !== '#/dashboard');
      return '<a href="' + n.path + '" class="' + (on ? 'active' : '') + '">' + n.icon + n.label + '</a>';
    }).join('');
    document.getElementById('brand-icon').innerHTML = IC.card;
    var pill = document.getElementById('seed-pill');
    var btn = document.getElementById('btn-seed-toggle');
    if (S.isSeeded) {
      pill.hidden = false; btn.hidden = false; btn.textContent = 'Xóa dữ liệu mẫu';
      btn.onclick = function () {
        if (!confirm('Xóa toàn bộ dữ liệu mẫu và bắt đầu kho trống?')) return;
        S = BCT.blankState(); persist(); toast('Đã xóa dữ liệu mẫu.'); location.hash = '#/dashboard'; render();
      };
    } else {
      pill.hidden = true; btn.hidden = false; btn.textContent = 'Nạp dữ liệu mẫu';
      btn.onclick = function () {
        if (!confirm('Nạp bộ dữ liệu mẫu (8 card, 10 đơn)? Dữ liệu hiện tại sẽ bị thay thế.')) return;
        S = window.BCT_SEED.buildSeed(); persist(); toast('Đã nạp dữ liệu mẫu.'); location.hash = '#/dashboard'; render();
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
    var r = route();
    var base = r.segs[0] || 'dashboard';
    closeSlotPanel();
    renderNav('#/' + base);
    var app = document.getElementById('app');
    window.scrollTo(0, 0);
    if (base === 'dashboard') app.innerHTML = vDashboard();
    else if (base === 'kho') app.innerHTML = (r.segs[1] && r.segs[2] === 'edit') ? vCardEdit(r.segs[1]) : (r.segs[1] ? vCardDetail(r.segs[1]) : vKho());
    else if (base === 'sets') app.innerHTML = r.segs.length > 1 ? vSetDetail(decodeURIComponent(r.segs.slice(1).join('/'))) : vSets();
    else if (base === 'nhap') app.innerHTML = vNhap(r.query);
    else if (base === 'ban') app.innerHTML = vBan(r.query.card || '');
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
      var img = c.images[0] || '';
      return '<div class="rowline"><span class="rank">' + (i + 1) + '</span>' +
        (img ? '<img class="thumb" src="' + img + '" alt="">' : '') +
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
  var khoFilter = { q: '', set: '', rarity: '', sort: 'name' };

  function vKho() {
    var sets = [], rarities = [];
    S.cards.forEach(function (c) {
      if (c.set && sets.indexOf(c.set) < 0) sets.push(c.set);
      if (c.rarity && rarities.indexOf(c.rarity) < 0) rarities.push(c.rarity);
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
    html += '<a class="btn secondary" href="#/nhap" style="text-decoration:none">' + IC.plus + ' Nhập kho</a>';
    html += '</div>';
    html += '<div class="card-grid" id="card-grid">' + khoCards() + '</div>';
    if (!S.cards.length) html = '<h1 class="page-title">Kho card</h1><div class="empty"><h3>Kho đang trống</h3><p>Bấm "Nhập kho" để thêm card đầu tiên.</p><a class="btn" href="#/nhap" style="text-decoration:none;margin-top:12px">' + IC.plus + ' Nhập kho</a></div>';
    return html;
  }

  function khoCards() {
    var q = khoFilter.q.toLowerCase();
    var list = S.cards.filter(function (c) {
      if (khoFilter.set && c.set !== khoFilter.set) return false;
      if (khoFilter.rarity && c.rarity !== khoFilter.rarity) return false;
      if (q && (c.name + ' ' + c.set + ' ' + c.number).toLowerCase().indexOf(q) < 0) return false;
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
      var img = c.images[0] || '';
      return '<a class="pcard" href="#/kho/' + c.id + '">' +
        '<div class="pcard-img">' + (img ? '<img src="' + img + '" alt="' + BCT.esc(c.name) + '" loading="lazy">' : '') +
        '<span class="qty-badge' + (st === 0 ? ' out' : '') + '">' + st + ' thẻ</span></div>' +
        '<div class="pcard-body"><h3 class="pcard-name">' + BCT.esc(c.name) + '</h3>' +
        '<div class="pcard-meta">' + BCT.esc(c.set || '—') + (c.number ? ' · ' + BCT.esc(c.number) : '') + '</div>' +
        '<div class="pcard-stats"><span>Vốn TB <b>' + BCT.fmtVND(avg) + '</b></span><span>Ôm <b>' + BCT.fmtVND(st * avg) + '</b></span></div>' +
        '</div></a>';
    }).join('');
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
    var img = c.images[0] || '';

    var html = '<a class="backlink" href="#/kho">' + IC.back + ' Kho card</a>';
    html += '<div class="detail-head">';
    if (img) html += '<img class="detail-img" src="' + img + '" alt="' + BCT.esc(c.name) + '">';
    html += '<div class="detail-info"><h1>' + BCT.esc(c.name) + '</h1>';
    var setInfo = BCT.resolveSet(S, c);
    var numLabel = c.number ? 'Lá số <b class="mono">' + BCT.esc(c.number) + (setInfo.total ? '/' + setInfo.total : '') + '</b>' : '';
    html += '<div class="meta">' + BCT.esc(setInfo.name || c.set || '') + (numLabel ? ' · ' + numLabel : '') + '</div>';
    if (BCT.isSecretCard(c, setInfo)) html += '<div style="margin-bottom:8px"><span class="secret-tag">SECRET RARE — số vượt tổng set</span></div>';
    html += '<div>' + (c.rarity ? '<span class="tag">' + BCT.esc(c.rarity) + '</span>' : '') +
      '<span class="tag">' + (BCT.CONDITIONS[c.condition] || c.condition) + '</span>' +
      (c.graded ? '<span class="tag">' + c.graded.org + ' ' + c.graded.score + '</span>' : '') + '</div>';
    html += '<div class="stat-row">' +
      stat('Tồn kho', st + ' thẻ') + stat('Vốn TB', BCT.fmtVND(avg)) +
      stat('Tổng vốn ôm', BCT.fmtVND(st * avg)) + stat('Giá bán gần nhất', lastSell ? BCT.fmtVND(lastSell) : '—') + '</div>';
    html += '<div class="form-actions" style="margin-top:6px">' +
      '<a class="btn secondary" href="#/nhap?card=' + c.id + '" style="text-decoration:none">' + IC.plus + ' Nhập thêm lô</a>' +
      '<a class="btn" href="#/ban?card=' + c.id + '" style="text-decoration:none">' + IC.tag + ' Tạo đơn bán</a>' +
      '<a class="btn secondary" href="#/kho/' + c.id + '/edit" style="text-decoration:none">' + IC.edit + ' Sửa</a>' +
      (setInfo.key && setInfo.key !== '__none__' ? '<a class="btn secondary" href="#/sets/' + encodeURIComponent(setInfo.key) + '" style="text-decoration:none">' + IC.layers + ' Xem trong Bộ sưu tập</a>' : '') +
      '</div>';
    if (c.note) html += '<p style="color:var(--muted);font-size:13px;margin-top:10px">' + BCT.esc(c.note) + '</p>';
    html += '</div></div>';

    html += '<div class="grid-2">';
    html += '<section class="panel"><div class="panel-head"><h2 class="panel-title">Các lô nhập (' + allLots.length + ')</h2><span class="panel-note">FIFO: bán trừ lô cũ nhất trước</span></div>';
    if (!allLots.length) html += '<p class="panel-note">Chưa có lô nào.</p>';
    else {
      html += '<table class="tbl"><thead><tr><th>Ngày nhập</th><th class="r">Còn lại / Gốc</th><th class="r">Giá cost</th><th>Phiên bản</th><th>Nguồn</th></tr></thead><tbody>';
      allLots.forEach(function (l, i) {
        html += '<tr><td>' + BCT.fmtDate(l.importDate) + (i === 0 && l.qtyRemaining > 0 ? ' <span class="tag" style="font-size:9px">FIFO trước</span>' : '') + '</td>' +
          '<td class="r">' + l.qtyRemaining + ' / ' + l.qty + '</td><td class="r">' + BCT.fmtVND(l.costPerUnit) + '</td>' +
          '<td><span class="tag">' + BCT.esc(l.variant || 'Normal') + '</span></td>' +
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
  var setFilter = { sort: 'progress', year: 'all', groupYear: false };

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
    html += '</div>';

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
        if (mode === 'master') {
          var bd = BCT.variantBreakdown(S, cid);
          masterExtra = '<span class="num-var">' + bd.map(function (b) {
            return BCT.esc(b.variant) + ' ×' + b.qty;
          }).join(' · ') + '</span>';
        }
        html += '<button type="button" class="num-cell owned' + (isSecret ? ' secret' : '') + '" data-num="' + n + '" title="' + BCT.esc(c ? c.name : '') + (c && c.rarity ? ' — ' + BCT.esc(c.rarity) : '') + ' — bấm để xem/sửa">' +
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
      html += '<div>' + bd.map(function (b) { return '<span class="vchip">' + BCT.esc(b.variant) + ' ×' + b.qty + '</span>'; }).join('') + '</div>';
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
      try {
        var c = BCT.getCard(S, targetId());
        if (!c) throw new Error('Không tìm thấy card.');
        var setName = document.getElementById('sp-set').value.trim();
        var hit = lookupSetByName(setName);
        c.number = document.getElementById('sp-number').value.trim();
        c.set = setName;
        c.setId = hit ? hit.id : null;
        var rar = document.getElementById('sp-rarity').value;
        if (rar) c.rarity = rar;
        persist(); closeSlotPanel(); toast('Đã cập nhật lá bài.'); render();
      } catch (err) { toast(err.message); }
    });
    document.getElementById('sp-unassign').addEventListener('click', function () {
      if (!confirm('Gỡ lá này khỏi set? Card vẫn nằm trong Kho.')) return;
      var c = BCT.getCard(S, targetId());
      if (c) { c.setId = null; c.set = ''; persist(); closeSlotPanel(); toast('Đã gỡ khỏi set.'); render(); }
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
    html += '<div class="field"><label>Condition</label><select id="e-cond">' +
      ['NM', 'LP', 'MP'].map(function (k) { return '<option' + (c.condition === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div>';
    html += '<div class="field"><label>Graded</label><div style="display:flex;gap:8px"><select id="e-graded-org" style="flex:1"><option value="">Không graded</option>' +
      ['PSA', 'BGS'].map(function (o) { return '<option' + (c.graded && c.graded.org === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
      '</select><input id="e-graded-score" placeholder="Điểm" style="width:80px" inputmode="decimal" value="' + BCT.esc(c.graded ? c.graded.score : '') + '"></div></div>';
    html += '<div class="field full"><label>Ghi chú</label><textarea id="e-note">' + BCT.esc(c.note || '') + '</textarea></div>';
    html += '</div><div class="form-actions"><button class="btn" type="submit">' + IC.check + ' Lưu thay đổi</button><a class="btn secondary" href="#/kho/' + c.id + '" style="text-decoration:none">Hủy</a></div>';
    html += '</section></form>';
    return html;
  }

  /* ================= VIEW: NHẬP KHO ================= */
  var pendingImages = [];

  function setDatalistOptions() {
    if (!window.BCT_SETS) return '';
    return window.BCT_SETS.list.map(function (s) {
      return '<option value="' + BCT.esc(s.name) + '">';
    }).join('');
  }

  // Tìm set theo tên user gõ → hint tổng số lá + setId tương ứng
  function lookupSetByName(name) {
    if (!window.BCT_SETS || !name) return null;
    return window.BCT_SETS.byName(name);
  }

  function setHintHTML(name) {
    var s = lookupSetByName(name);
    if (!s) return 'Gõ tên set hoặc nhập tên khác tự do.';
    var secret = s.total - s.official;
    return 'Set này có <b>' + s.official + ' lá chính</b>' + (secret > 0 ? ' + <b>' + secret + ' secret</b>' : '') +
      ' (tổng ' + s.total + ' lá).';
  }

  function vNhap(q) {
    q = q || {};
    pendingImages = [];
    var prefillCardId = q.card || '';
    // Prefill từ checklist: #/nhap?newcard=1&setkey=<id>&num=<n>
    var forceNew = q.newcard === '1';
    var preSetName = '', preNum = q.num || '';
    if (forceNew && q.setkey && window.BCT_SETS && window.BCT_SETS.byId) {
      var ps = window.BCT_SETS.byId(q.setkey);
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
      '<div class="field"><label>Condition</label><select id="n-cond"><option>NM</option><option>LP</option><option>MP</option></select></div>' +
      '<div class="field"><label>Graded</label><div style="display:flex;gap:8px"><select id="n-graded-org" style="flex:1"><option value="">Không graded</option><option>PSA</option><option>BGS</option></select><input id="n-graded-score" placeholder="Điểm" style="width:80px" inputmode="decimal"></div></div>' +
      '<div class="field full"><label>Ghi chú</label><textarea id="n-note" placeholder="Tình trạng, đặc điểm…"></textarea></div>' +
      '<div class="field full"><label>Ảnh card</label><div class="img-drop" id="img-drop">Bấm để chọn ảnh (tự nén còn ~800px, JPEG) <input type="file" id="n-images" accept="image/*" multiple></div><div class="img-preview" id="img-preview"></div><div class="hint">Nên chụp mặt trước & mặt sau. Ảnh lưu trong trình duyệt (~5MB giới hạn).</div></div>' +
      '</div>';
    html += '<div class="field"><label>Số lượng *</label><input id="n-qty" inputmode="numeric" placeholder="VD: 5"></div>';
    html += '<div class="field"><label>Giá cost / thẻ (VND) *</label><input id="n-cost" inputmode="numeric" placeholder="VD: 10.000"><div class="hint">Giá vốn của đúng lô này.</div></div>';
    html += '<div class="field"><label>Ngày nhập *</label><input id="n-date" type="date" value="' + BCT.todayISO() + '"></div>';
    html += '<div class="field"><label>Nguồn mua</label><input id="n-source" placeholder="VD: Chợ TCG, Shop HN…"></div>';
    html += '<div class="field"><label>Phiên bản</label><select id="n-variant">' +
      BCT.VARIANTS.map(function (v) { return '<option>' + v + '</option>'; }).join('') +
      '</select><div class="hint">Bản thường / Reverse Holo / Holo / 1st Edition.</div></div>';
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
      var helpBtn = $('rarity-help'), pop = $('rarity-pop');
      if (helpBtn && pop) helpBtn.addEventListener('click', function () { pop.hidden = !pop.hidden; });
    }

    if (base === 'kho' && r.segs[2] === 'edit' && $('f-edit')) {
      var cid = r.segs[1];
      var eSet = $('e-set');
      if (eSet) eSet.addEventListener('input', function (e) { $('e-set-hint').innerHTML = setHintHTML(e.target.value.trim()); });
      $('f-edit').addEventListener('submit', function (e) {
        e.preventDefault();
        try {
          var c = BCT.getCard(S, cid);
          if (!c) throw new Error('Không tìm thấy card.');
          var nm = $('e-name').value.trim();
          if (!nm) throw new Error('Nhập tên card.');
          var setName = eSet.value.trim();
          var hit = lookupSetByName(setName);
          c.name = nm; c.set = setName; c.setId = hit ? hit.id : null;
          c.number = $('e-number').value.trim(); c.rarity = $('e-rarity').value;
          c.condition = $('e-cond').value;
          var gOrg = $('e-graded-org').value, gScore = $('e-graded-score').value.trim();
          c.graded = gOrg ? { org: gOrg, score: gScore || '' } : null;
          c.note = $('e-note').value.trim();
          persist(); toast('Đã lưu thay đổi.');
          location.hash = '#/kho/' + cid;
        } catch (err) { toast(err.message); }
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
            try {
              BCT.setManualTotal(S, key, input ? input.value : '');
              persist(); toast('Đã lưu tổng số lá cho set.');
              render();
            } catch (err) { toast(err.message); }
          });
        } else if (el.tagName === 'INPUT') {
          // input nằm trong thẻ <a>: chặn navigate khi bấm vào để gõ
          el.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
          el.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') { ev.preventDefault(); var b = el.parentElement.querySelector('button'); if (b) b.click(); }
          });
        }
      });
      if (!r.segs[1]) {
        if ($('s-sort')) $('s-sort').addEventListener('change', function (e) { setFilter.sort = e.target.value; render(); });
        if ($('s-year')) $('s-year').addEventListener('change', function (e) { setFilter.year = e.target.value; render(); });
        if ($('s-groupyear')) $('s-groupyear').addEventListener('change', function (e) { setFilter.groupYear = e.target.checked; render(); });
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
        try {
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
            var card = {
              id: BCT.uid('card'), name: name,
              set: setName, setId: setHit ? setHit.id : null,
              number: $('n-number').value.trim(),
              rarity: $('n-rarity').value, condition: $('n-cond').value,
              graded: gOrg ? { org: gOrg, score: gScore || '' } : null,
              images: pendingImages.slice(), note: $('n-note').value.trim(),
              createdAt: new Date().toISOString()
            };
            S.cards.push(card);
            cardId = card.id;
          } else {
            cardId = cardSel.value;
          }
          S.lots.push({
            id: BCT.uid('lot'), cardId: cardId, qty: qty, qtyRemaining: qty,
            costPerUnit: cost, importDate: date, source: source,
            variant: $('n-variant').value || 'Normal',
            condition: 'NM', createdAt: new Date().toISOString()
          });
          persist();
          var c = BCT.getCard(S, cardId);
          toast('Đã nhập ' + qty + '× ' + c.name + '.');
          location.hash = '#/kho/' + cardId;
        } catch (err) { toast(err.message); }
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
        try {
          var order = BCT.createOrder(S, {
            date: $('b-date').value || BCT.todayISO(),
            channel: $('b-channel').value,
            buyer: $('b-buyer').value.trim(),
            fees: parseVND($('b-fees').value),
            shippingFee: parseVND($('b-ship').value),
            note: $('b-note').value.trim(),
            lines: [{ cardId: $('b-card').value, qty: $('b-qty').value, sellPrice: parseVND($('b-price').value) }]
          });
          persist();
          toast('Đã lưu đơn · lãi ' + BCT.fmtVND(BCT.orderProfit(order)) + '.');
          location.hash = '#/donhang/' + order.id;
        } catch (err) { toast(err.message); }
      });
    }

    if (base === 'donhang' && !r.segs[1]) {
      $('o-channel').addEventListener('change', function (e) { ordFilter.channel = e.target.value; $('ord-body').innerHTML = ordRows(); });
      $('o-month').addEventListener('change', function (e) { ordFilter.month = e.target.value; $('ord-body').innerHTML = ordRows(); });
    }
  }

  /* ---------- boot ---------- */
  boot();
  render();
})();
