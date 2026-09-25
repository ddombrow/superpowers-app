<script lang="ts">
  import { closeDialog, closeMessage, messageDialogs, openDialogs } from "../lib/dialogs.svelte";
  import Modal from "./Modal.svelte";

  let promptValues = $state<Record<number, string>>({});
</script>

{#each openDialogs as dialog (dialog.id)}
  <dialog.component {...dialog.props} close={(result: unknown) => closeDialog(dialog.id, result)} />
{/each}

{#each messageDialogs as dialog (dialog.id)}
  {#if dialog.kind === "info"}
    <Modal title={dialog.title} onsubmit={() => closeMessage(dialog.id, undefined)}>
      <p>{dialog.message}</p>
      {#snippet buttons()}
        <button type="submit" class="primary">{dialog.confirmLabel}</button>
      {/snippet}
    </Modal>
  {:else if dialog.kind === "confirm"}
    <Modal
      title={dialog.title}
      onsubmit={() => closeMessage(dialog.id, true)}
      oncancel={() => closeMessage(dialog.id, false)}
    >
      <p>{dialog.message}</p>
      {#snippet buttons()}
        <button type="button" onclick={() => closeMessage(dialog.id, false)}>{dialog.cancelLabel}</button>
        <button type="submit" class="primary">{dialog.confirmLabel}</button>
      {/snippet}
    </Modal>
  {:else}
    <Modal
      title={dialog.title}
      onsubmit={() => closeMessage(dialog.id, promptValues[dialog.id] ?? dialog.initialValue ?? "")}
      oncancel={() => closeMessage(dialog.id, null)}
    >
      <label>
        <span>{dialog.message}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          value={dialog.initialValue ?? ""}
          oninput={(event) => (promptValues[dialog.id] = event.currentTarget.value)}
          pattern={dialog.pattern}
          required
          autofocus
        />
      </label>
      {#snippet buttons()}
        <button type="button" onclick={() => closeMessage(dialog.id, null)}>{dialog.cancelLabel}</button>
        <button type="submit" class="primary">{dialog.confirmLabel}</button>
      {/snippet}
    </Modal>
  {/if}
{/each}

<style>
  p {
    margin: 0;
    white-space: pre-line;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
