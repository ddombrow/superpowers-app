<script lang="ts">
  import type { ServerEntry, ServerProbeResult } from "../../shared/types";
  import { getServerUrls } from "../../shared/serverUrl";
  import { api, appInfo } from "../lib/api";
  import { t } from "../lib/i18n";

  let { server, active }: { server: ServerEntry; active: boolean } = $props();

  const urls = $derived(getServerUrls(server.hostname, server.port !== "" ? server.port : 4237));

  let probe = $state<ServerProbeResult | "connecting">("connecting");
  let loaded = $state(false);
  let loadFailed = $state(false);
  let webview = $state<HTMLElement>();

  async function connect() {
    probe = "connecting";
    loaded = false;
    loadFailed = false;
    const result = await api.invoke("server:probe", urls.baseUrl, server.password);

    if (result.ok) {
      const auth = { username: "superpowers", password: server.password };
      api.send("app:set-http-auth", urls.hostnameAndPort, auth);
      api.send("app:set-http-auth", `${urls.hostname}:${result.buildPort}`, auth);
    }
    probe = result;
  }

  $effect(() => {
    void connect();
  });

  $effect(() => {
    if (webview == null) return;
    const onLoad = () => (loaded = true);
    const onFail = (event: Event) => {
      // Aborted sub-navigations (-3) aren't failures
      if ((event as Event & { errorCode?: number }).errorCode !== -3) loadFailed = true;
    };
    webview.addEventListener("did-finish-load", onLoad);
    webview.addEventListener("did-fail-load", onFail);
    return () => {
      webview?.removeEventListener("did-finish-load", onLoad);
      webview?.removeEventListener("did-fail-load", onFail);
    };
  });

  $effect(() => {
    if (active && loaded) webview?.focus();
  });

  const message = $derived.by(() => {
    const baseUrl = urls.baseUrl;
    if (probe === "connecting") return t("common:server.connecting", { baseUrl });
    if (probe.ok) return loadFailed ? t("common:server.errors.failedToLoad", { baseUrl }) : null;
    switch (probe.error) {
      case "unauthorized":
        return t("common:server.errors.incorrectPassword", { baseUrl });
      case "notSuperpowers":
        return t("common:server.errors.notSuperpowers", { baseUrl });
      case "incompatible":
        return t("common:server.errors.incompatibleVersion", {
          baseUrl,
          serverVersion: probe.serverApiVersion,
          appVersion: appInfo.appApiVersion
        });
      default:
        return t("common:server.errors.superpowersJSON", { baseUrl });
    }
  });
</script>

<div class="server">
  {#if probe !== "connecting" && probe.ok && !loadFailed}
    <webview bind:this={webview} src={urls.baseUrl}></webview>
  {/if}

  {#if message != null || !loaded}
    <div class="overlay" role="status">
      {#if message != null}
        <p>{message}</p>
        {#if probe !== "connecting"}
          <button type="button" onclick={connect}>{t("common:server.tryAgain")}</button>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .server {
    position: relative;
    display: flex;
    height: 100%;
  }
  webview {
    flex: 1;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 32px;
    background: var(--bg);
  }
  .overlay p {
    max-width: 640px;
    margin: 0;
    font-size: 20px;
    text-align: center;
    color: var(--fg-muted);
    user-select: text;
  }
</style>
