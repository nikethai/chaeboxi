import { a as attr_class, e as escape_html, f as ensure_array_like, b as attr } from "./index2.js";
function IncompleteState($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      eyebrow = "Incomplete route",
      badge = "Partial",
      title,
      description,
      notes = [],
      links = [],
      class: className = ""
    } = $$props;
    $$renderer2.push(`<section${attr_class(`incomplete-state ${className}`, "svelte-z776k9")}><div class="hero-card svelte-z776k9"><div class="hero-header svelte-z776k9"><div class="eyebrow-row svelte-z776k9"><span class="eyebrow svelte-z776k9">${escape_html(eyebrow)}</span> <span class="badge svelte-z776k9">${escape_html(badge)}</span></div> <h1 class="svelte-z776k9">${escape_html(title)}</h1> <p class="svelte-z776k9">${escape_html(description)}</p></div> `);
    if (notes.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<ul class="notes svelte-z776k9"><!--[-->`);
      const each_array = ensure_array_like(notes);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let note = each_array[$$index];
        $$renderer2.push(`<li class="svelte-z776k9">${escape_html(note)}</li>`);
      }
      $$renderer2.push(`<!--]--></ul>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (links.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="actions svelte-z776k9"><!--[-->`);
      const each_array_1 = ensure_array_like(links);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let link = each_array_1[$$index_1];
        $$renderer2.push(`<a${attr("href", link.href)}${attr("target", link.external ? "_blank" : void 0)}${attr("rel", link.external ? "noopener noreferrer" : void 0)} class="svelte-z776k9">${escape_html(link.label)}</a>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></section>`);
  });
}
export {
  IncompleteState as I
};
