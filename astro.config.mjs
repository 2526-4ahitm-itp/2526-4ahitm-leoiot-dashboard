import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://2526-4ahitm-itp.github.io",
  base: "/2526-4ahitm-leoiot-dashboard",
  integrations: [
    starlight({
      title: "LeoIoT",
      defaultLocale: "root",
      locales: {
        root: { label: "Deutsch", lang: "de" },
        en: { label: "English", lang: "en" },
      },
      customCss: ["./src/styles/tokens.css"],
    }),
  ],
});
