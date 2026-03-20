import { e as escape_html, d as derived } from "../../chunks/index2.js";
import { g as goto } from "../../chunks/client.js";
import "marked";
import { s as settingsStore } from "../../chunks/settings.svelte.js";
import { I as InputBox } from "../../chunks/InputBox.js";
import "lodash";
import { c as conversationStore } from "../../chunks/conversation.svelte.js";
import { p as providerCatalogStore } from "../../chunks/provider-catalog.svelte.js";
import { g as getSelectedModelLabel, a as getAvailableProviders } from "../../chunks/providers.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let isSubmitting = false;
    const providers = derived(() => getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders));
    const hasProviders = derived(() => providers().length > 0);
    const selectedModelLabel = derived(() => getSelectedModelLabel(providers(), conversationStore.draftChatModel));
    async function handleSubmit(message) {
      if (!hasProviders() || isSubmitting) {
        return;
      }
      isSubmitting = true;
      try {
        const session = await conversationStore.createSessionAndSubmit(message, conversationStore.draftChatModel);
        if (session) {
          goto(`/session/${session.id}`);
        }
      } finally {
        isSubmitting = false;
      }
    }
    $$renderer2.push(`<div class="chat-page svelte-1uha8ag"><div class="welcome-shell svelte-1uha8ag"><div class="welcome-area svelte-1uha8ag"><div class="welcome-icon svelte-1uha8ag"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></div> <div class="welcome-copy svelte-1uha8ag"><p class="welcome-kicker svelte-1uha8ag">Real new-session route</p> <h1 class="welcome-text svelte-1uha8ag">What can I help you with today?</h1> <p class="welcome-subtitle svelte-1uha8ag">`);
    if (hasProviders()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`Ready to start with ${escape_html(selectedModelLabel())}.`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`Configure a provider first. This route stays honest and does not fall back to a fake demo model.`);
    }
    $$renderer2.push(`<!--]--></p></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="input-area svelte-1uha8ag">`);
    InputBox($$renderer2, {
      label: "New conversation",
      helperText: hasProviders() ? `Using ${selectedModelLabel()}` : "Provider setup required before sending",
      onSubmit: handleSubmit,
      disabled: !hasProviders() || isSubmitting,
      placeholder: "Type your question here..."
    });
    $$renderer2.push(`<!----></div></div>`);
  });
}
export {
  _page as default
};
