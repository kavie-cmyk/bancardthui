// Public market data only. JWT verification remains enabled at the gateway.
// TCGCSV is a backend-only, daily-cached independent TCGplayer feed.
import '../../../js/pricing.js';
const P = (globalThis as any).BCTPricing;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};
const DAY = 24 * 60 * 60 * 1000;
type Source = { source: string; price: number; currency: string; updated_at: string | null; [key: string]: any };
type CacheRow = { resource: string; payload: { body: any; build: string | null }; fetched_at: string; source_updated_at: string | null };
type Context = { deadline: number; notes: string[] };
const pending = new Map<string, Promise<CacheRow>>();
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
async function request(url: string, opts: RequestInit, ctx: Context, ms = 5000, text = false): Promise<any> {
  const remaining = ctx.deadline - Date.now();
  if (remaining <= 0) throw new Error('Hết thời gian chờ nguồn giá');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(ms, remaining));
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { body: text ? await r.text() : await r.json(), updated: r.headers.get('last-modified') };
  } finally { clearTimeout(timer); }
}
function cacheConfig() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Thiếu cấu hình cache máy chủ');
  return { url: `${url}/rest/v1/price_feed_cache`, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}
async function readCache(resource: string, ctx: Context): Promise<CacheRow | null> {
  const cfg = cacheConfig();
  const r = await request(cfg.url + '?resource=eq.' + encodeURIComponent(resource) + '&select=*', { headers: cfg.headers }, ctx, 3000);
  return r.body[0] || null;
}
async function writeCache(row: CacheRow, ctx: Context) {
  const cfg = cacheConfig();
  const remaining = ctx.deadline - Date.now();
  if (remaining < 500) throw new Error('Hết thời gian ghi cache');
  const r = await fetch(cfg.url + '?on_conflict=resource', {
    method: 'POST', headers: { ...cfg.headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row), signal: AbortSignal.timeout(Math.min(3000, remaining)),
  });
  if (!r.ok) throw new Error(`Cache HTTP ${r.status}`);
}
async function cachedFeed(path: string, ctx: Context): Promise<CacheRow> {
  // Share simultaneous requests in this isolate; persistent cache survives cold starts.
  if (pending.has(path)) return await pending.get(path)!;
  const promise = (async () => {
    const old = await readCache(path, ctx);
    if (old && Date.now() - Date.parse(old.fetched_at) < DAY) return old;
    try {
      const isBuild = path === 'last-updated.txt';
      const build = isBuild ? null : (await cachedFeed('last-updated.txt', ctx)).payload.body.trim();
      if (old && build && old.payload.build === build) {
        const touched = { ...old, fetched_at: new Date().toISOString() };
        await writeCache(touched, ctx);
        return touched;
      }
      // Follow the publisher's request spacing and custom User-Agent guidance.
      await new Promise((resolve) => setTimeout(resolve, 100));
      const r = await request('https://tcgcsv.com/' + path, { headers: { 'User-Agent': 'BanCardThui/2.0', Accept: 'application/json' } }, ctx, 5000, isBuild);
      if (isBuild ? !Number.isFinite(Date.parse(r.body.trim())) : (r.body.success !== true || !Array.isArray(r.body.results))) {
        throw new Error('TCGCSV trả dữ liệu không hợp lệ');
      }
      const row: CacheRow = { resource: path, payload: { body: r.body, build }, fetched_at: new Date().toISOString(),
        source_updated_at: r.updated ? new Date(r.updated).toISOString() : (build ? new Date(build).toISOString() : null) };
      await writeCache(row, ctx);
      return row;
    } catch (e) {
      // Preserve the feed's original timestamp; never date an old price as new.
      if (old && Date.now() - Date.parse(old.fetched_at) < 7 * DAY) {
        ctx.notes.push('TCGCSV dùng cache cũ, giữ ngày dữ liệu gốc');
        return old;
      }
      throw e;
    }
  })();
  pending.set(path, promise);
  try { return await promise; } finally { pending.delete(path); }
}
async function tcgdexCard(set: string, nums: string[], ctx: Context) {
  for (const n of nums) {
    try {
      const r = await request(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(set)}-${encodeURIComponent(n)}`, {}, ctx, 4000);
      if (r.body.set?.id !== set || P.numberKey(r.body.localId) !== P.numberKey(n)) throw new Error('Không khớp mã lá bài');
      return r.body;
    } catch (e) {
      ctx.notes.push(`TCGdex ${n}: ${String(e)}`);
      if (!String(e).includes('HTTP 404')) break;
    }
  }
  return null;
}
async function csvPricing(set: string, nums: string[], card: any, ctx: Context): Promise<Source[]> {
  // The set metadata is English. Never infer a TCGplayer group from a client-supplied name.
  const meta = await request(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(set)}`, {}, ctx, 4000);
  if (meta.body.id !== set) throw new Error('Không khớp bộ bài');
  const groups = await cachedFeed('tcgplayer/3/groups', ctx);
  const group = P.selectGroup(groups.payload.body.results, meta.body);
  if (!group) throw new Error('Chưa ghép được duy nhất một bộ bài TCGplayer');
  const prefix = `tcgplayer/3/${group.groupId}/`;
  const products = await cachedFeed(prefix + 'products', ctx);
  const product = P.selectProduct(products.payload.body.results, nums[0], card?.name);
  if (!product) throw new Error('Không tìm được duy nhất một sản phẩm đúng số lá');
  const prices = await cachedFeed(prefix + 'prices', ctx);
  const sources = P.fromCsv(prices.payload.body.results, product, prices.source_updated_at);
  ctx.notes.push(`TCGCSV group ${group.groupId}, product ${product.productId}: ${sources.length} nguồn`);
  return sources;
}
async function ioPricing(set: string, nums: string[], ctx: Context): Promise<Source[]> {
  for (const s of P.ioSetIds(set)) {
    for (const n of nums) {
      try {
        const r = await request(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(s)}-${encodeURIComponent(n)}`, {}, ctx, 3000);
        if (r.body.data?.set?.id !== s || P.numberKey(r.body.data.number) !== P.numberKey(n)) continue;
        return P.fromIo(r.body.data);
      } catch (e) {
        ctx.notes.push(`pokemontcg.io ${s}-${n}: ${String(e)}`);
        if (!String(e).includes('HTTP 404')) return [];
      }
    }
  }
  return [];
}
export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'Chỉ hỗ trợ GET' }, 405);
  const ctx: Context = { deadline: Date.now() + 22000, notes: [] };
  const u = new URL(req.url);
  const set = (u.searchParams.get('set') || '').trim();
  const number = (u.searchParams.get('number') || '').trim();
  if (!/^[a-zA-Z0-9.\-]{1,40}$/.test(set) || !/^[a-zA-Z0-9/ \-]{1,30}$/.test(number)) return json({ error: 'Mã bộ bài hoặc số lá không hợp lệ' }, 400);
  const nums = P.numberCandidates(number);
  if (!nums.length) return json({ error: 'Thiếu số lá bài' }, 400);
  let sources: Source[] = [];
  try {
    const card = await tcgdexCard(set, nums, ctx);
    const direct = P.fromTcgdex(card?.pricing);
    sources = direct;
    // When a browser is missing TCGplayer, verify the independent feed even if
    // this server's TCGdex route happens to contain it. This also makes the
    // fallback diagnosable without relying on reproducing an upstream outage.
    if (!sources.some((s) => s.source === 'tcgplayer') || u.searchParams.get('missing') === 'tcgplayer') {
      try {
        const csv = await csvPricing(set, nums, card, ctx);
        sources = P.mergeSources(sources, csv);
      } catch (e) { ctx.notes.push(`TCGCSV: ${String(e)}`); }
    }
    if (!sources.some((s) => s.source === 'cardmarket') || !sources.some((s) => s.source === 'tcgplayer')) {
      const extra = await ioPricing(set, nums, ctx);
      // Only fill missing sources. Do not overwrite an available current feed.
      sources = P.mergeSources(extra, sources);
    }
    return json({ sources, diag: ctx.notes.join(' | '), card: `${set}-${nums[0]}`, version: 2 });
  } catch (e) {
    return json({ sources, diag: ctx.notes.concat(String(e)).join(' | '), version: 2 });
  }
}
Deno.serve(handler);
