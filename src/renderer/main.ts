import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { api, setAppInfo } from "./lib/api";
import { addContexts, setLanguageCode } from "./lib/i18n";

const namespaces = ["common", "startup", "sidebar", "server", "welcome", "home"];

async function main() {
  const info = await api.invoke("app:get-info");
  setAppInfo(info);

  setLanguageCode(info.languageCode);
  document.documentElement.lang = info.languageCode;
  const { contexts, fallbackContexts } = await api.invoke("app:get-locales", namespaces);
  addContexts(contexts, fallbackContexts);

  mount(App, { target: document.body });
}

void main();
