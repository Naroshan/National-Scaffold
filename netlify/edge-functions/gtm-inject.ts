import type { Context, Config } from "@netlify/edge-functions";

const GTM_HEAD_SNIPPET = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-K588VLD8');</script>
<!-- End Google Tag Manager -->`;

const GTM_BODY_SNIPPET = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-K588VLD8"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

// Crawlers/bots must always see full contact info, otherwise hiding it would be
// undetectable cloaking from Google's perspective and would break LocalBusiness
// NAP consistency in search results.
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|whatsapp|telegrambot|discordbot|preview|lighthouse|pagespeed|pingdom|uptimerobot|semrush|ahrefs|mj12bot|dotbot|petalbot/i;

// UK home nations we do NOT serve, keyed by the ISO 3166-2 subdivision code
// (without the "GB-" prefix) that Netlify's geo-IP data returns.
const EXCLUDED_GB_SUBDIVISIONS = new Set(["SCT", "NIR"]);
const EXCLUDED_GB_SUBDIVISION_NAMES = new Set(["scotland", "northern ireland"]);

function isEnglandOrWales(geo: Context["geo"] | undefined): boolean {
  const countryCode = geo?.country?.code;
  // No country signal at all -> fail open, let the visitor through.
  if (!countryCode) return true;
  // Definitely not the UK -> block.
  if (countryCode !== "GB") return false;

  const subCode = geo?.subdivision?.code?.toUpperCase();
  const subName = geo?.subdivision?.name?.toLowerCase();
  // GB but clearly Scotland/N. Ireland -> block. Anything else (England, Wales,
  // or an ambiguous/missing subdivision) -> fail open and allow.
  if (subCode && EXCLUDED_GB_SUBDIVISIONS.has(subCode)) return false;
  if (subName && EXCLUDED_GB_SUBDIVISION_NAMES.has(subName)) return false;
  return true;
}

const REGION_BLOCK_SNIPPET = `<script>
(function(){
  document.querySelectorAll('form[action*="formspree.io"]').forEach(function(f){
    var msg = document.createElement('div');
    msg.style.cssText = 'padding:28px 24px;text-align:center;color:var(--muted,#888);border:1.5px solid var(--border,#2e2e2e);border-radius:6px;background:var(--dark,#161616);font-family:inherit;';
    msg.innerHTML = "We're sorry — National Scaffold currently only covers England &amp; Wales, so we're unable to take enquiries from your region.<br><br>If you believe you're seeing this in error, please email <a href=\\"mailto:quotes@nationalscaffold.co.uk\\" style=\\"color:var(--yellow,#F5C400);\\">quotes@nationalscaffold.co.uk</a>.";
    f.replaceWith(msg);
  });
  document.querySelectorAll('a[href^="tel:"], a[href*="wa.me"], a[href*="#enquiry"]').forEach(function(a){
    a.style.display = 'none';
  });
  document.querySelectorAll('.sticky-bar').forEach(function(el){
    el.style.display = 'none';
  });
  document.body.style.paddingBottom = '0px';
})();
</script>`;

export default async (req: Request, context: Context) => {
  const response = await context.next();

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const userAgent = req.headers.get("user-agent") || "";
  const isBot = BOT_UA_PATTERN.test(userAgent);
  const shouldBlockContact = !isBot && !isEnglandOrWales(context.geo);

  const html = await response.text();
  let modified = html.replace("<head>", `<head>\n${GTM_HEAD_SNIPPET}`);
  modified = modified.replace(/<body([^>]*)>/, `<body$1>\n${GTM_BODY_SNIPPET}`);
  if (shouldBlockContact) {
    modified = modified.replace("</body>", `${REGION_BLOCK_SNIPPET}\n</body>`);
  }

  return new Response(modified, {
    status: response.status,
    headers: response.headers,
  });
};

export const config: Config = {
  path: "/*",
  excludedPath: ["/img/*", "/*.css", "/*.js", "/*.jpg", "/*.png", "/*.svg", "/*.ico", "/*.webp", "/*.woff2", "/*.woff"],
  onError: "bypass",
};
