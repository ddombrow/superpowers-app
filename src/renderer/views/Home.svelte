<script lang="ts">
  import { homeChatrooms, homeLinks } from "../../shared/endpoints";
  import { api } from "../lib/api";
  import { joinChannel } from "../lib/chat.svelte";
  import { t } from "../lib/i18n";
  import coverURL from "../assets/images/cover.png";

  let news = $state<string | null | undefined>(undefined);
  $effect(() => {
    api.invoke("app:fetch-news").then((html) => (news = html));
  });
</script>

<div class="home">
  <main>
    <header class="logo" style="background-image: url({coverURL})">
      <h1>Superpowers</h1>
      <!-- Markup (<b>, &nbsp;) from the bundled locale files, never from the network -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <p class="tagline">{@html t("home:tagline")}</p>
    </header>

    <section class="news" aria-label={t("home:news.title")}>
      {#if news === undefined}
        <p class="muted">{t("common:states.loading")}</p>
      {:else if news === null}
        <p class="muted">{t("home:news.couldNotFetch")}</p>
      {:else}
        <!-- Remote HTML: shown in a sandboxed frame, with no scripts and no access to the app -->
        <iframe title={t("home:news.title")} sandbox="" srcdoc={news}></iframe>
      {/if}
    </section>
  </main>

  <aside>
    <section>
      <h2>{t("home:chatrooms.title")}</h2>
      <ul>
        {#each homeChatrooms as room (room.channel)}
          <li>
            <button type="button" class="link" onclick={() => joinChannel(room.channel)}
              >{t(`home:chatrooms.${room.key}`)}</button
            >
          </li>
        {/each}
      </ul>
    </section>
    <section>
      <h2>{t("home:links.title")}</h2>
      <ul>
        {#each homeLinks as link (link.url)}
          <li>
            <a
              href={link.url}
              onclick={(event) => {
                event.preventDefault();
                api.send("app:open-external", link.url);
              }}>{t(`home:links.${link.key}`)}</a
            >
          </li>
        {/each}
      </ul>
    </section>
  </aside>
</div>

<style>
  .home {
    display: flex;
    height: 100%;
  }
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-y: auto;
  }
  .logo {
    height: 320px;
    padding: 20px;
    text-align: center;
    background: center bottom / 540px no-repeat;
  }
  h1 {
    font: 700 64px/1.1 var(--font-display);
  }
  .tagline {
    margin: 4px 0 0;
    color: var(--fg-muted);
  }
  .news {
    flex: 1;
    display: flex;
    justify-content: center;
    padding: 24px;
  }
  .news iframe {
    width: 100%;
    max-width: 720px;
    min-height: 300px;
    border: 0;
    background: #fff;
    border-radius: var(--radius);
  }
  .muted {
    color: var(--fg-muted);
  }
  aside {
    width: 220px;
    padding: 20px 16px;
    border-left: 1px solid var(--border);
    background: var(--bg-sidebar);
    overflow-y: auto;
  }
  aside h2 {
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  aside section + section {
    margin-top: 20px;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    padding: 2px 0;
  }
</style>
