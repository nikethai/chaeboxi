import { b as ensure_array_like, e as escape_html, a8 as attr, d as derived } from "../../../chunks/index2.js";
import { s as settingsStore } from "../../../chunks/settings.svelte.js";
import { t as themeStore } from "../../../chunks/theme.svelte.js";
let translations = {};
let currentLanguage = "en";
const localeMap = {
  en: () => import("../../../chunks/translation.js"),
  "zh-Hans": () => import("../../../chunks/translation2.js"),
  "zh-Hant": () => import("../../../chunks/translation3.js"),
  ja: () => import("../../../chunks/translation4.js"),
  ko: () => import("../../../chunks/translation5.js"),
  fr: () => import("../../../chunks/translation6.js"),
  de: () => import("../../../chunks/translation7.js"),
  es: () => import("../../../chunks/translation8.js"),
  "it-IT": () => import("../../../chunks/translation9.js"),
  "pt-PT": () => import("../../../chunks/translation10.js"),
  ru: () => import("../../../chunks/translation11.js"),
  ar: () => import("../../../chunks/translation12.js"),
  sv: () => import("../../../chunks/translation13.js"),
  "nb-NO": () => import("../../../chunks/translation14.js")
};
const initI18n = async (lng = "en") => {
  currentLanguage = lng;
  const loader = localeMap[lng];
  if (loader) {
    try {
      const module = await loader();
      translations = module.default;
    } catch (e) {
      console.warn(`Failed to load locale ${lng}, using empty translations:`, e);
      translations = {};
    }
  }
  return currentLanguage;
};
const changeLanguage = async (lng) => {
  await initI18n(lng);
};
const supportedLanguages = [
  { code: "en", name: "English" },
  { code: "zh-Hans", name: "简体中文" },
  { code: "zh-Hant", name: "繁體中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "it-IT", name: "Italiano" },
  { code: "pt-PT", name: "Português" },
  { code: "ru", name: "Русский" },
  { code: "ar", name: "العربية" },
  { code: "sv", name: "Svenska" },
  { code: "nb-NO", name: "Norsk" }
];
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let settings = derived(() => settingsStore.settings);
    const currentTheme = derived(() => themeStore.theme);
    function updateTheme(theme) {
      themeStore.setTheme(theme);
      settingsStore.update({ theme });
    }
    function updateLanguage(lang) {
      settingsStore.update({ language: lang });
      changeLanguage(lang);
    }
    $$renderer2.push(`<div class="settings-page svelte-1i19ct2"><header class="settings-header svelte-1i19ct2"><h1 class="svelte-1i19ct2">Settings</h1></header> <div class="settings-content svelte-1i19ct2"><section class="settings-section svelte-1i19ct2"><h2 class="svelte-1i19ct2">Appearance</h2> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">Theme</span> <span class="description svelte-1i19ct2">Choose your preferred color scheme</span></div> <div class="setting-control svelte-1i19ct2">`);
    $$renderer2.select(
      {
        value: currentTheme(),
        onchange: (e) => updateTheme(e.currentTarget.value),
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "system" }, ($$renderer4) => {
          $$renderer4.push(`System`);
        });
        $$renderer3.option({ value: "light" }, ($$renderer4) => {
          $$renderer4.push(`Light`);
        });
        $$renderer3.option({ value: "dark" }, ($$renderer4) => {
          $$renderer4.push(`Dark`);
        });
      },
      "svelte-1i19ct2"
    );
    $$renderer2.push(`</div></div> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">Language</span> <span class="description svelte-1i19ct2">Select your preferred language</span></div> <div class="setting-control svelte-1i19ct2">`);
    $$renderer2.select(
      {
        value: settings().language,
        onchange: (e) => updateLanguage(e.currentTarget.value),
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(supportedLanguages);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let lang = each_array[$$index];
          $$renderer3.option({ value: lang.code }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(lang.name)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-1i19ct2"
    );
    $$renderer2.push(`</div></div> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">Font Size</span> <span class="description svelte-1i19ct2">Adjust the message font size</span></div> <div class="setting-control svelte-1i19ct2"><input type="number" min="12" max="24"${attr("value", settings().fontSize)} class="svelte-1i19ct2"/></div></div></section> <section class="settings-section svelte-1i19ct2"><h2 class="svelte-1i19ct2">Rendering</h2> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">Markdown Rendering</span> <span class="description svelte-1i19ct2">Enable markdown formatting in messages</span></div> <div class="setting-control svelte-1i19ct2"><input type="checkbox"${attr("checked", settings().enableMarkdownRendering, true)} class="svelte-1i19ct2"/></div></div> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">LaTeX Rendering</span> <span class="description svelte-1i19ct2">Render mathematical equations</span></div> <div class="setting-control svelte-1i19ct2"><input type="checkbox"${attr("checked", settings().enableLaTeXRendering, true)} class="svelte-1i19ct2"/></div></div> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">Mermaid Diagrams</span> <span class="description svelte-1i19ct2">Render mermaid diagrams in messages</span></div> <div class="setting-control svelte-1i19ct2"><input type="checkbox"${attr("checked", settings().enableMermaidRendering, true)} class="svelte-1i19ct2"/></div></div> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">Auto-collapse Code Blocks</span> <span class="description svelte-1i19ct2">Collapse long code blocks by default</span></div> <div class="setting-control svelte-1i19ct2"><input type="checkbox"${attr("checked", settings().autoCollapseCodeBlock, true)} class="svelte-1i19ct2"/></div></div></section> <section class="settings-section svelte-1i19ct2"><h2 class="svelte-1i19ct2">Display</h2> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">Show Model Name</span> <span class="description svelte-1i19ct2">Display the model name in messages</span></div> <div class="setting-control svelte-1i19ct2"><input type="checkbox"${attr("checked", settings().showModelName, true)} class="svelte-1i19ct2"/></div></div> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">Show Message Timestamp</span> <span class="description svelte-1i19ct2">Display timestamp for each message</span></div> <div class="setting-control svelte-1i19ct2"><input type="checkbox"${attr("checked", settings().showMessageTimestamp, true)} class="svelte-1i19ct2"/></div></div> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">Show Token Count</span> <span class="description svelte-1i19ct2">Display token usage for messages</span></div> <div class="setting-control svelte-1i19ct2"><input type="checkbox"${attr("checked", settings().showTokenCount, true)} class="svelte-1i19ct2"/></div></div> <div class="setting-item svelte-1i19ct2"><div class="setting-label svelte-1i19ct2"><span class="label svelte-1i19ct2">Show Token Used</span> <span class="description svelte-1i19ct2">Show total tokens used</span></div> <div class="setting-control svelte-1i19ct2"><input type="checkbox"${attr("checked", settings().showTokenUsed, true)} class="svelte-1i19ct2"/></div></div></section> <section class="settings-section svelte-1i19ct2"><h2 class="svelte-1i19ct2">About</h2> <div class="about-info svelte-1i19ct2"><p class="svelte-1i19ct2"><strong>Chaeboxi</strong></p> <p class="svelte-1i19ct2">Version 0.1.0</p> <p class="svelte-1i19ct2">Svelte 5 + Tauri</p></div></section></div></div>`);
  });
}
export {
  _page as default
};
