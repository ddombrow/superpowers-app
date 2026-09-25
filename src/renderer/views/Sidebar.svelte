<script lang="ts">
  import type { ServerEntry } from "../../shared/types";
  import Icon from "../components/Icon.svelte";
  import ServerDialog from "../dialogs/ServerDialog.svelte";
  import { chatEnabled, openStatusTab, setNickname, setPresence } from "../lib/chat.svelte";
  import { nicknamePatternString } from "../lib/chatFormat";
  import { confirm, openDialog, prompt } from "../lib/dialogs.svelte";
  import { t } from "../lib/i18n";
  import { localServer, startLocalServer, stopLocalServer } from "../lib/localServer.svelte";
  import { serverConfig } from "../lib/serverConfig.svelte";
  import {
    addFavoriteServer,
    moveFavoriteServer,
    removeFavoriteServer,
    settings,
    updateFavoriteServer
  } from "../lib/settings.svelte";
  import { serverTabId, tabs } from "../lib/tabs.svelte";
  import avatarURL from "../assets/images/superpowers-256.png";

  let selectedId = $state<string | null>(null);
  let dragId = $state<string | null>(null);
  let dropIndex = $state<number | null>(null);

  const localEntry = $derived<ServerEntry>({
    id: "local",
    label: t("server:myServer"),
    hostname: "127.0.0.1",
    port: String(serverConfig.config?.mainPort ?? 4237),
    password: serverConfig.config?.password ?? ""
  });
  const entries = $derived([localEntry, ...settings.favoriteServers]);
  const selectedFavorite = $derived(settings.favoriteServers.find((server) => server.id === selectedId));

  function openServer(entry: ServerEntry) {
    tabs.open({ id: serverTabId(entry.id), kind: "server", server: $state.snapshot(entry) });
  }

  async function changeNickname() {
    const nickname = await prompt(t("sidebar:setNickname.title"), {
      initialValue: settings.nickname ?? "",
      confirmLabel: t("common:actions.update"),
      pattern: nicknamePatternString
    });
    if (nickname != null && nickname !== settings.nickname) setNickname(nickname);
  }

  async function addServer() {
    const entry = await openDialog(ServerDialog, {
      title: t("sidebar:addServer.title"),
      confirmLabel: t("common:actions.save"),
      initial: { hostname: "", port: "4237", label: "", password: "" }
    });
    if (entry != null) selectedId = addFavoriteServer(entry);
  }

  async function editServer() {
    const server = selectedFavorite;
    if (server == null) return;
    const entry = await openDialog(ServerDialog, {
      title: t("sidebar:editServer.title"),
      confirmLabel: t("common:actions.save"),
      initial: $state.snapshot(server)
    });
    if (entry != null) updateFavoriteServer(server.id, entry);
  }

  async function removeServer() {
    const server = selectedFavorite;
    if (server == null) return;
    const remove = await confirm(t("sidebar:removeServer.confirm", { label: server.label }), {
      confirmLabel: t("sidebar:servers.remove"),
      cancelLabel: t("common:actions.cancel")
    });
    if (remove) {
      removeFavoriteServer(server.id);
      selectedId = null;
    }
  }

  function onListKeydown(event: KeyboardEvent) {
    const index = entries.findIndex((entry) => entry.id === selectedId);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(entries.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)));
      selectedId = entries[next].id;
    } else if (event.key === "Enter" && index !== -1) {
      openServer(entries[index]);
    } else if ((event.key === "Delete" || event.key === "Backspace") && selectedFavorite != null) {
      void removeServer();
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    if (dragId != null && dropIndex != null) {
      const fromIndex = settings.favoriteServers.findIndex((server) => server.id === dragId);
      // Dropping below itself shifts everything up by one
      moveFavoriteServer(dragId, dropIndex > fromIndex ? dropIndex - 1 : dropIndex);
    }
    dragId = null;
    dropIndex = null;
  }
</script>

<aside class="sidebar">
  {#if chatEnabled()}
    <section class="me">
      <img src={avatarURL} alt="" width="44" height="44" />
      <div class="me-info">
        <button type="button" class="nickname" title={t("sidebar:setNickname.title")} onclick={changeNickname}>
          {settings.nickname ?? "Superpowers"}
        </button>
        <div class="presence">
          <select
            aria-label={t("sidebar:presence.label")}
            value={settings.presence}
            onchange={(event) => setPresence(event.currentTarget.value as typeof settings.presence)}
          >
            <option value="online">{t("sidebar:presence.online")}</option>
            <option value="away">{t("sidebar:presence.away")}</option>
            <option value="offline">{t("sidebar:presence.offline")}</option>
          </select>
          <button type="button" class="link status-link" onclick={openStatusTab}>
            {t("sidebar:chat.showStatus")}
          </button>
        </div>
      </div>
    </section>
  {/if}

  <div class="toolbar" role="toolbar" aria-label={t("sidebar:servers.title")}>
    <button type="button" title={t("sidebar:servers.add")} aria-label={t("sidebar:servers.add")} onclick={addServer}>
      <Icon name="add" />
    </button>
    <button
      type="button"
      title={t("sidebar:servers.edit")}
      aria-label={t("sidebar:servers.edit")}
      disabled={selectedFavorite == null}
      onclick={editServer}
    >
      <Icon name="edit" />
    </button>
    <button
      type="button"
      title={t("sidebar:servers.remove")}
      aria-label={t("sidebar:servers.remove")}
      disabled={selectedFavorite == null}
      onclick={removeServer}
    >
      <Icon name="remove" />
    </button>
  </div>

  <ul
    class="servers"
    role="listbox"
    aria-label={t("sidebar:servers.title")}
    aria-activedescendant={selectedId != null ? `server-${selectedId}` : undefined}
    tabindex="0"
    onkeydown={onListKeydown}
    ondragover={(event) => {
      if (dragId != null) event.preventDefault();
    }}
    ondrop={onDrop}
  >
    {#each entries as entry (entry.id)}
      {@const favoriteIndex = settings.favoriteServers.indexOf(entry)}
      <!-- Keyboard selection is handled by the listbox (aria-activedescendant) -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        id="server-{entry.id}"
        role="option"
        aria-selected={entry.id === selectedId}
        class:drop-before={dropIndex === favoriteIndex && favoriteIndex !== -1}
        draggable={entry.id !== "local"}
        onclick={() => (selectedId = entry.id)}
        ondblclick={() => openServer(entry)}
        ondragstart={(event) => {
          dragId = entry.id;
          event.dataTransfer?.setData("text/plain", entry.label);
        }}
        ondragend={() => {
          dragId = null;
          dropIndex = null;
        }}
        ondragover={(event) => {
          if (dragId == null) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const below = event.clientY > rect.top + rect.height / 2;
          dropIndex = entry.id === "local" ? 0 : favoriteIndex + (below ? 1 : 0);
        }}
      >
        <span class="label">{entry.label}</span>
        <span class="host">
          {entry.id === "local" ? t("server:autoConfigured") : `${entry.hostname}${entry.port ? `:${entry.port}` : ""}`}
        </span>
      </li>
    {/each}
    {#if dropIndex === settings.favoriteServers.length && dragId != null}
      <li class="drop-end" aria-hidden="true"></li>
    {/if}
  </ul>

  <section class="local-server" aria-label={t("server:myServer")}>
    <span class="status" role="status">
      {localServer.updating && localServer.status === "stopped"
        ? t("server:status.updating")
        : t(`server:status.${localServer.status}`)}
    </span>
    {#if localServer.status === "stopped"}
      <button type="button" disabled={localServer.updating} onclick={startLocalServer}>
        {t("server:buttons.start")}
      </button>
    {:else}
      <button type="button" disabled={localServer.status === "stopping"} onclick={stopLocalServer}>
        {t("server:buttons.stop")}
      </button>
    {/if}
    <button type="button" onclick={() => tabs.open({ id: "server-settings", kind: "server-settings" })}>
      {t("server:buttons.settings")}
    </button>
  </section>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-sidebar);
  }

  .me {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-bottom: 1px solid var(--border);
  }
  .me img {
    border-radius: 8px;
    background: var(--bg-sunken);
  }
  .me-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .nickname {
    padding: 0;
    border: 0;
    background: none;
    font-size: 20px;
    font-weight: 500;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nickname:hover:not(:disabled) {
    background: none;
    text-decoration: underline;
  }
  .presence {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .presence select {
    padding: 2px 6px;
  }
  /* Revealed on hover; opacity (unlike visibility) keeps it reachable from the keyboard */
  .status-link {
    font-size: 12px;
    color: var(--fg-muted);
    opacity: 0;
  }
  .presence:hover .status-link,
  .status-link:focus-visible {
    opacity: 1;
  }

  .toolbar {
    display: flex;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
  }
  .toolbar button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 28px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--fg-muted);
  }
  .toolbar button:hover:not(:disabled) {
    color: var(--fg);
    background: var(--bg-hover);
  }

  .servers {
    flex: 1;
    margin: 0;
    padding: 4px 0;
    list-style: none;
    overflow-y: auto;
  }
  .servers li {
    display: flex;
    flex-direction: column;
    padding: 8px 14px;
    border-top: 2px solid transparent;
    cursor: default;
  }
  .servers li:hover {
    background: var(--bg-hover);
  }
  .servers li[aria-selected="true"] {
    background: var(--bg-selected);
  }
  .servers li.drop-before,
  .servers .drop-end {
    border-top-color: var(--accent);
  }
  .label {
    font-size: 17px;
  }
  .label,
  .host {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .host {
    font-size: 12px;
    color: var(--fg-muted);
  }

  .local-server {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-top: 1px solid var(--border);
    background: var(--bg-sunken);
  }
  .local-server .status {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
