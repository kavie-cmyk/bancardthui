/* Pure pricing helpers shared by the browser and price-proxy. */
(function (root) {
  'use strict';
  function positive(value) {
    if (value == null || value === '' || typeof value === 'boolean') return null;
    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function firstPrice(values) {
    for (var i = 0; i < values.length; i++) {
      var n = positive(values[i]);
      if (n != null) return n;
    }
    return null;
  }
  function numberKey(number) {
    var s = String(number == null ? '' : number).trim().split('/')[0].trim().toUpperCase();
    return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s;
  }
  function numberCandidates(number) {
    var raw = String(number == null ? '' : number).trim().split('/')[0].trim();
    var out = [numberKey(raw)];
    if (out.indexOf(raw) < 0) out.push(raw);
    if (/^\d+$/.test(raw) && out.indexOf(raw.padStart(3, '0')) < 0) out.push(raw.padStart(3, '0'));
    return out.filter(Boolean);
  }
  function ioSetIds(setId) {
    var s = String(setId || '').trim();
    var aliases = { swshp: 'swshp', smp: 'smp', xyp: 'xyp', bwp: 'bwp', svp: 'svp' };
    var out = aliases[s] ? [aliases[s]] : [];
    var m = /^([a-z]+?)(\d+)(?:\.(\d+))?$/.exec(s);
    if (m) {
      var base = m[1] + String(parseInt(m[2], 10));
      if (m[3]) out.push(base + 'pt' + m[3], base + m[3]);
      else out.push(base);
    }
    if (out.indexOf(s) < 0) out.push(s);
    return out;
  }
  function tcgVariant(tp, field) {
    // Keep the app's existing preference. Handle all upstream spellings,
    // including unlimited/1st-edition prices used by older sets.
    var keys = ['holofoil', 'holo', 'normal', 'reverse-holofoil', 'reverseHolofoil', 'reverse',
      'unlimitedHolofoil', 'unlimited', '1stEditionHolofoil', '1stEdition'];
    for (var i = 0; i < keys.length; i++) {
      var p = tp && tp[keys[i]];
      var n = p && positive(p[field]);
      if (n != null) return { price: n, variant: keys[i], product_id: p.productId || null };
    }
    return null;
  }
  function fromTcgdex(pricing) {
    var out = [];
    if (!pricing) return out;
    var cm = pricing.cardmarket;
    if (cm) {
      var n = firstPrice([cm.trend, cm.avg]);
      if (n != null) out.push({ source: 'cardmarket', price: n, currency: 'EUR',
        kind: positive(cm.trend) != null ? 'trend' : 'avg',
        updated_at: cm.updated || cm.updatedAt || null, via: 'tcgdex' });
    }
    var tp = pricing.tcgplayer || pricing.tcgPlayer;
    var v = tcgVariant(tp, 'marketPrice');
    if (v) out.push(Object.assign({ source: 'tcgplayer', currency: 'USD', kind: 'market',
      updated_at: tp.updated || tp.updatedAt || null, via: 'tcgdex' }, v));
    return out;
  }
  function fromIo(card) {
    if (!card) return [];
    var out = [];
    var cm = card.cardmarket && card.cardmarket.prices;
    var n = cm && firstPrice([cm.trendPrice, cm.averageSellPrice]);
    if (n != null) out.push({ source: 'cardmarket', price: n, currency: 'EUR',
      kind: positive(cm.trendPrice) != null ? 'trend' : 'avg',
      updated_at: String(card.cardmarket.updatedAt || '').replace(/\//g, '-') || null, via: 'pokemontcg.io' });
    var tp = card.tcgplayer && card.tcgplayer.prices;
    var v = tcgVariant(tp, 'market');
    if (v) out.push(Object.assign({ source: 'tcgplayer', currency: 'USD', kind: 'market',
      updated_at: String(card.tcgplayer.updatedAt || '').replace(/\//g, '-') || null, via: 'pokemontcg.io' }, v));
    return out;
  }
  function nameKey(name) {
    return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function selectGroup(groups, set) {
    // Exact set name after the series prefix, or its official abbreviation.
    // Never select a group by a partial-name match (151 != Japanese 151).
    var key = nameKey(set.name);
    var abbr = nameKey(set.abbreviation && set.abbreviation.official);
    var found = groups.filter(function (g) {
      return key && (nameKey(g.name) === key || nameKey(String(g.name).replace(/^[^:]+:\s*/, '')) === key ||
        (abbr && nameKey(g.abbreviation) === abbr));
    });
    return found.length === 1 ? found[0] : null;
  }
  function selectProduct(products, number, cardName) {
    var key = numberKey(number);
    var found = products.filter(function (p) {
      return (p.extendedData || []).some(function (d) {
        return String(d.name).toLowerCase() === 'number' && numberKey(d.value) === key;
      });
    });
    if (found.length > 1 && cardName) {
      var nk = nameKey(cardName);
      found = found.filter(function (p) {
        return nameKey(String(p.name).replace(/\s*-?\s*[A-Za-z]*\d+\s*\/\s*\d+.*$/, '')) === nk;
      });
    }
    // Ambiguous printings must not silently use another product's price.
    return found.length === 1 ? found[0] : null;
  }
  function fromCsv(prices, product, updatedAt) {
    if (!product) return [];
    var ranks = ['holofoil', 'normal', 'reverseholofoil', 'unlimitedholofoil', 'unlimited', '1steditionholofoil', '1stedition'];
    var found = prices.filter(function (p) { return p.productId === product.productId && positive(p.marketPrice) != null; });
    found.sort(function (a, b) {
      var ai = ranks.indexOf(nameKey(a.subTypeName)), bi = ranks.indexOf(nameKey(b.subTypeName));
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
    if (!found.length) return [];
    return [{ source: 'tcgplayer', price: positive(found[0].marketPrice), currency: 'USD', kind: 'market',
      updated_at: updatedAt || null, via: 'tcgcsv', product_id: product.productId,
      variant: found[0].subTypeName }];
  }
  function mergeSources(old, fresh) {
    var map = Object.create(null);
    (old || []).concat(fresh || []).forEach(function (e) {
      if (e && e.source && positive(e.price) != null) map[e.source] = e;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  root.BCTPricing = { positive: positive, numberKey: numberKey, numberCandidates: numberCandidates,
    ioSetIds: ioSetIds, fromTcgdex: fromTcgdex, fromIo: fromIo, selectGroup: selectGroup,
    selectProduct: selectProduct, fromCsv: fromCsv, mergeSources: mergeSources };
})(globalThis);
