import type { HTMLAttributes } from "svelte/elements";

// Electron's <webview> tag, see src/renderer/views/ServerPane.svelte
declare module "svelte/elements" {
  export interface SvelteHTMLElements {
    webview: HTMLAttributes<HTMLElement> & { src?: string; partition?: string };
  }
}
