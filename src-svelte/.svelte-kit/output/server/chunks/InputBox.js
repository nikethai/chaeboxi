import { a as attr_class, b as attr, e as escape_html, d as derived, s as stringify } from "./root.js";
function InputBox($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      placeholder = "Type your question here...",
      disabled = false,
      generating = false,
      class: className = "",
      onSubmit,
      onStopGenerating
    } = $$props;
    let value = "";
    const canSubmit = derived(() => value.trim().length > 0 && !disabled && !generating);
    $$renderer2.push(`<div${attr_class(`input-container ${stringify(className)}`, "svelte-ntzvrm")}><div class="input-box-outer svelte-ntzvrm"><div class="input-box svelte-ntzvrm"><textarea${attr("placeholder", placeholder)}${attr("disabled", disabled, true)} rows="1" class="svelte-ntzvrm">`);
    const $$body = escape_html(value);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea> `);
    if (generating) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="send-btn stop-btn svelte-ntzvrm" type="button" aria-label="Stop generating"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<button${attr_class("send-btn svelte-ntzvrm", void 0, { "active": canSubmit() })} type="button"${attr("disabled", !canSubmit(), true)} aria-label="Send message"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>`);
    }
    $$renderer2.push(`<!--]--></div> <p class="disclaimer svelte-ntzvrm">AI can make mistakes. Double-check important information.</p></div></div>`);
  });
}
export {
  InputBox as I
};
