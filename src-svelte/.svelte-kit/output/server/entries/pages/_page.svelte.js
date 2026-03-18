import { d as derived } from "../../chunks/root.js";
import { g as goto } from "../../chunks/client.js";
import "marked";
import { a as settingsStore, c as conversationStore } from "../../chunks/conversation.svelte.js";
import { I as InputBox } from "../../chunks/InputBox.js";
import "lodash";
import { a as getAvailableProviders, p as providerCatalogStore } from "../../chunks/provider-catalog.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let isSubmitting = false;
    const providers = derived(() => getAvailableProviders(settingsStore.settings, providerCatalogStore.systemProviders));
    const hasProviders = derived(() => providers().length > 0);
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
    $$renderer2.push(`<div class="chat-page svelte-1uha8ag"><div class="welcome-area svelte-1uha8ag"><div class="welcome-icon svelte-1uha8ag"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></div> <p class="welcome-text svelte-1uha8ag">What can I help you with today?</p></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="input-area svelte-1uha8ag">`);
    InputBox($$renderer2, {
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
