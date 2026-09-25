<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { appInfo } from "../lib/api";
  import { splashFadeDuration, startup } from "../lib/startup.svelte";
  import logoURL from "../assets/images/superpowers-256.png";
</script>

<div class="splash" out:fade={{ duration: splashFadeDuration }} aria-busy="true">
  <div class="content" in:fly={{ y: -200, duration: 500 }}>
    <img src={logoURL} alt="Superpowers" width="256" height="256" />
    <p class="status" role="status">{startup.status}</p>
    {#if startup.progress != null}
      <progress value={startup.progress.value ?? undefined} max={startup.progress.max}></progress>
    {/if}
  </div>
  <span class="version">{appInfo.appVersion}</span>
</div>

<style>
  .splash {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-sidebar);
  }
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  img {
    max-width: 60vw;
    max-height: 50vh;
    height: auto;
  }
  .status {
    margin: 0;
    font-size: 22px;
  }
  progress {
    width: 320px;
  }
  .version {
    position: absolute;
    right: 12px;
    bottom: 8px;
    color: var(--fg-muted);
  }
</style>
