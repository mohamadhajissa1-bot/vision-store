// GET /scripts/:slug (rewritten to /api/render?slug=...) — a crawlable, server-rendered product page.
// It serves the normal site shell with product-specific <title>, meta description, canonical URL,
// Open Graph tags, Product + Breadcrumb structured data and the product content already in the HTML,
// so Google can index each script on its own URL. The site's JS then takes over as usual.
import { SITE, loadPackages, slugOf, nameParts, esc, plain, safeHtml } from "./_catalog.js";

const FW = ["QBox", "QBCore", "ESX", "Standalone"];

export async function GET(request) {
  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") || "").toLowerCase();
  let shell;
  try { shell = await (await fetch(`${url.origin}/index.html`)).text(); }
  catch { return Response.redirect(`${SITE}/`, 302); }
  shell = shell.replace("<head>", '<head>\n<base href="/">');

  let pkgs = [];
  try { pkgs = await loadPackages(); } catch {}
  const p = pkgs.find(x => slugOf(x) === slug || String(x.id) === slug);
  if (!p) {
    return new Response(shell.replace("<head>\n", '<head>\n<meta name="robots" content="noindex">\n'),
      { status: pkgs.length ? 404 : 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const np = nameParts(p), pageUrl = `${SITE}/scripts/${slugOf(p)}`;
  const text = plain(p.description);
  const fws = FW.filter(f => new RegExp(`\\b${f}\\b`, "i").test(p.name + " " + text));
  const fwTxt = fws.length ? fws.join(", ") : "QBox, QBCore & ESX";
  const title = `${np.title} – FiveM Script for ${fwTxt} | Vision Scripts`;
  const desc = `${np.title}${np.sub ? ": " + np.sub : ""}. ${text}`.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  const img = p.image || `${SITE}/logo.webp`;
  const price = Number(p.total_price ?? p.base_price ?? 0).toFixed(2);
  const cur = p.currency || "USD";

  const ld = [
    {
      "@context": "https://schema.org", "@type": "Product",
      name: np.title, description: text.slice(0, 5000), image: [img, ...(p.media || []).map(m => m.url).filter(Boolean)].slice(0, 10),
      sku: String(p.id), category: "FiveM Scripts", brand: { "@type": "Brand", name: "Vision Scripts" },
      url: pageUrl,
      offers: { "@type": "Offer", url: pageUrl, price, priceCurrency: cur, availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "Vision Scripts" } }
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "FiveM Scripts", item: `${SITE}/#store` },
        { "@type": "ListItem", position: 3, name: np.title, item: pageUrl }
      ]
    }
  ];

  let html = shell
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${pageUrl}">`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(np.title)} – FiveM Script | Vision Scripts">`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`)
    .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(img)}">`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${pageUrl}">`)
    .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="product">`)
    .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(img)}">`)
    .replace("</head>", `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>\n</head>`)
    .replace(/<body([^>]*)>/, (m, a) => /class="/.test(a) ? m.replace('class="', 'class="view-product ') : `<body${a} class="view-product">`);

  // Product content in the initial HTML (the site's JS replaces it with the full interactive page).
  const ssr = `<article class="pp-ssr" style="padding:40px 0 60px;max-width:860px">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/#store">FiveM Scripts</a> › <span>${esc(np.title)}</span></nav>
<h1 style="margin:18px 0 6px">${esc(np.title)}</h1>
${np.sub ? `<p style="opacity:.8;margin:0 0 16px">${esc(np.sub)}</p>` : ""}
<p><strong>$${price} ${esc(cur)}</strong> · FiveM script for ${esc(fwTxt)} · Instant delivery to your Cfx.re account via Tebex</p>
<img src="${esc(img)}" alt="${esc(np.title)} FiveM script" width="860" style="width:100%;height:auto;border-radius:10px;margin:16px 0">
<div class="pp-ssr-desc">${safeHtml(p.description)}</div>
<p><a href="/#/scripts/${esc(slugOf(p))}">View ${esc(np.title)} and buy</a></p>
</article>`;
  html = html.replace('<div id="ppState"></div>', `<div id="ppState">${ssr}</div>`);

  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400" } });
}
