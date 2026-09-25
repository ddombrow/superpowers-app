<script lang="ts">
  import Modal from "../components/Modal.svelte";
  import { nicknamePatternString } from "../lib/chatFormat";
  import type { DialogProps } from "../lib/dialogs.svelte";
  import { t } from "../lib/i18n";
  import type { WelcomeResult } from "../lib/startup.svelte";

  let { close }: DialogProps<WelcomeResult> = $props();

  let nickname = $state("");
  let connectToChat = $state(true);
</script>

<Modal title={t("welcome:title")} onsubmit={() => close({ nickname, connectToChat })} oncancel={() => close(null)}>
  <p>{t("welcome:prompt")}</p>
  <label class="nickname">
    <span>{t("welcome:nickname")}</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      type="text"
      bind:value={nickname}
      placeholder={t("welcome:nickname")}
      pattern={nicknamePatternString}
      maxlength="16"
      title={t("welcome:nicknameRules")}
      required
      autofocus
    />
  </label>
  <label class="checkbox">
    <input type="checkbox" bind:checked={connectToChat} />
    {t("welcome:connectToChat")}
  </label>

  {#snippet buttons()}
    <button type="submit" class="primary">{t("welcome:getStarted")}</button>
  {/snippet}
</Modal>

<style>
  p {
    margin: 0;
  }
  .nickname {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .nickname span {
    font-size: 12px;
    color: var(--fg-muted);
  }
  .checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
