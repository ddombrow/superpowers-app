<script lang="ts">
  import DialogHost from "./components/DialogHost.svelte";
  import ResizeHandle from "./components/ResizeHandle.svelte";
  import Splash from "./components/Splash.svelte";
  import TabStrip from "./components/TabStrip.svelte";
  import WelcomeDialog from "./dialogs/WelcomeDialog.svelte";
  import { api } from "./lib/api";
  import { t } from "./lib/i18n";
  import { boot, startup } from "./lib/startup.svelte";
  import { tabs } from "./lib/tabs.svelte";
  import ChatPane from "./views/ChatPane.svelte";
  import Home from "./views/Home.svelte";
  import ServerPane from "./views/ServerPane.svelte";
  import ServerSettings from "./views/ServerSettings.svelte";
  import Sidebar from "./views/Sidebar.svelte";

  let sidebarWidth = $state(280);

  $effect(() => {
    void boot(WelcomeDialog);
  });

  // ⌘W on macOS goes through the app menu
  $effect(() => api.on("app:close-tab", () => tabs.close(tabs.activeId)));

  function onkeydown(event: KeyboardEvent) {
    const ctrlOrCmd = event.ctrlKey || event.metaKey;
    if (event.key === "F12") {
      api.send("app:open-dev-tools");
    } else if (ctrlOrCmd && event.key.toLowerCase() === "w") {
      event.preventDefault();
      tabs.close(tabs.activeId);
    } else if (event.ctrlKey && event.key === "Tab") {
      event.preventDefault();
      tabs.activateNext(event.shiftKey ? -1 : 1);
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="app" inert={startup.phase !== "ready"}>
  <div class="sidebar" style:width="{sidebarWidth}px">
    <Sidebar />
  </div>
  <ResizeHandle side="right" bind:size={sidebarWidth} min={220} max={480} label={t("sidebar:servers.title")} />

  <div class="main">
    <TabStrip />
    <div class="panes">
      <!-- Panes stay mounted while their tab is open, so webviews and chat logs keep their state -->
      {#each tabs.list as tab (tab.id)}
        {@const active = tab.id === tabs.activeId}
        <div class="pane" id="pane-{tab.id}" role="tabpanel" aria-labelledby="tab-{tab.id}" hidden={!active}>
          {#if tab.kind === "home"}
            <Home />
          {:else if tab.kind === "server-settings"}
            <ServerSettings />
          {:else if tab.kind === "server"}
            <ServerPane server={tab.server} {active} />
          {:else}
            <ChatPane target={tab.target} {active} />
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

{#if startup.phase !== "ready"}
  <Splash />
{/if}

{#if startup.waitingForGameInstall}
  <div class="waiting" role="status">
    <p>{t("welcome:askGameInstall.waiting")}</p>
  </div>
{/if}

<DialogHost />

<style>
  .app {
    display: flex;
    height: 100%;
  }
  .sidebar {
    flex: none;
    min-width: 0;
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .panes {
    flex: 1;
    min-height: 0;
  }
  .pane {
    height: 100%;
  }
  .waiting {
    position: fixed;
    inset: 0;
    z-index: 5;
    display: grid;
    place-items: center;
    background: var(--backdrop);
  }
  .waiting p {
    max-width: 420px;
    margin: 0;
    padding: 16px 20px;
    border-radius: 10px;
    background: var(--bg-raised);
    box-shadow: var(--shadow);
  }
</style>
