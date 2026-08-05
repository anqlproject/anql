import "@/core/Global/Themes.css";
import "@/core/Global/Typography.css";
import "@/core/logger/ConsoleManager";

import { invoke } from "@tauri-apps/api/core";
import * as React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";

import App from "@/App/App";
import { ThemeProvider } from "@/core/global/ThemeContext";
import i18n from "@/core/locales";

import { GlobalStoreProvider } from "./App/store/GlobalStoreProvider";

// prevent default select
document.addEventListener("DOMContentLoaded", () => {
  document.body.style.webkitUserSelect = "none";
});

// prevent default context menu (only in release mode)
let isDebug = false;
invoke<boolean>('is_debug_mode').then((res) => {
  isDebug = res;
});

document.addEventListener('contextmenu', (event) => {
  if (!isDebug) {
    event.preventDefault();
  }
});

// prevents page refresh shortcuts:
document.addEventListener("keydown", (event) => {
  if (
    event.key === "F5" ||
    (event.ctrlKey && event.key === "r") ||
    (event.metaKey && event.key === "r")
  ) {
    event.preventDefault();
  }
});

// Disable autocorrect, spellcheck, and autocomplete for input fields
document.addEventListener("focusin", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
    target.setAttribute("autocorrect", "off");
    target.setAttribute("spellcheck", "false");
    target.setAttribute("autocomplete", "off");
  }
});

// Allow drag operations by preventing default browser behavior
document.addEventListener("dragover", (event) => {
  event.preventDefault();
});

// Prevent default browser behavior when dropping elements
document.addEventListener("drop", (event) => {
  event.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <GlobalStoreProvider>
          <App />
        </GlobalStoreProvider>
      </ThemeProvider>
    </I18nextProvider>
  </React.StrictMode>,
);
