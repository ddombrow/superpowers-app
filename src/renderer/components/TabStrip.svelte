<script lang="ts">
  import { chatName } from "../lib/chat.svelte";
  import { t } from "../lib/i18n";
  import type { IconName } from "../lib/icons";
  import { tabs, type Tab } from "../lib/tabs.svelte";
  import Icon from "./Icon.svelte";

  function describe(tab: Tab): { icon: IconName; label: string; detail?: string } {
    switch (tab.kind) {
      case "home":
        return { icon: "home", label: t("home:title") };
      case "server-settings":
        return { icon: "serverSettings", label: t("server:settings.title") };
      case "server":
        return {
          icon: "server",
          label: tab.server.label,
          detail: tab.server.port !== "" ? `${tab.server.hostname}:${tab.server.port}` : tab.server.hostname
        };
      case "chat":
        return { icon: "chat", label: tab.target === "status" ? chatName() : tab.target };
    }
  }
</script>

<div class="strip" role="tablist">
  {#each tabs.list as tab (tab.id)}
    {@const { icon, label, detail } = describe(tab)}
    {@const active = tab.id === tabs.activeId}
    <div class="tab" class:active class:pinned={tab.kind === "home"}>
      <button
        type="button"
        class="select"
        role="tab"
        id="tab-{tab.id}"
        aria-selected={active}
        aria-controls="pane-{tab.id}"
        title={tab.kind === "home" ? label : undefined}
        onclick={() => tabs.activate(tab.id)}
        onauxclick={(event) => {
          if (event.button === 1) tabs.close(tab.id);
        }}
      >
        <Icon name={icon} />
        {#if tab.kind === "home"}
          <span class="visually-hidden">{label}</span>
        {:else}
          <span class="label">
            {#if detail}<span class="detail">{detail}</span>{/if}
            <span class="name">{label}</span>
          </span>
        {/if}
      </button>
      {#if tab.kind !== "home"}
        <button
          type="button"
          class="close"
          aria-label="{t('common:actions.close')} {label}"
          onclick={() => tabs.close(tab.id)}
        >
          <Icon name="close" size={10} />
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    padding: 6px 6px 0;
    background: var(--bg-sidebar);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tab {
    display: flex;
    align-items: center;
    flex: 0 1 200px;
    min-width: 0;
    height: 36px;
    margin-bottom: -1px;
    border: 1px solid transparent;
    border-bottom: 0;
    border-radius: var(--radius) var(--radius) 0 0;
    color: var(--fg-muted);
  }
  .tab.pinned {
    flex: none;
  }
  .tab:hover {
    background: var(--bg-hover);
  }
  .tab.active {
    background: var(--bg);
    border-color: var(--border);
    color: var(--fg);
  }
  .select {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 10px;
    border: 0;
    background: none;
    text-align: left;
  }
  .select:hover:not(:disabled) {
    background: none;
  }
  .label {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.15;
  }
  .name,
  .detail {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .detail {
    font-size: 11px;
    color: var(--fg-muted);
  }
  .close {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    margin-right: 6px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: none;
    opacity: 0.6;
  }
  .close:hover {
    opacity: 1;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
