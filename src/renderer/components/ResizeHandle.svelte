<script lang="ts">
  interface Props {
    /** Which side of the resized panel the handle is on */
    side: "right" | "left" | "top";
    size: number;
    min: number;
    max: number;
    label: string;
  }

  let { side, size = $bindable(), min, max, label }: Props = $props();

  const vertical = $derived(side === "top");
  const clamp = (value: number) => Math.min(max, Math.max(min, value));

  function onpointerdown(event: PointerEvent) {
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const start = vertical ? event.clientY : event.clientX;
    const startSize = size;
    const direction = side === "right" ? 1 : -1;

    const onmove = (moveEvent: PointerEvent) => {
      const position = vertical ? moveEvent.clientY : moveEvent.clientX;
      size = clamp(startSize + (position - start) * direction);
    };
    const onup = () => {
      handle.removeEventListener("pointermove", onmove);
      handle.removeEventListener("pointerup", onup);
    };
    handle.addEventListener("pointermove", onmove);
    handle.addEventListener("pointerup", onup);
  }

  function onkeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 50 : 10;
    const grow = side === "right" ? "ArrowRight" : side === "left" ? "ArrowLeft" : "ArrowUp";
    const shrink = side === "right" ? "ArrowLeft" : side === "left" ? "ArrowRight" : "ArrowDown";
    if (event.key === grow) size = clamp(size + step);
    else if (event.key === shrink) size = clamp(size - step);
    else return;
    event.preventDefault();
  }
</script>

<!-- A focusable separator is the ARIA "window splitter" pattern, which the checker doesn't know about -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="handle"
  class:vertical
  role="separator"
  aria-label={label}
  aria-orientation={vertical ? "horizontal" : "vertical"}
  aria-valuenow={size}
  aria-valuemin={min}
  aria-valuemax={max}
  tabindex="0"
  {onpointerdown}
  {onkeydown}
></div>

<style>
  .handle {
    flex: none;
    width: 5px;
    margin: 0 -2px;
    z-index: 1;
    cursor: col-resize;
    position: relative;
  }
  .handle::after {
    content: "";
    position: absolute;
    inset: 0 2px;
    background: var(--border);
  }
  .handle:hover::after,
  .handle:focus-visible::after {
    inset: 0 1px;
    background: var(--accent);
  }
  .vertical {
    width: auto;
    height: 5px;
    margin: -2px 0;
    cursor: row-resize;
  }
  .vertical::after {
    inset: 2px 0;
  }
  .vertical:hover::after,
  .vertical:focus-visible::after {
    inset: 1px 0;
  }
</style>
