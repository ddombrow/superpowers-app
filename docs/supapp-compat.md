# SupApp compatibility checklist (appApiVersion 5)

`SupApp` is injected into server/project webviews and must keep this exact surface.
Usage audited against superpowers-core v5.0.0, superpowers-game v5.0.0 and superpowers-love2d v4.0.0.

| Member                                                | Used by            | Notes                                                             |
| ----------------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| `writeFile(path, data, [options], cb)`                | core, game         | Must accept `Buffer`s created in other JS contexts (build window) |
| `mkdirp(path, cb)`                                    | core, game, love2d |                                                                   |
| `readDir(path, cb)`                                   | core, love2d       |                                                                   |
| `chooseFolder(cb)`                                    | core, love2d       | Grants per-origin read/write authorization                        |
| `chooseFile(access, cb)`                              | love2d             | `"readWrite" \| "execute"`                                        |
| `tryFileAccess(path, access, cb)`                     | love2d             |                                                                   |
| `mktmpdir(cb)`                                        | love2d             |                                                                   |
| `spawnChildProcess(file, args, cb)`                   | love2d             | Returns a live Node `ChildProcess`                                |
| `openWindow(url, options)`                            | core               | Returns a live `BrowserWindow`                                    |
| `getCurrentWindow()`                                  | core, game         | Live `BrowserWindow`                                              |
| `createMenu()` / `createMenuItem(opts)`               | core               | Live `Menu` / `MenuItem` (context menus, `popup`)                 |
| `onMessage(type, cb)` / `sendMessage(windowId, type)` | core               | Build window ↔ project window                                     |
| `showMainWindow()`                                    | core               |                                                                   |
| `openLink(url)` / `showItemInFolder(path)`            | core               |                                                                   |
| `clipboard.copyFromDataURL(dataURL)`                  | game               |                                                                   |

Live `BrowserWindow` members used: `id`, `close`, `destroy`, `focus`, `show`, `loadURL`, `on`,
`removeListener`, `setMenuBarVisibility`, `getContentSize`, `setContentSize`,
`webContents.send`, `webContents.addListener`, `webContents.toggleDevTools`.

Because live objects cross the API boundary, the SupApp preload runs with
`contextIsolation: false` and uses `@electron/remote`, enabled only for webview webContents.

## Security notes

- The launcher UI itself is sandboxed with context isolation; only SupApp pages get `@electron/remote`.
- Webviews may only load `http(s)` URLs, and always get this preload (enforced in `will-attach-webview`).
- `window.open` from any page opens the system browser instead of a new Electron window.
- File access is authorized per origin by the main process (`src/main/authorizations.ts`), with a
  per-page secret key on every request.
- Known gap, kept for compatibility: `readDir` doesn't check authorizations.
