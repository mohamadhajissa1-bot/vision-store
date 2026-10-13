// POST /api/tebex-webhook — Tebex webhook endpoint (payment.completed → real purchase counts).
// Set TEBEX_WEBHOOK_SECRET in Vercel → Settings → Environment Variables (copy it from Tebex → Webhooks).
import crypto from "node:crypto";
import { pipeline, storeReady, day, TTL, json } from "./_store.js";
const TEBEX_IPS = new Set(["18.209.80.3", "54.87.231.232"]);
export async function POST(request) {
  const secret = process.env.TEBEX_WEBHOOK_SECRET;
  if (!secret) return json({ error: "webhook secret not configured" }, 503);
  const raw = await request.text();
  const sig = request.headers.get("x-signature") || "";
  const bodyHash = crypto.createHash("sha256").update(raw, "utf8").digest("hex");
  const expected = crypto.createHmac("sha256", secret).update(bodyHash).digest("hex");
  const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return json({ error: "invalid signature" }, 403);
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (ip && !TEBEX_IPS.has(ip) && process.env.TEBEX_STRICT_IP === "1") return json({ error: "ip" }, 403);
  let hook; try { hook = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }
  if (hook.type === "validation.webhook") return json({ id: hook.id });
  if (hook.type === "payment.completed" && storeReady()) {
    const seen = await pipeline([["SET", `wh:${hook.id}`, 1, "NX", "EX", 60 * 60 * 24 * 7]]);
    if (seen[0] !== "OK") return json({ ok: true, duplicate: true });
    const H = `d:${day()}`, cmds = [];
    for (const pr of hook.subject?.products || []) {
      const p = parseInt(pr.id, 10), q = Math.max(1, parseInt(pr.quantity, 10) || 1);
      if (p > 0) cmds.push(["HINCRBY", H, `buy:${p}`, q], ["HINCRBY", "tot", `buy:${p}`, q]);
    }
    if (cmds.length) { cmds.push(["EXPIRE", H, TTL]); await pipeline(cmds); }
  }
  return json({ ok: true });
}
