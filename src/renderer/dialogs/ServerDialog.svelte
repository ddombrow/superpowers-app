<script lang="ts">
  import type { ServerEntry } from "../../shared/types";
  import Modal from "../components/Modal.svelte";
  import type { DialogProps } from "../lib/dialogs.svelte";
  import { t } from "../lib/i18n";

  type Entry = Omit<ServerEntry, "id">;

  let {
    title,
    confirmLabel,
    initial,
    close
  }: DialogProps<Entry> & { title: string; confirmLabel: string; initial: Entry } = $props();

  // svelte-ignore state_referenced_locally
  let entry = $state<Entry>({ ...initial });
</script>

<Modal
  {title}
  onsubmit={() =>
    close({ ...entry, hostname: entry.hostname.trim(), label: entry.label.trim() || entry.hostname.trim() })}
  oncancel={() => close(null)}
>
  <div class="row">
    <label class="grow">
      <span>{t("common:server.hostname")}</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        bind:value={entry.hostname}
        placeholder={t("common:server.hostnamePlaceholder")}
        required
        autofocus
      />
    </label>
    <label class="port">
      <span>{t("common:server.port")}</span>
      <input type="text" inputmode="numeric" pattern={"[0-9]{1,5}"} bind:value={entry.port} placeholder="4237" />
    </label>
  </div>
  <label>
    <span>{t("common:server.label")}</span>
    <input type="text" bind:value={entry.label} placeholder={t("common:server.labelPlaceholder")} />
  </label>
  <label>
    <span>{t("common:server.password")}</span>
    <input type="password" bind:value={entry.password} autocomplete="off" />
  </label>

  {#snippet buttons()}
    <button type="button" onclick={() => close(null)}>{t("common:actions.cancel")}</button>
    <button type="submit" class="primary">{confirmLabel}</button>
  {/snippet}
</Modal>

<style>
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  label span {
    font-size: 12px;
    color: var(--fg-muted);
  }
  .row {
    display: flex;
    gap: var(--gap);
  }
  .grow {
    flex: 1;
  }
  .port input {
    width: 80px;
  }
</style>
