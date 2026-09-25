import type { Component } from "svelte";
import { t } from "./i18n";

export interface DialogProps<Result> {
  /** Closes the dialog with a result; `null` means cancelled */
  close: (result: Result | null) => void;
}

interface OpenDialog {
  id: number;
  component: Component<DialogProps<unknown> & Record<string, unknown>>;
  props: Record<string, unknown>;
  resolve: (result: unknown) => void;
}

let nextId = 0;
export const openDialogs = $state<OpenDialog[]>([]);

/** Shows a dialog component, resolving with its result (or null when cancelled) */
export function openDialog<Result, Props extends Record<string, unknown>>(
  component: Component<DialogProps<Result> & Props>,
  props: Props
): Promise<Result | null> {
  return new Promise((resolve) => {
    openDialogs.push({
      id: nextId++,
      component: component as unknown as OpenDialog["component"],
      props,
      resolve: resolve as (result: unknown) => void
    });
  });
}

export function closeDialog(id: number, result: unknown) {
  const index = openDialogs.findIndex((dialog) => dialog.id === id);
  if (index === -1) return;
  const [dialog] = openDialogs.splice(index, 1);
  dialog.resolve(result);
}

// Built-in message dialogs, rendered by components/DialogHost.svelte

export interface MessageOptions {
  kind: "info" | "confirm" | "prompt";
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  initialValue?: string;
  pattern?: string;
}

export const messageDialogs = $state<(MessageOptions & { id: number; resolve: (result: unknown) => void })[]>([]);

function showMessage<Result>(options: MessageOptions): Promise<Result> {
  return new Promise((resolve) => {
    messageDialogs.push({ ...options, id: nextId++, resolve: resolve as (result: unknown) => void });
  });
}

export function closeMessage(id: number, result: unknown) {
  const index = messageDialogs.findIndex((dialog) => dialog.id === id);
  if (index === -1) return;
  const [dialog] = messageDialogs.splice(index, 1);
  dialog.resolve(result);
}

export function info(message: string, options: { title?: string; confirmLabel?: string } = {}) {
  return showMessage<void>({ kind: "info", message, confirmLabel: t("common:actions.close"), ...options });
}

export function confirm(
  message: string,
  options: { title?: string; confirmLabel?: string; cancelLabel?: string } = {}
) {
  return showMessage<boolean>({
    kind: "confirm",
    message,
    confirmLabel: t("common:actions.ok"),
    cancelLabel: t("common:actions.cancel"),
    ...options
  });
}

export function prompt(
  message: string,
  options: { title?: string; confirmLabel?: string; initialValue?: string; pattern?: string } = {}
) {
  return showMessage<string | null>({
    kind: "prompt",
    message,
    confirmLabel: t("common:actions.ok"),
    cancelLabel: t("common:actions.cancel"),
    ...options
  });
}
