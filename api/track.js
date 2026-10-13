// POST /api/track — anonymous, aggregated interaction events from the storefront.
// Body: { v: "<random visitor id>", x: "A"|"H", ev: [{ t: "imp"|"view"|"add"|"chk", p: [packageId, ...] }] }
import { pipeline, storeReady, day, TTL, json } from "./_store.js";
const TYPES = new Set(["imp", "view", "add", "chk"]);
export async function POST(request) {
  if (!storeReady()) return json({ ok: false, reason: "store not configured" }, 503);
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ ok: false }, 400); }
  const v = String(body?.v || "").replace(/[^a-z0-9]/gi, "").slice(0, 32);
  const x = body?.x === "H" ? "H" : "A";
  const ev = Array.isArray(body?.ev) ? body.ev.slice(0, 20) : [];
  if (!v || !ev.length) return json({ ok: false }, 400);
  // basic abuse protection: max 40 batches per visitor+ip per 10 minutes
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim().replace(/[^0-9a-f:.]/gi, "");
  const slot = Math.floor(Date.now() / 6e5);
  const [count] = await pipeline([["INCR", `rl:${ip}:${slot}`], ["EXPIRE", `rl:${ip}:${slot}`, 700]]);
  if (count > 40) return json({ ok: false, reason: "rate" }, 429);
  const d = day(), H = `d:${d}`, cmds = [];
  for (const e of ev) {
    if (!TYPES.has(e?.t) || !Array.isArray(e.p)) continue;
    for (const raw of e.p.slice(0, 40)) {
      const p = parseInt(raw, 10); if (!(p > 0)) continue;
      cmds.push(["HINCRBY", H, `${e.t}:${p}`, 1]);
      cmds.push(["HINCRBY", H, `x${x}:${e.t}:${p}`, 1]);
      if (e.t === "view") cmds.push(["PFADD", `u:${d}:${p}`, v], ["EXPIRE", `u:${d}:${p}`, TTL]);
    }
  }
  if (!cmds.length) return json({ ok: false }, 400);
  cmds.push(["EXPIRE", H, TTL]);
  await pipeline(cmds);
  return json({ ok: true });
}
