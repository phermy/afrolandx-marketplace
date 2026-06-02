import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Remove Replit dev UI badges (cartographer, beacon) from the page
function removeReplitElements() {
  const tags = ["replit-cartographer", "replit-beacon"];
  tags.forEach((tag) => {
    document.querySelectorAll(tag).forEach((el) => el.remove());
  });
}

// Run immediately and watch for any late-injected elements
removeReplitElements();
const _replitObserver = new MutationObserver(removeReplitElements);
_replitObserver.observe(document.body, { childList: true, subtree: true });

createRoot(document.getElementById("root")!).render(<App />);
