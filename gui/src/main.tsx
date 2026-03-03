import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// MCP debugging plugin — registers event handlers for E2E testing (dev only)
if (import.meta.env.DEV) {
  import("tauri-plugin-mcp").then((mcp) => {
    mcp.setupPluginListeners();
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
