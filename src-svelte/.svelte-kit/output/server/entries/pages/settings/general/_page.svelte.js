import { b as attr, e as escape_html, f as ensure_array_like, a as attr_class, d as derived } from "../../../../chunks/index2.js";
import { T as Theme } from "../../../../chunks/defaults.js";
import { S as SelectMenu } from "../../../../chunks/SelectMenu.js";
import { s as settingsStore } from "../../../../chunks/settings.svelte.js";
import { t as themeStore } from "../../../../chunks/theme.svelte.js";
import { p as platform } from "../../../../chunks/index3.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const languageOptions = [
      { value: "en", label: "English" },
      { value: "zh-Hans", label: "Chinese (Simplified)" },
      { value: "zh-Hant", label: "Chinese (Traditional)" },
      { value: "ja", label: "Japanese" },
      { value: "ko", label: "Korean" },
      { value: "ru", label: "Russian" },
      { value: "de", label: "German" },
      { value: "fr", label: "French" },
      { value: "pt-PT", label: "Portuguese" },
      { value: "es", label: "Spanish" },
      { value: "ar", label: "Arabic" },
      { value: "it-IT", label: "Italian" },
      { value: "sv", label: "Swedish" },
      { value: "nb-NO", label: "Norwegian Bokmal" }
    ];
    const themeOptions = [
      { value: `${Theme.System}`, label: "Follow system" },
      { value: `${Theme.Light}`, label: "Light mode" },
      { value: `${Theme.Dark}`, label: "Dark mode" }
    ];
    const startupOptions = [
      { value: "home", label: "Home page" },
      { value: "session", label: "Last session" }
    ];
    const fontSize = derived(() => settingsStore.settings.fontSize ?? 14);
    $$renderer2.push(`<section class="settings-page svelte-tjjqsn"><header class="page-header svelte-tjjqsn"><p class="eyebrow svelte-tjjqsn">General</p> <h1 class="svelte-tjjqsn">General app behavior</h1> <p class="svelte-tjjqsn">Theme, language, startup, proxy, reporting, and desktop-safe toggles now live in the Svelte settings shell.</p></header> <div class="settings-grid svelte-tjjqsn"><section class="card svelte-tjjqsn"><div class="card-header svelte-tjjqsn"><h2 class="svelte-tjjqsn">Display</h2> <p class="svelte-tjjqsn">Keep the visual baseline aligned with the React app.</p></div> <div class="field-grid svelte-tjjqsn"><label class="field svelte-tjjqsn"><span class="svelte-tjjqsn">Theme</span> `);
    SelectMenu($$renderer2, {
      options: themeOptions,
      value: `${settingsStore.settings.theme}`,
      onChange: (value) => themeStore.setTheme(Number(value))
    });
    $$renderer2.push(`<!----></label> <label class="field svelte-tjjqsn"><span class="svelte-tjjqsn">Language</span> `);
    SelectMenu($$renderer2, {
      options: languageOptions,
      value: settingsStore.settings.language,
      onChange: (value) => settingsStore.update({ language: value })
    });
    $$renderer2.push(`<!----></label></div> <label class="field svelte-tjjqsn"><span class="svelte-tjjqsn">Font size</span> <div class="range-field svelte-tjjqsn"><input type="range" min="12" max="18" step="1"${attr("value", fontSize())} class="svelte-tjjqsn"/> <div class="range-meta svelte-tjjqsn"><strong class="svelte-tjjqsn">${escape_html(fontSize())}px</strong> <span class="svelte-tjjqsn">Shared app scale</span></div></div></label> <label class="field svelte-tjjqsn"><span class="svelte-tjjqsn">Startup page</span> <div class="segment-group svelte-tjjqsn"><!--[-->`);
    const each_array = ensure_array_like(startupOptions);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let option = each_array[$$index];
      $$renderer2.push(`<button${attr_class("segment-btn svelte-tjjqsn", void 0, {
        "active": (settingsStore.settings.startupPage ?? "home") === option.value
      })} type="button">${escape_html(option.label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div></label></section> <section class="card svelte-tjjqsn"><div class="card-header svelte-tjjqsn"><h2 class="svelte-tjjqsn">Connectivity and privacy</h2> <p class="svelte-tjjqsn">Persist the real shared settings fields without placeholder connection tools.</p></div> <label class="field svelte-tjjqsn"><span class="svelte-tjjqsn">Network proxy</span> <input type="text" placeholder="socks5://127.0.0.1:6153"${attr("value", settingsStore.settings.proxy ?? "")} class="svelte-tjjqsn"/></label> <label class="switch-row svelte-tjjqsn"><div class="switch-copy svelte-tjjqsn"><strong class="svelte-tjjqsn">Optional anonymous reporting</strong> <p class="svelte-tjjqsn">Allow anonymous crash and event reporting.</p></div> <input type="checkbox"${attr("checked", settingsStore.settings.allowReportingAndTracking ?? true, true)} class="svelte-tjjqsn"/></label> `);
    if (platform.type === "desktop") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="switch-stack svelte-tjjqsn"><label class="switch-row svelte-tjjqsn"><div class="switch-copy svelte-tjjqsn"><strong class="svelte-tjjqsn">Launch at system startup</strong> <p class="svelte-tjjqsn">Use the existing desktop-backed startup flag.</p></div> <input type="checkbox"${attr("checked", settingsStore.settings.autoLaunch ?? false, true)} class="svelte-tjjqsn"/></label> <label class="switch-row svelte-tjjqsn"><div class="switch-copy svelte-tjjqsn"><strong class="svelte-tjjqsn">Automatic updates</strong> <p class="svelte-tjjqsn">Keep update checks enabled for the desktop shell.</p></div> <input type="checkbox"${attr("checked", settingsStore.settings.autoUpdate ?? true, true)} class="svelte-tjjqsn"/></label> <label class="switch-row svelte-tjjqsn"><div class="switch-copy svelte-tjjqsn"><strong class="svelte-tjjqsn">Beta updates</strong> <p class="svelte-tjjqsn">Stay on the existing beta update channel.</p></div> <input type="checkbox"${attr("checked", settingsStore.settings.betaUpdate ?? false, true)} class="svelte-tjjqsn"/></label></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section></div></section>`);
  });
}
export {
  _page as default
};
