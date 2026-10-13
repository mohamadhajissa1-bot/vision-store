// Shared helpers for the SEO endpoints: load the Tebex catalogue and build the same slugs as the site.
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

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const plain = html => String(html || "").replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
export const safeHtml = html => String(html || "").replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "").replace(/\son\w+="[^"]*"/gi, "").replace(/javascript:/gi, "");
