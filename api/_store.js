// Tiny Upstash/Vercel-KV REST client (no dependencies).
// Vercel injects KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*) when a Redis store is connected.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const storeReady = () => Boolean(URL_ && TOKEN);
export async function pipeline(cmds) {
  if (!cmds.length) return [];
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`store ${r.status}`);
  const out = await r.json();
  return out.map(x => (x && "result" in x ? x.result : null));
}
export const day = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, "");
export const daysBack = n => Array.from({ length: n }, (_, i) => day(new Date(Date.now() - i * 864e5)));
export const TTL = 60 * 60 * 24 * 45; // keep 45 days of daily buckets
export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...extra } });
