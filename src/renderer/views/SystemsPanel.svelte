<script lang="ts">
  import { api } from "../lib/api";
  import { t } from "../lib/i18n";
  import {
    getItem,
    getUpdatableItems,
    hasUpdate,
    itemId,
    parseItemId,
    refreshRegistry,
    registry,
    runRegistryAction,
    updateAll
  } from "../lib/registry.svelte";

  let selectedId = $state<string | null>(null);
  let expanded = $state<Record<string, boolean>>({});

  const selected = $derived.by(() => {
    if (selectedId == null || registry.data == null) return null;
    const path = parseItemId(selectedId);
    const item = getItem(registry.data, path);
    if (item == null) return null;
    const system = registry.data.systems[path.systemId];
    return { id: selectedId, path, item, systemInstalled: system.localVersion != null || system.isLocalDev };
  });

  const busy = $derived(Object.keys(registry.progress).length > 0);
  const canUpdateAll = $derived(registry.data != null && !busy && getUpdatableItems(registry.data).length > 0);

  function progressLabel(id: string) {
    if (!(id in registry.progress)) return null;
    const percent = registry.progress[id];
    return percent == null ? "…" : `${percent}%`;
  }
</script>

<section class="systems" aria-labelledby="systems-title">
  <header>
    <h2 id="systems-title">{t("server:systems.title")}</h2>
    <button type="button" disabled={registry.fetching || busy} onclick={refreshRegistry}>
      {t("common:actions.refresh")}
    </button>
    <button type="button" disabled={!canUpdateAll} onclick={updateAll}>{t("server:systems.updateAll")}</button>
  </header>

  <div class="content">
    <div class="tree-container">
      {#if registry.fetching}
        <p class="muted">{t("common:states.loading")}</p>
      {:else if registry.data == null}
        <p class="muted">{t("server:systems.couldNotFetch")}</p>
      {:else}
        <ul class="tree" role="tree" aria-labelledby="systems-title">
          {#each Object.entries(registry.data.systems) as [systemId, system] (systemId)}
            {@const isExpanded = expanded[systemId] ?? true}
            <li role="treeitem" aria-expanded={isExpanded} aria-selected={selectedId === systemId}>
              <div class="row" class:selected={selectedId === systemId}>
                <button
                  type="button"
                  class="twisty"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                  onclick={() => (expanded[systemId] = !isExpanded)}>{isExpanded ? "▾" : "▸"}</button
                >
                <button type="button" class="item" onclick={() => (selectedId = systemId)}>
                  <span class="name">{systemId}</span>
                  {#if system.localVersion != null || system.isLocalDev}<span class="badge"
                      >{t("server:systems.installedBadge")}</span
                    >{/if}
                  {#if hasUpdate(system)}<span class="badge update">{t("server:systems.updateBadge")}</span>{/if}
                  <span class="progress">{progressLabel(systemId) ?? ""}</span>
                </button>
              </div>

              {#if isExpanded}
                <ul role="group">
                  {#each Object.entries(system.plugins) as [authorName, plugins] (authorName)}
                    {@const authorKey = `${systemId}:${authorName}`}
                    {@const authorExpanded = expanded[authorKey] ?? false}
                    <li role="treeitem" aria-expanded={authorExpanded} aria-selected="false">
                      <div class="row">
                        <button
                          type="button"
                          class="twisty"
                          aria-label={authorExpanded ? "Collapse" : "Expand"}
                          onclick={() => (expanded[authorKey] = !authorExpanded)}>{authorExpanded ? "▾" : "▸"}</button
                        >
                        <button type="button" class="item" onclick={() => (expanded[authorKey] = !authorExpanded)}>
                          <span class="name">{authorName}</span>
                          <span class="muted">({Object.keys(plugins).length})</span>
                        </button>
                      </div>
                      {#if authorExpanded}
                        <ul role="group">
                          {#each Object.entries(plugins) as [pluginName, plugin] (pluginName)}
                            {@const id = itemId({ systemId, authorName, pluginName })}
                            <li role="treeitem" aria-selected={selectedId === id}>
                              <div class="row leaf" class:selected={selectedId === id}>
                                <button type="button" class="item" onclick={() => (selectedId = id)}>
                                  <span class="name">{pluginName}</span>
                                  {#if hasUpdate(plugin)}<span class="badge update"
                                      >{t("server:systems.updateBadge")}</span
                                    >{/if}
                                  <span class="progress">{progressLabel(id) ?? ""}</span>
                                </button>
                              </div>
                            </li>
                          {/each}
                        </ul>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if selected != null}
      {@const { id, path, item, systemInstalled } = selected}
      {@const running = id in registry.progress}
      {@const installed = item.localVersion != null}
      <div class="details" aria-live="polite">
        <h3>{id}</h3>
        <dl>
          <dt>{t("server:systems.installed")}</dt>
          <dd>{item.isLocalDev ? "(dev)" : (item.localVersion ?? t("common:none"))}</dd>
          <dt>{t("server:systems.latest")}</dt>
          <dd>{item.version}</dd>
        </dl>
        <div class="actions">
          <button
            type="button"
            disabled={running || item.isLocalDev || (path.pluginName != null && !systemInstalled)}
            onclick={() => runRegistryAction(installed ? "uninstall" : "install", path)}
          >
            {installed ? t("common:actions.uninstall") : t("common:actions.install")}
          </button>
          <button
            type="button"
            disabled={running || !hasUpdate(item)}
            onclick={() => runRegistryAction("update", path)}
          >
            {t("common:actions.update")}
          </button>
          <button type="button" onclick={() => api.send("app:open-external", item.releaseNotesURL)}>
            {t("server:systems.releaseNotes")}
          </button>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .systems {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 280px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h2 {
    flex: 1;
    font-size: 16px;
  }
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }
  .tree-container {
    flex: 1;
    min-height: 160px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    overflow-y: auto;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  ul ul {
    padding-left: 18px;
  }
  .row {
    display: flex;
    align-items: center;
    border-radius: 4px;
  }
  .row.leaf {
    padding-left: 22px;
  }
  .row:hover {
    background: var(--bg-hover);
  }
  .row.selected {
    background: var(--bg-selected);
  }
  .row button {
    border: 0;
    background: none;
  }
  .twisty {
    width: 22px;
    padding: 2px 0;
    color: var(--fg-muted);
  }
  .item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 4px 6px 4px 0;
    text-align: left;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .badge {
    padding: 0 6px;
    border-radius: 8px;
    font-size: 11px;
    background: var(--bg-sunken);
    color: var(--fg-muted);
  }
  .badge.update {
    background: var(--accent);
    color: var(--accent-fg);
  }
  .progress {
    margin-left: auto;
    font-size: 12px;
    color: var(--fg-muted);
  }
  .muted {
    color: var(--fg-muted);
  }
  .details {
    flex: none;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  h3 {
    font-size: 15px;
    word-break: break-all;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 10px;
    margin: 10px 0;
  }
  dt {
    color: var(--fg-muted);
  }
  dd {
    margin: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
