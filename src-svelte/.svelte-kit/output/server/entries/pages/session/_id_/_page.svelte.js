import { e as escape_html, d as derived, c as store_get, u as unsubscribe_stores } from "../../../../chunks/index2.js";
import { p as page } from "../../../../chunks/stores.js";
import "marked";
import { M as MessageList, I as InputBox } from "../../../../chunks/InputBox.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const sessionId = derived(() => store_get($$store_subs ??= {}, "$page", page).params.id);
    let messages = [
      {
        id: "1",
        role: "user",
        contentParts: [{ type: "text", text: "Hello! How are you?" }],
        status: [],
        tokenCalculatedAt: null
      },
      {
        id: "2",
        role: "assistant",
        contentParts: [
          {
            type: "text",
            text: "I'm doing great, thank you! I'm a helpful AI assistant."
          }
        ],
        modelId: "gpt-4",
        status: [],
        tokenCalculatedAt: null
      }
    ];
    function handleSubmit(message) {
      const userMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        contentParts: [{ type: "text", text: message }],
        status: [],
        tokenCalculatedAt: null
      };
      messages = [...messages, userMessage];
      setTimeout(
        () => {
          const assistantMessage = {
            id: `msg-${Date.now()}`,
            role: "assistant",
            contentParts: [
              {
                type: "text",
                text: `You said: "${message}". This is a demo response from the Svelte 5 chat interface!`
              }
            ],
            modelId: "gpt-4",
            status: [],
            tokenCalculatedAt: null
          };
          messages = [...messages, assistantMessage];
        },
        500
      );
    }
    $$renderer2.push(`<div class="session-page svelte-1a2wdfb"><div class="session-header svelte-1a2wdfb"><h1 class="svelte-1a2wdfb">Session: ${escape_html(sessionId())}</h1></div> `);
    MessageList($$renderer2, { messages });
    $$renderer2.push(`<!----> `);
    InputBox($$renderer2, { onSubmit: handleSubmit, placeholder: "Type a message..." });
    $$renderer2.push(`<!----></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
