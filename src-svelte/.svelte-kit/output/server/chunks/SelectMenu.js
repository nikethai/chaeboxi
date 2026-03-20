import { a as attr_class, b as attr, e as escape_html, d as derived } from "./index2.js";
/* empty css                                         */
function SelectMenu($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      options = [],
      value = "",
      placeholder = "Select an option",
      disabled = false,
      fullWidth = true,
      align = "left",
      onChange,
      class: className = ""
    } = $$props;
    let open = false;
    const selectedOption = derived(() => options.find((option) => option.value === value));
    $$renderer2.push(`<div${attr_class(`select-menu ${fullWidth ? "full-width" : ""} ${className}`, "svelte-1u29ow9")}><button class="select-trigger svelte-1u29ow9" type="button"${attr("disabled", disabled || options.length === 0, true)}${attr("aria-expanded", open)}><span class="trigger-copy svelte-1u29ow9"><span${attr_class("trigger-label svelte-1u29ow9", void 0, { "selected": Boolean(selectedOption()) })}>${escape_html(selectedOption()?.label ?? placeholder)}</span> `);
    if (selectedOption()?.hint) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="trigger-hint svelte-1u29ow9">${escape_html(selectedOption().hint)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></span> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"${attr_class("svelte-1u29ow9", void 0, { "open": open })}><path d="M6 9l6 6 6-6"></path></svg></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  SelectMenu as S
};
