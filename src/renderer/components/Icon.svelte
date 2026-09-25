<script lang="ts">
  import { iconStyle, type IconName } from "../lib/icons";

  let { name, size = 16 }: { name: IconName; size?: number } = $props();
</script>

<span class="icon" aria-hidden="true" style="{iconStyle(name)}; width: {size}px; height: {size}px"></span>
