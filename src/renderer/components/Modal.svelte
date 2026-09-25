<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title?: string;
    /** Called when the form is submitted (Enter or the submit button) */
    onsubmit: () => void;
    /** Called on Escape; defaults to submitting, for dialogs that can't be cancelled */
    oncancel?: () => void;
    children: Snippet;
    buttons: Snippet;
    wide?: boolean;
  }

  let { title, onsubmit, oncancel, children, buttons, wide = false }: Props = $props();

  let dialog: HTMLDialogElement;
  const titleId = `dialog-title-${Math.random().toString(36).slice(2)}`;
  // Windows puts the confirm button first
  const isWindows = navigator.userAgent.includes("Windows");

  $effect(() => {
    dialog.showModal();
    return () => dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class:wide
  aria-labelledby={title != null ? titleId : undefined}
  oncancel={(event) => {
    event.preventDefault();
    (oncancel ?? onsubmit)();
  }}
>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      onsubmit();
    }}
  >
    {#if title != null}
      <h2 id={titleId}>{title}</h2>
    {/if}
    <div class="body">{@render children()}</div>
    <div class="buttons" class:windows={isWindows}>{@render buttons()}</div>
  </form>
</dialog>

<style>
  dialog {
    width: min(460px, calc(100vw - 32px));
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-raised);
    color: var(--fg);
    box-shadow: var(--shadow);
  }
  dialog.wide {
    width: min(560px, calc(100vw - 32px));
  }
  dialog::backdrop {
    background: var(--backdrop);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 20px 16px;
  }
  h2 {
    font-size: 17px;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    user-select: text;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap);
  }
  .buttons.windows {
    flex-direction: row-reverse;
    justify-content: flex-start;
  }
</style>
