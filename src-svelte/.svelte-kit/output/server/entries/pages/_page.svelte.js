import "clsx";
import "marked";
import { M as MessageList, I as InputBox } from "../../chunks/InputBox.js";
function _page($$renderer) {
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
          text: "I'm doing great, thank you! I'm a helpful AI assistant. Here's some code:\n\n```javascript\nconsole.log('Hello, World!');\n```\n\nAnd here's some math: $E = mc^2$"
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
  $$renderer.push(`<div class="chat-page svelte-1uha8ag"><div class="chat-header svelte-1uha8ag"><h1 class="svelte-1uha8ag">Chaeboxi</h1> <p class="subtitle svelte-1uha8ag">Svelte 5 Chat Interface</p></div> `);
  MessageList($$renderer, { messages });
  $$renderer.push(`<!----> `);
  InputBox($$renderer, { onSubmit: handleSubmit, placeholder: "Type a message..." });
  $$renderer.push(`<!----></div>`);
}
export {
  _page as default
};
