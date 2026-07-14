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

export default async (req: Request, context: Context) => {
  const response = await context.next();

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  let modified = html.replace("<head>", `<head>\n${GTM_HEAD_SNIPPET}`);
  modified = modified.replace(/<body([^>]*)>/, `<body$1>\n${GTM_BODY_SNIPPET}`);

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
