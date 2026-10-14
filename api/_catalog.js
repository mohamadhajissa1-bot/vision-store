// Shared helpers for the server-rendered SEO pages: Tebex catalogue, slugs, SEO text and the HTML shell.
export const SITE = "https://www.vision-store.site";
const TOKEN = "14xiq-7458e0c5ad63371dfdd227cde5ba87fec003ece3";

export const nameParts = p => {
  const n = String(p.name || "").replace(/\s*\[[^\]]*\]\s*$/, "").trim();
  const [t, ...rest] = n.split(/\s+[|–—]\s+/);
  return { title: (t || n).trim(), sub: rest.join(" · ").trim() };
};
const slugify = t => String(t).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
export const slugOf = p => p.slug || slugify(nameParts(p).title) || String(p.id);

export async function loadPackages() {
  const r = await fetch(`https://headless.tebex.io/api/accounts/${TOKEN}/categories?includePackages=1`);
  if (!r.ok) throw new Error(`tebex ${r.status}`);
  const j = await r.json();
  return (j.data || []).flatMap(c => (c.packages || []).map(p => ({ ...p, _cat: c.name })));
}

// The site's index.html (served at /_shell) — the single source of design, scripts and SEO data.
export async function loadShell(origin) {
  for (const path of ["/_shell", "/index.html"]) {
    try { const r = await fetch(`${origin}${path}`, { redirect: "manual" }); if (r.ok) return await r.text(); } catch {}
  }
  throw new Error("shell unavailable");
}
export function seoData(shell) {
  try { return JSON.parse((shell.match(/<script type="application\/json" id="seoData">([\s\S]*?)<\/script>/) || [])[1] || "{}"); }
  catch { return {}; }
}
export function promoPercent(shell) {
  const m = shell.match(/PROMO:\s*\{\s*enabled:\s*(true|false)[\s\S]*?percent:\s*(\d+(?:\.\d+)?)/);
  return m && m[1] === "true" ? Number(m[2]) : 0;
}

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const plain = html => String(html || "").replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
export const safeHtml = html => String(html || "").replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "").replace(/\son\w+="[^"]*"/gi, "").replace(/javascript:/gi, "");
export const FW = [["QBox", /\bqbox\b|\bqbx\b/i], ["QBCore", /\bqb-?core\b/i], ["ESX", /\besx\b/i], ["Standalone", /\bstandalone\b/i]];
export const frameworks = p => FW.filter(([, re]) => re.test(p.name + " " + plain(p.description))).map(([n]) => n);

export function seoFor(p, data) {
  const np = nameParts(p), o = ((data || {}).products || {})[p.id] || {};
  const text = plain(p.description);
  return {
    title: o.title || `${np.title} – FiveM Script${np.sub ? " | " + np.sub : ""}`,
    description: o.description || `${np.title}${np.sub ? ": " + np.sub : ""}. ${text}`.slice(0, 155).replace(/\s+\S*$/, "") + "…",
  };
}
export const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...extra } });
