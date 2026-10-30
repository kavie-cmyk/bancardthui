/* Bán Card Thui — cardmatch.js
 * Matching thuần túy (không dependency, không chạm DOM/mạng) dùng chung cho:
 *  (a) tra dictionary thẻ bằng kết quả OCR — tên/số đọc sai vẫn phải ra ứng viên đúng;
 *  (b) ô tìm kiếm kho + storefront — chịu được gõ sai chính tả.
 * Chạy cả browser (global `BCTMatch`) lẫn Node (`module.exports`), cùng phong cách
 * các file js/ khác của repo.
 *
 * Dictionary (do buildIndex nạp) theo format:
 *   { sets: { setId: [nameEN, nameJA] },
 *     cards: [[name, setId, localId, langFlag], ...] }   // langFlag 0=en, 1=jp
 */
(function (root) {
  'use strict';

  // ---------- normName ----------
  // Chuẩn hoá tên/truy vấn để so khớp: NFKC (gập fullwidth/halfwidth kana...),
  // NFD + bỏ dấu tiếng Việt (đ/Đ xử lý riêng vì NFD không tách), lowercase.
  // Chỉ giữ a-z, 0-9, ký tự Nhật (hiragana/katakana/kanji) và khoảng trắng;
  // mọi ký tự lạ khác thành khoảng trắng, rồi gộp khoảng trắng thừa + trim.
  function normName(s) {
    if (s == null) return '';
    var str = String(s).normalize('NFKC');
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    str = str.replace(/đ/g, 'd').replace(/Đ/g, 'D');
    str = str.toLowerCase();
    str = str.replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff\s]/g, ' ');
    str = str.replace(/\s+/g, ' ').trim();
    // OCR tiếng Nhật hay tách 1 tên thành nhiều token (メタモン → "メタ モン"):
    // nối lại khoảng trắng nằm giữa hai ký tự Nhật để khớp tên trong dictionary.
    str = str.replace(/([\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff]) (?=[\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff])/g, '$1');
    // NFC ở cuối: NFD ở trên cũng tách dấu dakuten tiếng Nhật (ピ → ヒ + ゙)
    // nên phải hợp nhất lại, nếu không tên Nhật có dakuten sẽ méo dạng.
    return str.normalize('NFC');
  }

  // ---------- fixNumber ----------
  // Sửa ký tự OCR dễ nhầm trong chuỗi SỐ IN: O/o→0, l/I/i/|→1, S/s→5, B/b→8, G/g→6, Z/z→2.
  // Chỉ áp dụng "khi chuỗi trông như số in" để không phá số in có tiền tố chữ thật
  // (SV001, TG05, GG49, SWSH230...): tiền tố từ 2 chữ cái trở lên được giữ nguyên,
  // chỉ sửa phần đuôi số; tiền tố đúng 1 ký tự dễ nhầm (O77, l41) hoặc chuỗi bắt đầu
  // bằng số (1O2) thì sửa cả ký tự đó. Ký tự ngoài [0-9A-Za-z/] bị bỏ (giữ '|' đủ lâu
  // để map sang 1). Dạng "141" / "077" / "SV001" / "141/102" được giữ nguyên.
  var OCR_CONF = {
    O: '0', o: '0', l: '1', I: '1', i: '1', '|': '1',
    S: '5', s: '5', B: '8', b: '8', G: '6', g: '6', Z: '2', z: '2'
  };
  function mapConf(str) {
    return str.replace(/[OoLlIi|SsBbGgZz]/g, function (c) { return OCR_CONF[c] || c; });
  }
  function fixSegment(seg) {
    if (!seg) return seg;
    if (/^\d+$/.test(seg)) return seg;
    var m = /^([A-Za-z]+)([\s\S]*)$/.exec(seg);
    if (m) {
      var prefix = m[1], tail = m[2];
      if (prefix.length >= 2) return prefix + mapConf(tail);
      if (OCR_CONF[prefix] != null) {
        if (tail === '') return OCR_CONF[prefix]; // chuỗi 1 ký tự kiểu "S" trong ngữ cảnh số
        return OCR_CONF[prefix] + mapConf(tail);
      }
      return prefix + mapConf(tail);
    }
    return mapConf(seg); // bắt đầu bằng số/ký tự dễ nhầm: sửa toàn bộ
  }
  // Trích đúng mẫu SỐ IN từ text thô nhiều token/dòng — điển hình là toàn bộ
  // text OCR của vùng số in, vốn dính cả tên hoạ sĩ ("Illus. ..."), set-mark,
  // dòng phụ. Nối mọi token lại (cách cũ) cho ra chuỗi rác ("H0ED077/191")
  // làm hỏng numKey và kéo tụt mọi ứng viên đúng trong searchDict.
  // Cách trích: dựng "bộ xương" đã map ký tự dễ nhầm sang số, ưu tiên mẫu
  // "n/total" (077/191), sau đó tới dãy số dài nhất. Dãy chỉ được nhận khi
  // chứa ít nhất 1 chữ số THẬT (không phải chữ bị map — tránh "Illus" → "111").
  function extractPrintedNumber(raw) {
    // OCR hay chèn khoảng trắng quanh dấu '/' ("117 / 172") — gộp lại trước.
    var up = String(raw).toUpperCase().replace(/\s*\/\s*/g, '/');
    var skel = '', orig = [];
    for (var i = 0; i < up.length; i++) {
      var c = up[i];
      // OCR_CONF không có mọi biến thể hoa/thường (vd 'L') — tra cả 2 dạng.
      var conf = OCR_CONF[c] || OCR_CONF[c.toLowerCase()];
      if (c >= '0' && c <= '9') { skel += c; orig.push(true); }
      else if (conf) { skel += conf; orig.push(false); }
      else { skel += c; orig.push(false); }
    }
    function hasOrigDigit(from, to) {
      for (var j = from; j < to; j++) if (orig[j]) return true;
      return false;
    }
    var pairRe = /(\d{1,4})\/(\d{1,4})/g, m;
    while ((m = pairRe.exec(skel)) !== null) {
      if (hasOrigDigit(m.index, m.index + m[0].length)) return m[1] + '/' + m[2];
    }
    var runRe = /\d+/g, best = null;
    while ((m = runRe.exec(skel)) !== null) {
      if (m[0].length > 4) continue;
      if (!hasOrigDigit(m.index, m.index + m[0].length)) continue;
      if (!best || m[0].length >= best.length) best = { text: m[0], length: m[0].length };
    }
    return best ? best.text : null;
  }

  function fixNumber(s) {
    if (s == null) return '';
    var rawStr = String(s);
    // Đầu vào nhiều token/dòng → trích số in; không trích được thì coi như
    // không đọc được số ('') thay vì gộp thành chuỗi rác.
    if (/\s/.test(rawStr)) {
      var ex = extractPrintedNumber(rawStr);
      return ex || '';
    }
    var str = rawStr.replace(/[^0-9A-Za-z\/|]/g, '');
    if (!str) return '';
    return str.split('/').map(fixSegment).join('/');
  }

  // ---------- numKey ----------
  // Khoá so số in: lấy phần trước '/', nếu toàn số thì bỏ zero đầu ("077" = "77");
  // dạng có tiền tố chữ (TG05, SV001) thì uppercase để so không phân biệt hoa thường.
  // Đi qua fixNumber trước nên số OCR ("O77", "l17") và số sạch cho cùng một khoá —
  // cả hai phía (dictionary + truy vấn) đều qua cùng một hàm nên luôn nhất quán.
  function numKey(s) {
    if (s == null) return '';
    var part = fixNumber(s).split('/')[0].trim().toUpperCase();
    if (/^\d+$/.test(part)) return part.replace(/^0+(?=\d)/, '');
    return part;
  }

  // ---------- parseQuery ----------
  var SET_CODE_RE = /^[a-z]{1,4}\d{1,2}(?:\.\d+)?[a-z]?$/i; // sv08, sm10, s12a, sv4a, base1, me02.5...
  function isSetCodeToken(t) { return SET_CODE_RE.test(t); }
  function isNumberToken(t) {
    var x = t.replace(/^#+/, '');
    if (/^\d+(\/\d+)?$/.test(x)) return true;                    // 226, 077, 226/191
    if (/^[A-Za-z]{1,4}\d{1,4}(\/\d+)?$/.test(x)) return true;   // TG05, SV001, SWSH230, l17 (OCR)
    if (/^[\dOoLlIiSsBbGgZz]+$/.test(x) && /\d/.test(x) && /[OoLlIiSsBbGgZz]/.test(x)) return true; // 1O2, 1l7
    return false;
  }

  // Tách truy vấn thô thành { text, setCode, number }.
  // Mã set chỉ được tách khi token đầu/cuối (rồi mới tới token giữa) khớp mẫu mã set
  // VÀ còn một token số riêng đi kèm ("sv08 226", "226 sv08", "Pikachu sv08 226").
  // Truy vấn toàn số → number, text = ''. Token số đơn độc kiểu "Pikachu 25" cũng
  // được tách làm number. Token gộp "sv08-226" / "sv08/226" tách cả hai.
  // number trả về đã qua fixNumber (sửa lỗi OCR) — setCode trả về lowercase.
  function parseQuery(q) {
    var out = { text: '', setCode: null, number: null };
    if (q == null) return out;
    var raw = String(q).trim();
    if (!raw) return out;
    var tokens = raw.split(/\s+/);
    if (tokens.length === 1) {
      var cmb = /^([A-Za-z]+\d+[A-Za-z]?)[-\/](\d+)$/.exec(tokens[0]);
      if (cmb && isSetCodeToken(cmb[1])) {
        out.setCode = cmb[1].toLowerCase();
        out.number = fixNumber(cmb[2]);
        return out;
      }
      if (isNumberToken(tokens[0])) {
        out.number = fixNumber(tokens[0].replace(/^#+/, ''));
        return out;
      }
      out.text = raw;
      return out;
    }
    var used = tokens.map(function () { return false; });
    // Mã set: ưu tiên token đầu, rồi cuối, rồi token giữa — chỉ khi còn token số riêng.
    var order = [0, tokens.length - 1];
    for (var i = 0; i < tokens.length; i++) if (order.indexOf(i) < 0) order.push(i);
    var setIdx = -1;
    for (var oi = 0; oi < order.length; oi++) {
      var idx = order[oi];
      if (!isSetCodeToken(tokens[idx])) continue;
      var hasOtherNumber = tokens.some(function (t, j) { return j !== idx && isNumberToken(t); });
      if (hasOtherNumber) { setIdx = idx; break; }
    }
    if (setIdx >= 0) { out.setCode = tokens[setIdx].toLowerCase(); used[setIdx] = true; }
    // Số in: ưu tiên token cuối, rồi đầu, rồi token giữa còn lại.
    var nOrder = [tokens.length - 1, 0];
    for (var k = 0; k < tokens.length; k++) if (nOrder.indexOf(k) < 0) nOrder.push(k);
    var numIdx = -1;
    for (var ni = 0; ni < nOrder.length; ni++) {
      var nIdx = nOrder[ni];
      if (used[nIdx]) continue;
      if (isNumberToken(tokens[nIdx])) { numIdx = nIdx; break; }
    }
    if (numIdx >= 0) { out.number = fixNumber(tokens[numIdx].replace(/^#+/, '')); used[numIdx] = true; }
    out.text = tokens.filter(function (_, j) { return !used[j]; }).join(' ');
    return out;
  }

  // ---------- Levenshtein có chặn ----------
  // Trả khoảng cách thật nếu <= maxDist, ngược lại trả maxDist + 1 (dừng sớm theo hàng).
  function levWithin(a, b, maxDist) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > maxDist) return maxDist + 1;
    if (a === b) return 0;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var rowMin = cur[0];
      for (j = 1; j <= lb; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > maxDist) return maxDist + 1;
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[lb];
  }

  // ---------- chấm điểm tên ----------
  // Thang: khớp norm tuyệt đối 60 > prefix 40 > substring 30 > theo token (tối đa 28).
  // Token: khớp tuyệt đối 12, prefix 8, fuzzy Levenshtein 6 (≤1 khi token dài ≥4,
  // ≤2 khi dài ≥7), substring 5; mọi token truy vấn đều khớp thì +6; token thừa
  // phía tên lá -1/token (tối đa -3) để "Pikachu" thắng "Pikachu VMAX" khi gõ sai.
  function scoreName(qNorm, qTokens, rec) {
    if (!qNorm || !rec.norm) return 0;
    var rn = rec.norm;
    if (rn === qNorm) return 60;
    if (rn.indexOf(qNorm) === 0) return 40;
    if (rn.indexOf(qNorm) >= 0) return 30;
    // OCR: chuỗi truy vấn DÍNH NHIỄU nhưng chứa trọn tên lá (vd tên Nhật bị
    // gộp token "をタンメタモン…" chứa "メタモン") — vẫn là bằng chứng mạnh.
    if (rn.length >= 3 && qNorm.indexOf(rn) >= 0) return 30;
    var rt = rec.tokens || [];
    var sum = 0, matched = 0;
    for (var i = 0; i < qTokens.length; i++) {
      var qt = qTokens[i], best = 0;
      for (var j = 0; j < rt.length; j++) {
        var t = rt[j], s = 0;
        if (t === qt) s = 12;
        else if (qt.length >= 2 && t.indexOf(qt) === 0) s = 8;
        else if (qt.length >= 3 && t.indexOf(qt) >= 0) s = 5;
        else if (t.length >= 3 && qt.indexOf(t) >= 0) s = 6; // token truy vấn chứa trọn token tên (OCR gộp/dính nhiễu)
        else if (qt.length >= 4) {
          var maxD = qt.length >= 7 ? 2 : 1;
          if (Math.abs(t.length - qt.length) <= maxD && levWithin(qt, t, maxD) <= maxD) s = 6;
        }
        if (s > best) best = s;
        if (best === 12) break;
      }
      if (best > 0) matched++;
      sum += best;
    }
    if (!matched) return 0;
    var score = Math.min(sum, 28);
    if (matched === qTokens.length) score = Math.min(score + 6, 28);
    score -= Math.min(3, Math.max(0, rt.length - qTokens.length));
    return score;
  }

  // ---------- buildIndex ----------
  // dict: { sets: {setId: [nameEN, nameJA]}, cards: [[name, setId, localId, langFlag]] }
  // Trả index: records [{name, norm, setId, number, numKey, lang, tokens}] +
  // byNumKey / bySet (khoá setId lowercase) để searchDict lọc nhanh trước khi chấm điểm.
  function buildIndex(dict) {
    var sets = (dict && dict.sets) || {};
    var rows = (dict && dict.cards) || [];
    var records = [];
    var byNumKey = Object.create(null);
    var bySet = Object.create(null);
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row) continue;
      var name = String(row[0] == null ? '' : row[0]);
      var setId = String(row[1] == null ? '' : row[1]);
      var number = String(row[2] == null ? '' : row[2]);
      var lang = (row[3] === 1 || row[3] === 'jp' || row[3] === 'ja') ? 'jp' : 'en';
      var norm = normName(name);
      var rec = {
        name: name, norm: norm, setId: setId, number: number,
        numKey: numKey(number), lang: lang,
        tokens: norm ? norm.split(' ') : []
      };
      records.push(rec);
      if (rec.numKey) (byNumKey[rec.numKey] = byNumKey[rec.numKey] || []).push(rec);
      var sk = setId.toLowerCase();
      (bySet[sk] = bySet[sk] || []).push(rec);
    }
    return { records: records, cards: records, sets: sets, byNumKey: byNumKey, bySet: bySet, size: records.length };
  }

  function setNameFor(index, rec) {
    var sets = index.sets || {};
    var entry = sets[rec.setId];
    if (entry == null) {
      var keys = Object.keys(sets);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].toLowerCase() === rec.setId.toLowerCase()) { entry = sets[keys[i]]; break; }
      }
    }
    if (Array.isArray(entry)) {
      var v = rec.lang === 'jp' ? (entry[1] || entry[0]) : (entry[0] || entry[1]);
      return v || rec.setId;
    }
    if (typeof entry === 'string' && entry) return entry;
    return rec.setId;
  }

  // ---------- searchDict ----------
  // query: chuỗi thô (OCR/người gõ) hoặc { name?, number?, setCode?, lang? }.
  // opts: { lang?: 'en'|'jp', limit?: number = 8 }.
  // Lọc pool bằng map số/set TRƯỚC (nhanh trên ~35–50k lá), rồi chấm điểm:
  // số in khớp +100, set khớp +50, tên theo scoreName; số có mà không khớp -25.
  // Có text thì bắt buộc điểm tên > 0 — trừ vòng fallback: nếu pool theo số không có
  // lá nào khớp tên (số OCR đọc sai hẳn), tìm lại theo tên trên toàn dict/set và
  // trừ điểm số sai, để ứng viên đúng tên vẫn lọt top thay vì trả rỗng.
  function searchDict(index, query, opts) {
    opts = opts || {};
    var limit = opts.limit != null ? Math.max(0, Math.floor(Number(opts.limit)) || 0) : 8;
    if (!index || !index.records || limit === 0) return [];
    var text = '', numberRaw = null, setCode = null, lang = opts.lang || null;
    if (query == null) return [];
    if (typeof query === 'string') {
      var p = parseQuery(query);
      text = p.text; numberRaw = p.number; setCode = p.setCode;
    } else {
      text = query.name != null ? String(query.name) : (query.text != null ? String(query.text) : '');
      numberRaw = query.number != null ? String(query.number) : null;
      setCode = query.setCode != null ? String(query.setCode).toLowerCase()
        : (query.setId != null ? String(query.setId).toLowerCase() : null);
      if (query.lang) lang = query.lang;
    }
    if (lang === 'ja') lang = 'jp';
    if (lang !== 'en' && lang !== 'jp') lang = null;
    var qNorm = normName(text);
    var qTokens = qNorm ? qNorm.split(' ') : [];
    var qNumKey = numberRaw ? numKey(numberRaw) : null;
    if (!qNumKey) qNumKey = null;
    if (!qNorm && !qNumKey && !setCode) return [];

    function applyLang(pool) {
      if (!lang) return pool;
      var lp = pool.filter(function (r) { return r.lang === lang; });
      return lp.length ? lp : pool; // lọc mềm: lang sai/OCR đoán nhầm không được làm rỗng kết quả
    }
    function scorePool(pool) {
      var out = [];
      for (var i = 0; i < pool.length; i++) {
        var rec = pool[i];
        var nameScore = qNorm ? scoreName(qNorm, qTokens, rec) : 0;
        if (qNorm && nameScore <= 0) continue;
        var score = nameScore;
        if (qNumKey) score += rec.numKey === qNumKey ? 100 : -25;
        if (setCode && rec.setId.toLowerCase() === setCode) score += 50;
        out.push({ rec: rec, nameScore: nameScore, score: score });
      }
      return out;
    }

    var pool;
    if (qNumKey && setCode) {
      var inSet = index.bySet[setCode] || [];
      pool = inSet.filter(function (r) { return r.numKey === qNumKey; });
      if (!pool.length) pool = (index.byNumKey[qNumKey] || []).slice();
      if (!pool.length) pool = inSet.slice();
    } else if (qNumKey) {
      pool = (index.byNumKey[qNumKey] || []).slice();
    } else if (setCode) {
      pool = (index.bySet[setCode] || []).slice();
    } else {
      pool = index.records;
    }
    var scored = scorePool(applyLang(pool));
    if (!scored.length && qNorm && qNumKey) {
      var pool2 = setCode ? (index.bySet[setCode] || []).slice() : index.records;
      scored = scorePool(applyLang(pool2));
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
      var la = a.rec.norm.length, lb = b.rec.norm.length;
      if (la !== lb) return la - lb;
      if (a.rec.name !== b.rec.name) return a.rec.name < b.rec.name ? -1 : 1;
      if (a.rec.setId !== b.rec.setId) return a.rec.setId < b.rec.setId ? -1 : 1;
      return a.rec.number < b.rec.number ? -1 : (a.rec.number > b.rec.number ? 1 : 0);
    });
    return scored.slice(0, limit).map(function (w) {
      return {
        name: w.rec.name, setId: w.rec.setId, setName: setNameFor(index, w.rec),
        number: w.rec.number, lang: w.rec.lang, score: w.score
      };
    });
  }

  // ---------- searchList ----------
  // Cho ô tìm kiếm kho/storefront: items là mảng object bất kỳ,
  // fields(item) → { name, set, number } (chuỗi, thiếu thì để '').
  // Dùng cùng logic chấm điểm tên/số/set như searchDict. Truy vấn rỗng →
  // trả nguyên thứ tự gốc. Không đột biến mảng gốc (trả mảng mới).
  function searchList(items, query, fields) {
    if (!Array.isArray(items)) return [];
    var raw = query == null ? '' : String(query);
    if (!raw.trim()) return items.slice();
    var p = parseQuery(raw);
    var qNorm = normName(p.text);
    var qTokens = qNorm ? qNorm.split(' ') : [];
    var qNumKey = p.number ? numKey(p.number) : null;
    if (!qNumKey) qNumKey = null;
    var rawNorm = normName(raw);
    var wrapped = [];
    items.forEach(function (item, idx) {
      var f = {};
      if (typeof fields === 'function') {
        try { f = fields(item) || {}; } catch (e) { f = {}; }
      }
      var fName = f.name != null ? String(f.name) : '';
      var fSet = f.set != null ? String(f.set) : '';
      var fNum = f.number != null ? String(f.number) : '';
      var nName = normName(fName);
      var recLike = { norm: nName, tokens: nName ? nName.split(' ') : [] };
      var score = 0;
      if (qNorm) score += scoreName(qNorm, qTokens, recLike);
      if (qNumKey && fNum && numKey(fNum) === qNumKey) score += 100;
      if (p.setCode) {
        var forms = [fSet.toLowerCase(), normName(fSet), normName(fSet).replace(/ /g, '')];
        if (forms.indexOf(p.setCode) >= 0) score += 50;
      }
      if (qNorm && fSet) {
        var nSet = normName(fSet);
        if (nSet && nSet.indexOf(qNorm) >= 0) score += 5; // gõ tên set vẫn ra lá trong set
      }
      if (score <= 0 && rawNorm) {
        // parseQuery có thể đã tách token kiểu khác ý người gõ (vd mã set đứng một
        // mình bị hiểu thành số) — thử lại bằng chuỗi thô trên tổ hợp 3 trường.
        var combo = normName(fName + ' ' + fSet + ' ' + fNum);
        if (combo && combo.indexOf(rawNorm) >= 0) score = 10;
      }
      if (score > 0) wrapped.push({ item: item, score: score, idx: idx });
    });
    wrapped.sort(function (a, b) { return (b.score - a.score) || (a.idx - b.idx); });
    return wrapped.map(function (w) { return w.item; });
  }

  var BCTMatch = {
    normName: normName,
    fixNumber: fixNumber,
    numKey: numKey,
    parseQuery: parseQuery,
    buildIndex: buildIndex,
    searchDict: searchDict,
    searchList: searchList
  };
  root.BCTMatch = BCTMatch;
  if (typeof module !== 'undefined' && module.exports) module.exports = BCTMatch;
})(typeof window !== 'undefined' ? window : globalThis);
