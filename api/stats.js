// GET /api/stats — aggregated, anonymous product metrics used by the tag + ranking engine and /#/insights.
import { pipeline, storeReady, daysBack, json } from "./_store.js";
const WINDOWS = { d3: 3, d7: 7, d14: 14, d30: 30 };
export async function GET(request) {
  const cache = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };
  if (!storeReady()) return json({ ready: false, products: {} }, 200, cache);
  const days = daysBack(30);
  const hashes = await pipeline(days.map(d => ["HGETALL", `d:${d}`]));
  const products = {}, series = [], variants = { A: {}, H: {} };
  const P = id => (products[id] ||= { id: +id });
  hashes.forEach((arr, i) => {
    const pairs = {}; for (let k = 0; arr && k < arr.length; k += 2) pairs[arr[k]] = +arr[k + 1] || 0;
    const tot = { day: days[i], imp: 0, view: 0, add: 0, chk: 0, buy: 0 };
    for (const [f, n] of Object.entries(pairs)) {
      const parts = f.split(":");
      if (parts.length === 2) {
        const [t, id] = parts, p = P(id);
        for (const [w, len] of Object.entries(WINDOWS)) if (i < len) p[`${t}_${w}`] = (p[`${t}_${w}`] || 0) + n;
        if (i >= 3 && i < 17) p[`${t}_prev14`] = (p[`${t}_prev14`] || 0) + n; // baseline for trend detection
        if (t in tot) tot[t] += n;
      } else if (parts.length === 3 && i < 30) { // xA:view:123
        const g = parts[0].slice(1), t = parts[1];
        if (variants[g]) variants[g][t] = (variants[g][t] || 0) + n;
      }
    }
    series.push(tot);
  });
  const ids = Object.keys(products);
  if (ids.length) {
    const d7 = days.slice(0, 7);
    const uniq = await pipeline(ids.map(id => ["PFCOUNT", ...d7.map(d => `u:${d}:${id}`)]));
    ids.forEach((id, i) => { products[id].uniq_d7 = uniq[i] || 0; });
  }
  const totals = await pipeline([["HGETALL", "tot"]]);
  const t = totals[0] || []; for (let k = 0; k < t.length; k += 2) { const [, id] = t[k].split(":"); P(id).buy_all = +t[k + 1] || 0; }
  return json({ ready: true, generated: new Date().toISOString(), products, series: series.reverse(), variants }, 200, cache);
}
