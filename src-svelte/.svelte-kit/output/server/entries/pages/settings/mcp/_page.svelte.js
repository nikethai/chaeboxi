import "clsx";
import { I as IncompleteState } from "../../../../chunks/IncompleteState.js";
function _page($$renderer) {
  const notes = [
    "MCP configuration and status management still come from the React app.",
    "This route stays visible only as an explicit partial surface on desktop."
  ];
  IncompleteState($$renderer, {
    eyebrow: "MCP",
    title: "MCP settings are still partial",
    description: "The advanced MCP management flow has not been ported to the Svelte shell yet.",
    notes
  });
}
export {
  _page as default
};
