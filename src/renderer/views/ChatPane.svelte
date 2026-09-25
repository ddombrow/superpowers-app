<script lang="ts">
  import { tick } from "svelte";
  import ResizeHandle from "../components/ResizeHandle.svelte";
  import { api } from "../lib/api";
  import { chat, chatName, joinChannel, sendFromInput } from "../lib/chat.svelte";
  import { linkify, nicknameColor } from "../lib/chatFormat";

  let { target, active }: { target: string; active: boolean } = $props();

  const conversation = $derived(chat.get(target));
  const users = $derived(
    Object.entries(conversation?.users ?? {}).sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  );

  let input = $state("");
  let previousMessage = $state<string | null>(null);
  let usersWidth = $state(180);
  let logElement = $state<HTMLElement>();
  let inputElement = $state<HTMLTextAreaElement>();

  const title = $derived(target === "status" ? chatName() : target);
  const details = $derived(target === "status" ? "" : `on ${chatName()}`);
  const topic = $derived.by(() => {
    if (target === "status") return "Connection status";
    if (conversation == null || !conversation.isChannel) return "Private chat";
    if (conversation.waitingForTopic) return "(Waiting for topic...)";
    return conversation.topic ?? "(No topic)";
  });

  const modeSymbol = (mode: string) => (mode.includes("o") ? "@" : mode.includes("v") ? "+" : "");

  // Keep the log scrolled to the bottom as messages come in
  $effect(() => {
    void conversation?.log.at(-1)?.lines.length;
    void conversation?.log.length;
    void tick().then(() => {
      if (logElement != null) logElement.scrollTop = logElement.scrollHeight;
    });
  });

  $effect(() => {
    if (active) inputElement?.focus();
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.key === "Enter") {
      event.preventDefault();
      if (input.length === 0) return;
      sendFromInput(target, input);
      previousMessage = input;
      input = "";
    } else if (event.key === "ArrowUp" && input.length === 0 && previousMessage != null) {
      event.preventDefault();
      input = previousMessage;
    } else if (event.key === "Tab") {
      event.preventDefault();
      completeNickname();
    }
  }

  function completeNickname() {
    const element = inputElement!;
    const start = input.lastIndexOf(" ", element.selectionStart - 1) + 1;
    const stub = input.slice(start, element.selectionStart).toLowerCase();
    if (stub.length === 0) return;

    const matches = users.map(([nick]) => nick).filter((nick) => nick.toLowerCase().startsWith(stub));
    if (matches.length === 1) input = `${input.slice(0, start)}${matches[0]}${start === 0 ? ": " : " "}`;
    else if (matches.length > 1) chat.addInfo(target, `Matching users: ${matches.join(", ")}.`);
  }
</script>

{#snippet text(line: string)}
  {#each linkify(line) as segment, index (index)}
    {#if segment.type === "text"}{segment.text}{:else if segment.type === "link"}<a
        href={segment.url}
        onclick={(event) => {
          event.preventDefault();
          api.send("app:open-external", segment.url);
        }}>{segment.url}</a
      >{:else}<button type="button" class="link" onclick={() => joinChannel(segment.name)}>{segment.name}</button>{/if}
  {/each}
{/snippet}

<div class="chat">
  <div class="channel">
    <header>
      <div class="info">
        <h2>{title}</h2>
        {#if details}<span class="details">{details}</span>{/if}
      </div>
      <p class="topic" class:muted={conversation?.topic == null}>{topic}</p>
    </header>

    <div class="log" bind:this={logElement} role="log" aria-live="polite" aria-label={title}>
      {#each conversation?.log ?? [] as entry (entry.id)}
        {#if entry.kind === "info"}
          <div class="info-entry">
            {#each entry.lines as line, index (index)}<p>{@render text(line)}</p>{/each}
          </div>
        {:else}
          <div class="message {entry.style ?? ''}">
            <div class="avatar" style:background-color={nicknameColor(entry.from ?? "")} aria-hidden="true">
              {(entry.from ?? "").slice(0, 2)}
            </div>
            <div class="content">
              <div class="from">{entry.from}</div>
              {#each entry.lines as line, index (index)}<p>{@render text(line)}</p>{/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <div class="input">
      <textarea
        bind:this={inputElement}
        bind:value={input}
        {onkeydown}
        rows="1"
        aria-label="Message {title}"
        placeholder={chat.me == null ? "Not connected" : `Message ${title}`}></textarea>
    </div>
  </div>

  {#if conversation?.isChannel}
    <ResizeHandle side="left" bind:size={usersWidth} min={120} max={400} label="Users" />
    <aside class="users" style:width="{usersWidth}px" aria-label="Users in {target}">
      <ul>
        {#each users as [nick, mode] (nick)}
          <li><span class="mode">{modeSymbol(mode)}</span>{nick}</li>
        {/each}
      </ul>
    </aside>
  {/if}
</div>

<style>
  .chat {
    display: flex;
    height: 100%;
  }
  .channel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  header {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
  }
  .info {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  h2 {
    font-size: 17px;
  }
  .details,
  .muted {
    color: var(--fg-muted);
  }
  .topic {
    margin: 2px 0 0;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: text;
  }
  .log {
    flex: 1;
    padding: 8px 16px;
    overflow-y: auto;
    user-select: text;
  }
  p {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .info-entry {
    padding: 2px 0 2px 44px;
    font-size: 12px;
    color: var(--fg-muted);
  }
  .message {
    display: flex;
    gap: 10px;
    padding: 6px 0;
  }
  .message.me .from {
    color: var(--accent);
  }
  .message.notice p,
  .message.private.notice p {
    font-style: italic;
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
  }
  .content {
    min-width: 0;
  }
  .from {
    font-weight: 500;
  }
  .input {
    padding: 8px 16px 12px;
  }
  textarea {
    width: 100%;
    resize: none;
  }
  .users {
    flex: none;
    padding: 8px 12px;
    background: var(--bg-sidebar);
    overflow-y: auto;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    padding: 1px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mode {
    display: inline-block;
    width: 1em;
    color: var(--fg-muted);
  }
</style>
