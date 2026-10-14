// GET / — the homepage, with the script list (footer links + ItemList structured data) filled in from
// the live Tebex catalogue, so new scripts are linked from the homepage as soon as they are added.
import { SITE, loadPackages, loadShell, slugOf, nameParts, esc, html } from "./_catalog.js";

export async function GET(request) {
  const url = new URL(request.url);
  let shell;
  try { shell = await loadShell(url.origin); } catch { return new Response("Temporarily unavailable", { status: 503, headers: { "Retry-After": "30" } }); }
  try {
    const pkgs = await loadPackages();
    if (pkgs.length) {
      const links = pkgs.map(p => `<li><a href="/scripts/${esc(slugOf(p))}">${esc(nameParts(p).title)}</a></li>`).join("");
      const items = { "@context": "https://schema.org", "@type": "ItemList", name: "Premium FiveM Scripts by Vision Scripts",
        itemListElement: pkgs.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/scripts/${slugOf(p)}`, name: nameParts(p).title })) };
      shell = shell
        .replace(/<!--scripts-->[\s\S]*?<!--\/scripts-->/, `<!--scripts-->${links}<!--/scripts-->`)
        .replace(/(<script type="application\/ld\+json" id="ldItems">)[\s\S]*?(<\/script>)/, `$1${JSON.stringify(items).replace(/</g, "\\u003c")}$2`);
    }
  } catch {}
  return html(shell, 200, { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" });
}
