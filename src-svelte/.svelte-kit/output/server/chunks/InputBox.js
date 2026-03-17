import { a8 as attr, e as escape_html, d as derived, a as attr_class, b as ensure_array_like, a9 as element, s as stringify } from "./index2.js";
import { marked } from "marked";
import { s as settingsStore } from "./settings.svelte.js";
import "clsx";
function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
}
function CodeBlock($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      code,
      language = "text",
      collapsed = false
    } = $$props;
    let isCollapsed = collapsed;
    const CODE_COLLAPSE_THRESHOLD = 7;
    const shouldCollapse = derived(() => code.split("\n").length > CODE_COLLAPSE_THRESHOLD);
    $$renderer2.push(`<div class="code-block svelte-1cs64w0"${attr("data-language", language)}><div class="code-header svelte-1cs64w0"><div class="code-info svelte-1cs64w0"><span class="code-language svelte-1cs64w0">${escape_html(language)}</span> `);
    if (shouldCollapse()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="collapse-button svelte-1cs64w0">${escape_html(isCollapsed ? "Expand" : "Collapse")}</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <button class="copy-button svelte-1cs64w0">${escape_html("Copy")}</button></div> `);
    if (shouldCollapse() && isCollapsed) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="collapsed-preview svelte-1cs64w0">${escape_html(code.split("\n").slice(0, 3).join("\n"))}... <span class="expand-hint svelte-1cs64w0">(click to expand)</span></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="code-content svelte-1cs64w0">`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<pre class="svelte-1cs64w0"><code class="svelte-1cs64w0">${escape_html(code)}</code></pre>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function KatexRenderer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { content, displayMode = false } = $$props;
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="katex-placeholder svelte-fag7u0">${escape_html(content)}</span>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function MermaidDiagram($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { code, theme = "default" } = $$props;
    $$renderer2.push(`<div class="mermaid-container svelte-6npoey">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mermaid-loading svelte-6npoey"><span>Rendering diagram...</span></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Markdown($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      content,
      enableLaTeX = true,
      enableMermaid = true,
      enableHtml = false,
      class: className = "",
      streaming = false
    } = $$props;
    const latexEnabled = derived(() => enableLaTeX && settingsStore.settings.enableLaTeXRendering);
    const mermaidEnabled = derived(() => enableMermaid && settingsStore.settings.enableMermaidRendering);
    let tokens = derived(() => {
      try {
        if (!content) return [];
        return marked.lexer(content, { gfm: true, breaks: true });
      } catch (e) {
        console.error("Markdown parse error:", e);
        return [];
      }
    });
    const hasMermaid = derived(() => tokens().some((t) => t.type === "code" && t.lang === "mermaid"));
    function splitByLatex(text) {
      const parts = [];
      const regex = /\$([^$\n]+)\$/g;
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
        }
        parts.push({ type: "latex", content: match[1] });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        parts.push({ type: "text", content: text.slice(lastIndex) });
      }
      return parts;
    }
    function tokenRenderer($$renderer3, token) {
      if (token.type === "heading") {
        $$renderer3.push("<!--[0-->");
        element($$renderer3, "h", void 0, () => {
          $$renderer3.push(`${escape_html(token.text)}`);
        });
      } else if (token.type === "paragraph") {
        $$renderer3.push("<!--[1-->");
        $$renderer3.push(`<p>`);
        if (latexEnabled()) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<!--[-->`);
          const each_array = ensure_array_like(splitByLatex(token.text));
          for (let $$index_2 = 0, $$length = each_array.length; $$index_2 < $$length; $$index_2++) {
            let part = each_array[$$index_2];
            if (part.type === "latex") {
              $$renderer3.push("<!--[0-->");
              KatexRenderer($$renderer3, { content: part.content, displayMode: false });
            } else {
              $$renderer3.push("<!--[-1-->");
              $$renderer3.push(`${escape_html(part.content)}`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]-->`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`${escape_html(token.text)}`);
        }
        $$renderer3.push(`<!--]--></p>`);
      } else if (token.type === "code") {
        $$renderer3.push("<!--[2-->");
        if (token.lang === "mermaid" && mermaidEnabled()) {
          $$renderer3.push("<!--[0-->");
          MermaidDiagram($$renderer3, { code: token.text });
        } else {
          $$renderer3.push("<!--[-1-->");
          CodeBlock($$renderer3, {
            code: token.text,
            language: token.lang || "text",
            collapsed: settingsStore.settings.autoCollapseCodeBlock
          });
        }
        $$renderer3.push(`<!--]-->`);
      } else if (token.type === "blockquote") {
        $$renderer3.push("<!--[3-->");
        $$renderer3.push(`<blockquote><p>${escape_html(token.text)}</p></blockquote>`);
      } else if (token.type === "list") {
        $$renderer3.push("<!--[4-->");
        if (token.ordered) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<ol><!--[-->`);
          const each_array_1 = ensure_array_like(token.items);
          for (let $$index_3 = 0, $$length = each_array_1.length; $$index_3 < $$length; $$index_3++) {
            let item = each_array_1[$$index_3];
            $$renderer3.push(`<li>${escape_html(item.text)}</li>`);
          }
          $$renderer3.push(`<!--]--></ol>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<ul><!--[-->`);
          const each_array_2 = ensure_array_like(token.items);
          for (let $$index_4 = 0, $$length = each_array_2.length; $$index_4 < $$length; $$index_4++) {
            let item = each_array_2[$$index_4];
            $$renderer3.push(`<li>${escape_html(item.text)}</li>`);
          }
          $$renderer3.push(`<!--]--></ul>`);
        }
        $$renderer3.push(`<!--]-->`);
      } else if (token.type === "table") {
        $$renderer3.push("<!--[5-->");
        $$renderer3.push(`<div class="table-wrapper"><table><thead><tr><!--[-->`);
        const each_array_3 = ensure_array_like(token.header);
        for (let $$index_5 = 0, $$length = each_array_3.length; $$index_5 < $$length; $$index_5++) {
          let cell = each_array_3[$$index_5];
          $$renderer3.push(`<th>${escape_html(cell.text)}</th>`);
        }
        $$renderer3.push(`<!--]--></tr></thead><tbody><!--[-->`);
        const each_array_4 = ensure_array_like(token.rows);
        for (let $$index_7 = 0, $$length = each_array_4.length; $$index_7 < $$length; $$index_7++) {
          let row = each_array_4[$$index_7];
          $$renderer3.push(`<tr><!--[-->`);
          const each_array_5 = ensure_array_like(row);
          for (let $$index_6 = 0, $$length2 = each_array_5.length; $$index_6 < $$length2; $$index_6++) {
            let cell = each_array_5[$$index_6];
            $$renderer3.push(`<td>${escape_html(cell.text)}</td>`);
          }
          $$renderer3.push(`<!--]--></tr>`);
        }
        $$renderer3.push(`<!--]--></tbody></table></div>`);
      } else if (token.type === "hr") {
        $$renderer3.push("<!--[6-->");
        $$renderer3.push(`<hr/>`);
      } else if (token.type === "html") {
        $$renderer3.push("<!--[7-->");
        if (enableHtml) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`${html(token.text)}`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      } else if (token.type === "text") {
        $$renderer3.push("<!--[8-->");
        $$renderer3.push(`<span>`);
        if (latexEnabled()) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<!--[-->`);
          const each_array_6 = ensure_array_like(splitByLatex(token.text));
          for (let $$index_8 = 0, $$length = each_array_6.length; $$index_8 < $$length; $$index_8++) {
            let part = each_array_6[$$index_8];
            if (part.type === "latex") {
              $$renderer3.push("<!--[0-->");
              KatexRenderer($$renderer3, { content: part.content, displayMode: false });
            } else {
              $$renderer3.push("<!--[-1-->");
              $$renderer3.push(`${escape_html(part.content)}`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]-->`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`${escape_html(token.text)}`);
        }
        $$renderer3.push(`<!--]--></span>`);
      } else if (token.type === "strong") {
        $$renderer3.push("<!--[9-->");
        $$renderer3.push(`<strong>${escape_html(token.text)}</strong>`);
      } else if (token.type === "em") {
        $$renderer3.push("<!--[10-->");
        $$renderer3.push(`<em>${escape_html(token.text)}</em>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]-->`);
    }
    $$renderer2.push(`<div${attr_class(`markdown-content ${stringify(className)}`, "svelte-tw0eab")}${attr("data-latex-enabled", latexEnabled())}${attr("data-mermaid-enabled", mermaidEnabled())}${attr("data-streaming", streaming)}>`);
    if (hasMermaid() && mermaidEnabled()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_7 = ensure_array_like(tokens());
      for (let $$index = 0, $$length = each_array_7.length; $$index < $$length; $$index++) {
        let token = each_array_7[$$index];
        if (token.type === "code" && token.lang === "mermaid") {
          $$renderer2.push("<!--[0-->");
          MermaidDiagram($$renderer2, { code: token.text });
        } else {
          $$renderer2.push("<!--[-1-->");
          tokenRenderer($$renderer2, token);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_8 = ensure_array_like(tokens());
      for (let $$index_1 = 0, $$length = each_array_8.length; $$index_1 < $$length; $$index_1++) {
        let token = each_array_8[$$index_1];
        tokenRenderer($$renderer2, token);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Message($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      message,
      showAvatar = true,
      showActions = true,
      compact = false,
      class: className = ""
    } = $$props;
    const role = derived(() => message.role);
    const isUser = derived(() => role() === "user");
    const isSystem = derived(() => role() === "system");
    const isAssistant = derived(() => role() === "assistant");
    const content = derived(() => typeof message.content === "string" ? message.content : message.content?.text || "");
    const isGenerating = derived(() => message.status === "generating");
    function getAvatarIcon() {
      switch (role()) {
        case "user":
          return "👤";
        case "assistant":
          return "🤖";
        case "system":
          return "⚙️";
        default:
          return "💬";
      }
    }
    $$renderer2.push(`<div${attr_class(`message ${stringify(className)}`, "svelte-1rf1are", {
      "message-user": isUser(),
      "message-assistant": isAssistant(),
      "message-system": isSystem(),
      "message-generating": isGenerating(),
      "compact": compact
    })}>`);
    if (showAvatar) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="message-avatar svelte-1rf1are"><span class="avatar-icon svelte-1rf1are">${escape_html(getAvatarIcon())}</span></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="message-content svelte-1rf1are">`);
    if (!compact && message.modelId) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="message-model svelte-1rf1are">${escape_html(message.modelId)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="message-body svelte-1rf1are">`);
    if (isUser()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="user-message svelte-1rf1are">${escape_html(content())}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      Markdown($$renderer2, { content: content(), streaming: isGenerating() });
    }
    $$renderer2.push(`<!--]--></div> `);
    if (!isUser() && showActions) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="message-actions svelte-1rf1are"><button class="action-btn svelte-1rf1are" title="Copy">${escape_html("📋")}</button> `);
      if (isGenerating()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="generating-indicator svelte-1rf1are">●</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (!compact && message.createdAt) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="message-timestamp svelte-1rf1are">${escape_html(new Date(message.createdAt).toLocaleTimeString())}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function MessageList($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { messages = [], class: className = "" } = $$props;
    $$renderer2.push(`<div${attr_class(`message-list ${stringify(className)}`, "svelte-26wxji")}>`);
    if (messages.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-state svelte-26wxji"><div class="empty-icon svelte-26wxji">💬</div> <p>No messages yet</p> <p class="empty-hint svelte-26wxji">Start a conversation to see messages here</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="messages svelte-26wxji"><!--[-->`);
      const each_array = ensure_array_like(messages);
      for (let index = 0, $$length = each_array.length; index < $$length; index++) {
        let message = each_array[index];
        $$renderer2.push(`<div class="message-wrapper svelte-26wxji"${attr("data-index", index)}>`);
        Message($$renderer2, {
          message,
          showAvatar: index === 0 || messages[index - 1]?.role !== message.role
        });
        $$renderer2.push(`<!----></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function InputBox($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      placeholder = "Type a message...",
      onSubmit,
      disabled = false,
      class: className = ""
    } = $$props;
    let input = "";
    let isFocused = false;
    $$renderer2.push(`<div${attr_class(`input-box ${stringify(className)}`, "svelte-ntzvrm", { "focused": isFocused, "disabled": disabled })}><div class="input-wrapper svelte-ntzvrm"><textarea${attr("placeholder", placeholder)}${attr("disabled", disabled, true)} rows="1" class="input-textarea svelte-ntzvrm">`);
    const $$body = escape_html(input);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea> <button class="send-button svelte-ntzvrm"${attr("disabled", disabled || !input.trim(), true)} aria-label="Send message"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg></button></div> <div class="input-hint svelte-ntzvrm"><span>Enter to send</span> <span>Shift+Enter for new line</span></div></div>`);
  });
}
export {
  InputBox as I,
  MessageList as M
};
