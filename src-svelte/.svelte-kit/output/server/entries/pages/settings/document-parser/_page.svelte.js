import "clsx";
import { I as IncompleteState } from "../../../../chunks/IncompleteState.js";
function _page($$renderer) {
  const notes = [
    "Chat already links into settings when document parser configuration matters.",
    "Provider and core chat settings are real; document parser UI still needs a dedicated Svelte port."
  ];
  IncompleteState($$renderer, {
    eyebrow: "Document Parser",
    title: "Document parser settings are still partial",
    description: "The shared document parser config exists, but this route still needs a dedicated Svelte editor. It remains visible so the missing state is explicit rather than pretending the feature is done.",
    notes
  });
}
export {
  _page as default
};
