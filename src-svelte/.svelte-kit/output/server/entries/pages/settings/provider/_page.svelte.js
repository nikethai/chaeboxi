import { e as escape_html } from "../../../../chunks/index2.js";
import "clsx";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/provider-settings.js";
import "../../../../chunks/defaults.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<section class="provider-entry svelte-1st6erw"><div class="entry-card svelte-1st6erw"><p class="eyebrow svelte-1st6erw">Provider Setup</p> <h1 class="svelte-1st6erw">${escape_html("Choose a provider to start setup")}</h1> <p class="svelte-1st6erw">On desktop this route opens the first useful provider editor automatically. On smaller screens the provider list stays
			as the entrypoint and drills into detail routes.</p></div></section>`);
  });
}
export {
  _page as default
};
