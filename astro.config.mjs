import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://2526-4ahitm-itp.github.io",
  base: "/2526-4ahitm-leoiot-dashboard",
  redirects: { "/en/slides": "/2526-4ahitm-leoiot-dashboard/slides/" },
  integrations: [
    starlight({
      title: "LeoIoT",
      defaultLocale: "root",
      locales: {
        root: { label: "Deutsch", lang: "de" },
        en: { label: "English", lang: "en" },
      },
      sidebar: [
        { label: "Produkt", translations: { en: "Product" }, link: "/" },
        { label: "App", link: "/app/" },
        { label: "Dokumentation", translations: { en: "Documentation" }, items: [{ autogenerate: { directory: "docs" } }] },
        { label: "Präsentation", translations: { en: "Slides (German only)" }, link: "/slides/" },
      ],
      head: [
        {
          tag: "script",
          content:
            "document.addEventListener('DOMContentLoaded',function(){var l=document.documentElement.lang==='en'?'Table (scrollable)':'Tabelle (scrollbar)';var f=function(){document.querySelectorAll('.sl-markdown-content table').forEach(function(t){if(t.scrollWidth>t.clientWidth){t.setAttribute('tabindex','0');t.setAttribute('role','region');t.setAttribute('aria-label',l);}else{t.removeAttribute('tabindex');t.removeAttribute('role');t.removeAttribute('aria-label');}});};f();addEventListener('resize',f);});",
        },
      ],
      customCss: ["./src/styles/tokens.css"],
      components: {
        ThemeProvider: "./src/components/starlight/ThemeProvider.astro",
        ThemeSelect: "./src/components/starlight/ThemeSelect.astro",
      },
    }),
  ],
});
