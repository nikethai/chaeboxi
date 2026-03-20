import "clsx";
import { I as IncompleteState } from "../../../../chunks/IncompleteState.js";
function _page($$renderer) {
  const notes = [
    "Knowledge-base management remains outside the current core-settings milestone.",
    "The route stays visible so users can distinguish missing UI from a broken link."
  ];
  IncompleteState($$renderer, {
    eyebrow: "Knowledge Base",
    title: "Knowledge-base settings are still partial",
    description: "Knowledge-base management and related settings remain out of scope for this Svelte pass.",
    notes
  });
}
export {
  _page as default
};
