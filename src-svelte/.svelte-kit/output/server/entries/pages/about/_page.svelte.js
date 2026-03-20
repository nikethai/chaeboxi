import "clsx";
import { I as IncompleteState } from "../../../chunks/IncompleteState.js";
function _page($$renderer) {
  const notes = [
    "The repository link remains real.",
    "Version details and richer release UI still need a proper Svelte implementation."
  ];
  const links = [
    {
      href: "https://github.com/chaeboxi/chaeboxi",
      label: "View repository",
      external: true
    },
    { href: "/", label: "Back to chat" }
  ];
  IncompleteState($$renderer, {
    eyebrow: "About",
    title: "About is still a partial status surface",
    description: "Release metadata and richer application details still come from the React app. This route remains available as a clear incomplete-state page during the revamp.",
    notes,
    links
  });
}
export {
  _page as default
};
