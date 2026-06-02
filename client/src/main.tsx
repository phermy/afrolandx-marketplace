import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Aggressively remove all Replit-injected UI elements (badge, beacon, cartographer, feedback)
function purgeReplitElements() {
  // Remove by known custom-element tag names
  const knownTags = [
    "replit-cartographer",
    "replit-beacon",
    "replit-badge",
    "runtime-error-plugin",
  ];
  knownTags.forEach((tag) => {
    document.querySelectorAll(tag).forEach((el) => el.remove());
  });

  // Remove any element whose id or class contains "replit" or "feedback" (Replit feedback widget)
  document.querySelectorAll("[id*='replit'],[class*='replit']").forEach((el) => el.remove());
  document.querySelectorAll("[id*='feedback'],[class*='feedback-button']").forEach((el) => el.remove());

  // Remove injected <script> tags pointing to replit.com
  document.querySelectorAll("script[src*='replit.com']").forEach((el) => el.remove());
}

// Run once immediately, then watch the entire document for new injections
purgeReplitElements();
const _replitObserver = new MutationObserver(purgeReplitElements);
_replitObserver.observe(document.documentElement, { childList: true, subtree: true });

createRoot(document.getElementById("root")!).render(<App />);
