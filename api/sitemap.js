// GET /sitemap.xml — every script currently in the Tebex store, plus the homepage.
import { SITE, loadPackages, slugOf } from "./_catalog.js";
export async function GET() {
  let pkgs = []; try { pkgs = await loadPackages(); } catch {}
  const day = d => (d ? new Date(d) : new Date()).toISOString().slice(0, 10);
  const xmlEsc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const newest = pkgs.reduce((a, p) => Math.max(a, +new Date(p.updated_at || p.created_at || 0)), 0);
  const urls = [`<url><loc>${SITE}/</loc><lastmod>${day(newest || undefined)}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...pkgs.map(p => {
      const imgs = [p.image, ...(p.media || []).filter(m => m.type !== "video").map(m => m.url)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);
      return `<url><loc>${SITE}/scripts/${slugOf(p)}</loc><lastmod>${day(p.updated_at || p.created_at)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority>${imgs.map(u => `<image:image><image:loc>${xmlEsc(u)}</image:loc></image:image>`).join("")}</url>`;
    })];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
