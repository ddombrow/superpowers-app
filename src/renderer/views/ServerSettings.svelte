<script lang="ts">
  import ResizeHandle from "../components/ResizeHandle.svelte";
  import { api } from "../lib/api";
  import { t } from "../lib/i18n";
  import { clearLocalServerLog, localServer } from "../lib/localServer.svelte";
  import { generatePassword, saveServerConfig, serverConfig } from "../lib/serverConfig.svelte";
  import { saveSettings, settings } from "../lib/settings.svelte";
  import SystemsPanel from "./SystemsPanel.svelte";

  let showPassword = $state(false);
  let logHeight = $state(180);
  let logCollapsed = $state(false);
  let logElement = $state<HTMLTextAreaElement>();

  const locked = $derived(localServer.status !== "stopped");

  $effect(() => {
    void localServer.log;
    if (logElement != null) logElement.scrollTop = logElement.scrollHeight;
  });

  function setNumber(key: "mainPort" | "buildPort" | "maxRecentBuilds", value: string) {
    const number = Number.parseInt(value, 10);
    if (serverConfig.config == null || Number.isNaN(number)) return;
    serverConfig.config[key] = number;
    saveServerConfig();
  }

  function setOpenToInternet(open: boolean) {
    if (serverConfig.config == null) return;
    serverConfig.config.password = open ? generatePassword() : "";
    saveServerConfig();
  }
</script>

<div class="server-settings">
  <div class="top">
    {#if !serverConfig.loaded}
      <p class="message">{t("common:states.loading")}</p>
    {:else if serverConfig.config == null}
      <p class="message">{t("server:settings.error")}</p>
    {:else}
      {@const config = serverConfig.config}
      <form class="settings" onsubmit={(event) => event.preventDefault()}>
        {#if locked}
          <p class="locked" role="status">{t("server:settings.serverMustBeStopped")}</p>
        {/if}
        <fieldset disabled={locked}>
          <legend>{t("server:settings.general.title")}</legend>
          <label>
            <span>{t("server:settings.general.serverName")}</span>
            <input
              type="text"
              maxlength="30"
              value={config.serverName ?? ""}
              oninput={(event) => {
                config.serverName = event.currentTarget.value || null;
                saveServerConfig();
              }}
            />
          </label>
          <label>
            <span>{t("server:settings.general.mainPort")}</span>
            <input
              type="number"
              min="1"
              max="65535"
              value={config.mainPort}
              oninput={(event) => setNumber("mainPort", event.currentTarget.value)}
            />
          </label>
          <label>
            <span>{t("server:settings.general.buildPort")}</span>
            <input
              type="number"
              min="1"
              max="65535"
              value={config.buildPort}
              oninput={(event) => setNumber("buildPort", event.currentTarget.value)}
            />
          </label>
        </fieldset>
        <label class="checkbox">
          <input
            type="checkbox"
            checked={settings.autoStartServer}
            onchange={(event) => {
              settings.autoStartServer = event.currentTarget.checked;
              saveSettings();
            }}
          />
          {t("server:settings.general.autoStart")}
        </label>

        <fieldset disabled={locked}>
          <legend>{t("server:settings.storage.title")}</legend>
          <label>
            <span>{t("server:settings.storage.recentBuilds")}</span>
            <input
              type="number"
              min="0"
              value={config.maxRecentBuilds}
              oninput={(event) => setNumber("maxRecentBuilds", event.currentTarget.value)}
            />
          </label>
        </fieldset>
        <div>
          <button type="button" onclick={() => api.send("app:open-projects-folder")}>
            {t("server:settings.storage.openProjectsFolder")}
          </button>
        </div>

        <fieldset disabled={locked}>
          <legend>{t("server:settings.authentication.title")}</legend>
          <label class="checkbox">
            <input
              type="checkbox"
              checked={config.password.length > 0}
              onchange={(event) => setOpenToInternet(event.currentTarget.checked)}
            />
            {t("server:settings.authentication.openToInternet")}
          </label>
          {#if config.password.length > 0}
            <label>
              <span>{t("server:settings.authentication.password")}</span>
              <span class="password">
                <input
                  type={showPassword ? "text" : "password"}
                  value={config.password}
                  autocomplete="off"
                  oninput={(event) => {
                    config.password = event.currentTarget.value;
                    saveServerConfig();
                  }}
                />
                <button type="button" onclick={() => (showPassword = !showPassword)}>
                  {showPassword ? t("common:actions.hide") : t("common:actions.show")}
                </button>
              </span>
            </label>
          {/if}
        </fieldset>
      </form>

      <SystemsPanel />
    {/if}
  </div>

  {#if !logCollapsed}
    <ResizeHandle side="top" bind:size={logHeight} min={60} max={600} label={t("server:log")} />
  {/if}
  <section class="log" style:height={logCollapsed ? "auto" : `${logHeight}px`} aria-label={t("server:log")}>
    <header>
      <button type="button" onclick={clearLocalServerLog}>{t("common:actions.clear")}</button>
      <h2>{t("server:log")}</h2>
      <button
        type="button"
        class="toggle"
        aria-expanded={!logCollapsed}
        aria-label={t("server:log")}
        onclick={() => (logCollapsed = !logCollapsed)}>{logCollapsed ? "+" : "–"}</button
      >
    </header>
    {#if !logCollapsed}
      <textarea bind:this={logElement} readonly value={localServer.log} aria-label={t("server:log")}></textarea>
    {/if}
  </section>
</div>

<style>
  .server-settings {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .top {
    flex: 1;
    display: flex;
    gap: 24px;
    min-height: 0;
    padding: 20px;
    overflow: auto;
  }
  .message {
    margin: auto;
    color: var(--fg-muted);
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 300px;
    flex: none;
  }
  .locked {
    margin: 0;
    padding: 8px 10px;
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--fg-muted);
  }
  fieldset {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 6px;
    font-size: 16px;
    font-weight: 500;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  label > span:first-child {
    font-size: 12px;
    color: var(--fg-muted);
  }
  .checkbox {
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }
  .password {
    display: flex;
    gap: 6px;
  }
  .password input {
    flex: 1;
    min-width: 0;
  }

  .log {
    display: flex;
    flex-direction: column;
    flex: none;
    min-height: 0;
    background: var(--bg-sunken);
  }
  .log header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-top: 1px solid var(--border);
  }
  .log h2 {
    flex: 1;
    font-size: 13px;
  }
  .log button {
    padding: 2px 10px;
  }
  .toggle {
    width: 28px;
  }
  .log textarea {
    flex: 1;
    min-height: 0;
    margin: 0 10px 10px;
    border-radius: var(--radius);
    font:
      12px/1.4 ui-monospace,
      Menlo,
      Consolas,
      monospace;
    resize: none;
  }
</style>
