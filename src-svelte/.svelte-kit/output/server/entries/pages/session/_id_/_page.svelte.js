import { b as attr, e as escape_html, d as derived, a as attr_class, f as ensure_array_like, j as element, s as stringify, g as store_get, u as unsubscribe_stores } from "../../../../chunks/root.js";
import { u as uiStore, p as page } from "../../../../chunks/ui.svelte.js";
import { Lexer, marked } from "marked";
import { a as settingsStore, c as conversationStore } from "../../../../chunks/conversation.svelte.js";
import { I as InputBox } from "../../../../chunks/InputBox.js";
import "lodash";
import "clsx";
function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
}
function processLaTeX(content) {
  const codeBlocks = [];
  content = content.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (_, code) => {
    codeBlocks.push(code);
    return `<<CODE_BLOCK_${codeBlocks.length - 1}>>`;
  });
  const latexExpressions = [];
  content = content.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g, (match) => {
    latexExpressions.push(match);
    return `<<LATEX_${latexExpressions.length - 1}>>`;
  });
  content = content.replace(/\$(?=\d)/g, "\\$");
  content = content.replace(/<<LATEX_(\d+)>>/g, (_, index) => latexExpressions[Number.parseInt(index, 10)]);
  content = content.replace(/<<CODE_BLOCK_(\d+)>>/g, (_, index) => codeBlocks[Number.parseInt(index, 10)]);
  content = escapeBrackets(content);
  content = escapeMhchem(content);
  return content;
}
function escapeBrackets(text) {
  const pattern = /(```[\S\s]*?```|`.*?`)|\\\[([\S\s]*?[^\\])\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (match, codeBlock, squareBracket, roundBracket) => {
      if (codeBlock != null) {
        return codeBlock;
      }
      if (squareBracket != null) {
        return `$$${squareBracket}$$`;
      }
      if (roundBracket != null) {
        return `$${roundBracket}$`;
      }
      return match;
    }
  );
}
function escapeMhchem(text) {
  return text.replaceAll("$\\ce{", "$\\\\ce{").replaceAll("$\\pu{", "$\\\\pu{");
}
function CodeBlock($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      code,
      language = "text",
      showLineNumbers = false
    } = $$props;
    let isCollapsed = false;
    const CODE_COLLAPSE_THRESHOLD = 7;
    const shouldCollapse = derived(() => code.split("\n").length > CODE_COLLAPSE_THRESHOLD);
    $$renderer2.push(`<div class="code-block svelte-1cs64w0"${attr("data-language", language)}${attr("data-line-numbers", showLineNumbers)}><div class="code-header svelte-1cs64w0"><div class="code-info svelte-1cs64w0"><span class="code-language svelte-1cs64w0">${escape_html(language)}</span> `);
    if (shouldCollapse()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="collapse-button svelte-1cs64w0" type="button">${escape_html("Collapse")}</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <button class="copy-button svelte-1cs64w0" type="button">${escape_html("Copy")}</button></div> `);
    if (shouldCollapse() && isCollapsed) ;
    else {
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
    const markdownOptions = { gfm: true, breaks: true };
    const latexEnabled = derived(() => enableLaTeX && settingsStore.settings.enableLaTeXRendering);
    const mermaidEnabled = derived(() => enableMermaid && settingsStore.settings.enableMermaidRendering);
    const mermaidTheme = derived(() => uiStore.state.realTheme === "dark" ? "dark" : "default");
    const normalizedContent = derived(() => latexEnabled() ? processLaTeX(content) : content);
    const tokens = derived(() => {
      try {
        return normalizedContent() ? marked.lexer(normalizedContent(), markdownOptions) : [];
      } catch (error) {
        console.error("Markdown parse error:", error);
        return [];
      }
    });
    function getHeadingTag(depth) {
      return `h${Math.min(Math.max(depth, 1), 6)}`;
    }
    function getInlineTokens(token) {
      if (token.tokens?.length) {
        return token.tokens;
      }
      return token.text ? Lexer.lexInline(token.text, markdownOptions) : [];
    }
    function getChildTokens(token) {
      return token.tokens ?? [];
    }
    function splitTextSegments(text) {
      const segments = [];
      const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g;
      let lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
          segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
        }
        const raw = match[0];
        const isDisplay = raw.startsWith("$$") && raw.endsWith("$$");
        segments.push({
          type: isDisplay ? "math-display" : "math-inline",
          content: raw.slice(isDisplay ? 2 : 1, isDisplay ? -2 : -1).trim()
        });
        lastIndex = pattern.lastIndex;
      }
      if (lastIndex < text.length) {
        segments.push({ type: "text", content: text.slice(lastIndex) });
      }
      return segments.length ? segments : [{ type: "text", content: text }];
    }
    function renderBlockTokens($$renderer3, blockTokens) {
      $$renderer3.push(`<!--[-->`);
      const each_array = ensure_array_like(blockTokens);
      for (let index = 0, $$length = each_array.length; index < $$length; index++) {
        let token = each_array[index];
        renderBlockToken($$renderer3, token);
      }
      $$renderer3.push(`<!--]-->`);
    }
    function renderBlockToken($$renderer3, token) {
      if (token.type === "heading") {
        $$renderer3.push("<!--[0-->");
        element($$renderer3, getHeadingTag(token.depth), void 0, () => {
          renderInlineTokens($$renderer3, getInlineTokens(token));
        });
      } else if (token.type === "paragraph") {
        $$renderer3.push("<!--[1-->");
        $$renderer3.push(`<p>`);
        renderInlineTokens($$renderer3, getInlineTokens(token));
        $$renderer3.push(`<!----></p>`);
      } else if (token.type === "text") {
        $$renderer3.push("<!--[2-->");
        $$renderer3.push(`<p>`);
        renderInlineTokens($$renderer3, getInlineTokens(token));
        $$renderer3.push(`<!----></p>`);
      } else if (token.type === "code") {
        $$renderer3.push("<!--[3-->");
        if (token.lang === "mermaid" && mermaidEnabled()) {
          $$renderer3.push("<!--[0-->");
          MermaidDiagram($$renderer3, { code: token.text, theme: mermaidTheme() });
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
        $$renderer3.push("<!--[4-->");
        $$renderer3.push(`<blockquote>`);
        renderBlockTokens($$renderer3, getChildTokens(token));
        $$renderer3.push(`<!----></blockquote>`);
      } else if (token.type === "list") {
        $$renderer3.push("<!--[5-->");
        if (token.ordered) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<ol${attr("start", typeof token.start === "number" ? token.start : void 0)}><!--[-->`);
          const each_array_1 = ensure_array_like(token.items);
          for (let itemIndex = 0, $$length = each_array_1.length; itemIndex < $$length; itemIndex++) {
            let item = each_array_1[itemIndex];
            $$renderer3.push(`<li>`);
            if (item.task) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<input type="checkbox"${attr("checked", Boolean(item.checked), true)} disabled=""/>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            renderBlockTokens($$renderer3, getChildTokens(item));
            $$renderer3.push(`<!----></li>`);
          }
          $$renderer3.push(`<!--]--></ol>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<ul><!--[-->`);
          const each_array_2 = ensure_array_like(token.items);
          for (let itemIndex = 0, $$length = each_array_2.length; itemIndex < $$length; itemIndex++) {
            let item = each_array_2[itemIndex];
            $$renderer3.push(`<li>`);
            if (item.task) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<input type="checkbox"${attr("checked", Boolean(item.checked), true)} disabled=""/>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            renderBlockTokens($$renderer3, getChildTokens(item));
            $$renderer3.push(`<!----></li>`);
          }
          $$renderer3.push(`<!--]--></ul>`);
        }
        $$renderer3.push(`<!--]-->`);
      } else if (token.type === "table") {
        $$renderer3.push("<!--[6-->");
        $$renderer3.push(`<div class="table-wrapper"><table><thead><tr><!--[-->`);
        const each_array_3 = ensure_array_like(token.header);
        for (let cellIndex = 0, $$length = each_array_3.length; cellIndex < $$length; cellIndex++) {
          let cell = each_array_3[cellIndex];
          $$renderer3.push(`<th${attr("align", cell.align ?? void 0)}>`);
          renderInlineTokens($$renderer3, getChildTokens(cell));
          $$renderer3.push(`<!----></th>`);
        }
        $$renderer3.push(`<!--]--></tr></thead><tbody><!--[-->`);
        const each_array_4 = ensure_array_like(token.rows);
        for (let rowIndex = 0, $$length = each_array_4.length; rowIndex < $$length; rowIndex++) {
          let row = each_array_4[rowIndex];
          $$renderer3.push(`<tr><!--[-->`);
          const each_array_5 = ensure_array_like(row);
          for (let cellIndex = 0, $$length2 = each_array_5.length; cellIndex < $$length2; cellIndex++) {
            let cell = each_array_5[cellIndex];
            $$renderer3.push(`<td${attr("align", cell.align ?? void 0)}>`);
            renderInlineTokens($$renderer3, getChildTokens(cell));
            $$renderer3.push(`<!----></td>`);
          }
          $$renderer3.push(`<!--]--></tr>`);
        }
        $$renderer3.push(`<!--]--></tbody></table></div>`);
      } else if (token.type === "hr") {
        $$renderer3.push("<!--[7-->");
        $$renderer3.push(`<hr/>`);
      } else if (token.type === "html") {
        $$renderer3.push("<!--[8-->");
        if (enableHtml) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`${html(token.text)}`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<p>${escape_html(token.text)}</p>`);
        }
        $$renderer3.push(`<!--]-->`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]-->`);
    }
    function renderInlineTokens($$renderer3, inlineTokens) {
      $$renderer3.push(`<!--[-->`);
      const each_array_6 = ensure_array_like(inlineTokens);
      for (let index = 0, $$length = each_array_6.length; index < $$length; index++) {
        let token = each_array_6[index];
        if (token.type === "text" || token.type === "escape") {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<!--[-->`);
          const each_array_7 = ensure_array_like(splitTextSegments(token.text));
          for (let segmentIndex = 0, $$length2 = each_array_7.length; segmentIndex < $$length2; segmentIndex++) {
            let segment = each_array_7[segmentIndex];
            if (segment.type === "math-inline" && latexEnabled()) {
              $$renderer3.push("<!--[0-->");
              KatexRenderer($$renderer3, { content: segment.content, displayMode: false });
            } else if (segment.type === "math-display" && latexEnabled()) {
              $$renderer3.push("<!--[1-->");
              KatexRenderer($$renderer3, { content: segment.content, displayMode: true });
            } else {
              $$renderer3.push("<!--[-1-->");
              $$renderer3.push(`${escape_html(segment.content)}`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]-->`);
        } else if (token.type === "strong") {
          $$renderer3.push("<!--[1-->");
          $$renderer3.push(`<strong>`);
          renderInlineTokens($$renderer3, getChildTokens(token));
          $$renderer3.push(`<!----></strong>`);
        } else if (token.type === "em") {
          $$renderer3.push("<!--[2-->");
          $$renderer3.push(`<em>`);
          renderInlineTokens($$renderer3, getChildTokens(token));
          $$renderer3.push(`<!----></em>`);
        } else if (token.type === "codespan") {
          $$renderer3.push("<!--[3-->");
          $$renderer3.push(`<code>${escape_html(token.text)}</code>`);
        } else if (token.type === "del") {
          $$renderer3.push("<!--[4-->");
          $$renderer3.push(`<del>`);
          renderInlineTokens($$renderer3, getChildTokens(token));
          $$renderer3.push(`<!----></del>`);
        } else if (token.type === "link") {
          $$renderer3.push("<!--[5-->");
          $$renderer3.push(`<a${attr("href", token.href)} target="_blank" rel="noreferrer">`);
          renderInlineTokens($$renderer3, getChildTokens(token));
          $$renderer3.push(`<!----></a>`);
        } else if (token.type === "image") {
          $$renderer3.push("<!--[6-->");
          $$renderer3.push(`<img${attr("src", token.href)}${attr("alt", token.text)}${attr("title", token.title ?? void 0)}/>`);
        } else if (token.type === "br") {
          $$renderer3.push("<!--[7-->");
          $$renderer3.push(`<br/>`);
        } else if (token.type === "html") {
          $$renderer3.push("<!--[8-->");
          if (enableHtml) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`${html(token.text)}`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`${escape_html(token.text)}`);
          }
          $$renderer3.push(`<!--]-->`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      }
      $$renderer3.push(`<!--]-->`);
    }
    $$renderer2.push(`<div${attr_class(`markdown-content ${stringify(className)}`, "svelte-tw0eab")}${attr("data-streaming", streaming)}>`);
    renderBlockTokens($$renderer2, tokens());
    $$renderer2.push(`<!----></div>`);
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
    const isGenerating = derived(() => Boolean(message.generating));
    const showModelLabel = derived(() => Boolean(settingsStore.settings.showModelName && isAssistant() && message.model));
    function formatPayload(value) {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    $$renderer2.push(`<div${attr_class(`message-row ${stringify(className)}`, "svelte-1rf1are", {
      "user": isUser(),
      "assistant": isAssistant(),
      "system": isSystem()
    })}>`);
    if (showAvatar) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr_class("avatar svelte-1rf1are", void 0, { "user-avatar": isUser(), "assistant-avatar": isAssistant() })}>`);
      if (isUser()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1rf1are"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" class="svelte-1rf1are"></path><circle cx="12" cy="7" r="4" class="svelte-1rf1are"></circle></svg>`);
      } else if (isSystem()) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1rf1are"><circle cx="12" cy="12" r="3" class="svelte-1rf1are"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.74 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" class="svelte-1rf1are"></path></svg>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1rf1are"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" class="svelte-1rf1are"></path></svg>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="avatar-spacer svelte-1rf1are"></div>`);
    }
    $$renderer2.push(`<!--]--> <div class="message-content svelte-1rf1are">`);
    if (showModelLabel() || isGenerating()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="message-meta svelte-1rf1are">`);
      if (showModelLabel()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="model-label svelte-1rf1are">${escape_html(message.model)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isGenerating()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="status-pill svelte-1rf1are">Generating</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div${attr_class("message-bubble svelte-1rf1are", void 0, {
      "user-bubble": isUser(),
      "system-bubble": isSystem(),
      "compact": compact
    })}>`);
    if (message.contentParts?.length) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(message.contentParts);
      for (let index = 0, $$length = each_array.length; index < $$length; index++) {
        let part = each_array[index];
        $$renderer2.push(`<div class="content-part svelte-1rf1are">`);
        if (part.type === "text") {
          $$renderer2.push("<!--[0-->");
          if (isUser()) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="user-text svelte-1rf1are">${escape_html(part.text)}</div>`);
          } else if (settingsStore.settings.enableMarkdownRendering) {
            $$renderer2.push("<!--[1-->");
            Markdown($$renderer2, {
              content: part.text,
              streaming: isGenerating() && index === message.contentParts.length - 1
            });
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<div class="assistant-text svelte-1rf1are">${escape_html(part.text)}</div>`);
          }
          $$renderer2.push(`<!--]-->`);
        } else if (part.type === "reasoning") {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<div class="part-card svelte-1rf1are"><div class="part-label svelte-1rf1are">Reasoning</div> <div class="part-body svelte-1rf1are">${escape_html(part.text || "Reasoning is streaming.")}</div></div>`);
        } else if (part.type === "info") {
          $$renderer2.push("<!--[2-->");
          $$renderer2.push(`<div class="part-card svelte-1rf1are"><div class="part-label svelte-1rf1are">Info</div> <div class="part-body svelte-1rf1are">${escape_html(part.text)}</div></div>`);
        } else if (part.type === "tool-call") {
          $$renderer2.push("<!--[3-->");
          $$renderer2.push(`<div class="part-card svelte-1rf1are"><div class="part-label svelte-1rf1are">Tool ${escape_html(part.state)}</div> <div class="part-body svelte-1rf1are">${escape_html(part.toolName)}</div> <pre class="svelte-1rf1are">${escape_html(formatPayload(part.result ?? part.args))}</pre></div>`);
        } else if (part.type === "image") {
          $$renderer2.push("<!--[4-->");
          $$renderer2.push(`<div class="part-card svelte-1rf1are"><div class="part-label svelte-1rf1are">Image</div> <div class="part-body svelte-1rf1are">Image content is not rendered in this rescue pass.</div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else if (isGenerating()) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="generating-placeholder svelte-1rf1are"><span class="dot svelte-1rf1are"></span> Generating response…</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (message.error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="error-note svelte-1rf1are">${escape_html(message.error)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (!isUser() && showActions) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr_class("message-actions svelte-1rf1are", void 0, { "visible": isGenerating() })}><button class="action-btn svelte-1rf1are" type="button"${attr("title", "Copy")} aria-label="Copy message">`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1rf1are"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" class="svelte-1rf1are"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" class="svelte-1rf1are"></path></svg>`);
      }
      $$renderer2.push(`<!--]--></button></div>`);
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
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="messages svelte-26wxji"><!--[-->`);
      const each_array = ensure_array_like(messages);
      for (let index = 0, $$length = each_array.length; index < $$length; index++) {
        let message = each_array[index];
        $$renderer2.push(`<div class="message-wrapper svelte-26wxji">`);
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
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const sessionId = derived(() => store_get($$store_subs ??= {}, "$page", page).params.id);
    const session = derived(() => sessionId() && conversationStore.currentSession?.id === sessionId() ? conversationStore.currentSession : null);
    const messages = derived(() => session() ? conversationStore.messages : []);
    const generating = derived(() => Boolean(sessionId() && conversationStore.lastGeneratingMessage));
    async function handleSubmit(message) {
      if (!sessionId()) {
        return;
      }
      await conversationStore.submitToSession(sessionId(), message);
    }
    async function handleStopGenerating() {
      if (!sessionId()) {
        return;
      }
      await conversationStore.stopGenerating(sessionId());
    }
    if (session()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="session-page svelte-1a2wdfb">`);
      MessageList($$renderer2, { messages: messages() });
      $$renderer2.push(`<!----> `);
      InputBox($$renderer2, {
        onSubmit: handleSubmit,
        generating: generating(),
        onStopGenerating: handleStopGenerating,
        placeholder: "Type a message..."
      });
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
