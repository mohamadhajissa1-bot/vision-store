// GET /scripts/:slug — crawlable, server-rendered product page.
// Serves the normal site shell with a product-specific title, description, canonical URL, Open Graph tags,
// Product + BreadcrumbList structured data and the product content already in the HTML.
// The site's JavaScript then turns it into the full interactive page (gallery, basket, checkout).
import { SITE, loadPackages, loadShell, seoData, promoPercent, seoFor, slugOf, nameParts, frameworks, esc, plain, safeHtml, html } from "./_catalog.js";

export async function GET(request) {
  const url = new URL(request.url);
  const slug = decodeURIComponent(url.searchParams.get("slug") || "").toLowerCase();
  let shell;
  try { shell = await loadShell(url.origin); } catch { return Response.redirect(`${SITE}/`, 302); }

  let pkgs = [], ok = true;
  try { pkgs = await loadPackages(); } catch { ok = false; }
  const aliasOf = x => (((seoData(shell).products || {})[x.id] || {}).aliases || []).map(a => String(a).toLowerCase());
  const p = pkgs.find(x => slugOf(x) === slug) || pkgs.find(x => String(x.id) === slug || aliasOf(x).includes(slug));

  if (!p) {
    // Unknown script: real 404 (not indexed). If Tebex is briefly down, serve the app without caching.
    const body = shell.replace("<head>", '<head>\n<meta name="robots" content="noindex">');
    return html(body, ok ? 404 : 200, { "Cache-Control": ok ? "public, s-maxage=60" : "no-store" });
  }
  const pageUrl = `${SITE}/scripts/${slugOf(p)}`;
  if (slugOf(p) !== slug) return Response.redirect(pageUrl, 301); // old slug or numeric ID → canonical URL

  const data = seoData(shell), seo = seoFor(p, data), np = nameParts(p);
  const fws = frameworks(p), fwTxt = fws.length ? fws.join(", ") : "QBox, QBCore & ESX";
  const text = plain(p.description);
  const img = p.image || `${SITE}/logo.webp`;
  const images = [img, ...(p.media || []).filter(m => m.type !== "video").map(m => m.url).filter(Boolean)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);
  const list = Number(p.total_price ?? p.base_price ?? 0);
  const pct = promoPercent(shell);
  const price = (Math.round(list * (1 - pct / 100) * 100) / 100).toFixed(2);
  const cur = p.currency || "USD";
  const title = seo.title.length <= 48 ? `${seo.title} | Vision Scripts` : seo.title;

  const ld = [
    {
      "@context": "https://schema.org", "@type": "Product", "@id": `${pageUrl}#product`,
      name: np.title, description: (np.sub ? np.sub + ". " : "") + text.slice(0, 4800), image: images,
      sku: String(p.id), mpn: String(p.id), category: "FiveM Scripts",
      brand: { "@type": "Brand", name: "Vision Scripts" }, url: pageUrl,
      additionalProperty: fws.map(f => ({ "@type": "PropertyValue", name: "Framework", value: f })),
      offers: {
        "@type": "Offer", url: pageUrl, price, priceCurrency: cur, availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: "Vision Scripts", url: `${SITE}/` }
      }
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

  const related = pkgs.filter(x => x.id !== p.id).slice(0, 6);
  const ssr = `<article class="pp-ssr" style="padding:40px 0 60px;max-width:860px">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/#store">FiveM Scripts</a> › <span>${esc(np.title)}</span></nav>
<h1 style="margin:18px 0 6px">${esc(np.title)}${np.sub ? ` – ${esc(np.sub)}` : ""}</h1>
<p><strong>$${price} ${esc(cur)}</strong> · FiveM script for ${esc(fwTxt)} · Instant delivery to your Cfx.re account via Tebex</p>
<img src="${esc(img)}" alt="${esc(np.title)} – FiveM script" width="860" height="484" style="width:100%;height:auto;border-radius:10px;margin:16px 0">
<h2>About ${esc(np.title)}</h2>
<div class="pp-ssr-desc">${safeHtml(p.description)}</div>
${related.length ? `<h2>More FiveM scripts</h2><ul>${related.map(r => `<li><a href="/scripts/${esc(slugOf(r))}">${esc(nameParts(r).title)}</a>${nameParts(r).sub ? ` – ${esc(nameParts(r).sub)}` : ""}</li>`).join("")}</ul>` : ""}
</article>`;

  const out = shell
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(seo.description)}">`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${pageUrl}">`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(seo.description)}">`)
    .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(img)}">`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${pageUrl}">`)
    .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="product">`)
    .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(title)}">`)
    .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(seo.description)}">`)
    .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(img)}">`)
    .replace(/<script type="application\/ld\+json" id="ldItems">[\s\S]*?<\/script>/, "")
    .replace("</head>", `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>\n</head>`)
    .replace(/<body([^>]*)>/, (m, a) => /class="/.test(a) ? m.replace('class="', 'class="view-product ') : `<body${a} class="view-product">`)
    .replace('<div id="ppState"></div>', `<div id="ppState">${ssr}</div>`);

  return html(out, 200, { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400" });
}
