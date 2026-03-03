import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// MCP debugging plugin — registers event handlers for E2E testing (dev only)
if (import.meta.env.DEV) {
  // @ts-expect-error — tauri-plugin-mcp is an optional dev dependency for E2E testing
  import("tauri-plugin-mcp").then((mcp: { setupPluginListeners: () => void }) => {
    mcp.setupPluginListeners();
  }).catch(() => {/* not installed — skip */});
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
