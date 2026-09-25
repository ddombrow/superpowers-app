import { Menu, type BrowserWindow } from "electron";

/** `isMainWindow` tells the launcher window apart from project & build windows */
export function setup(app: Electron.App, isMainWindow: (window: BrowserWindow) => boolean) {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
    return;
  }

  const name = app.getName();
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: name,
      submenu: [
        {
          label: "About " + name,
          role: "about"
        },
        {
          type: "separator"
        },
        {
          label: "Services",
          role: "services",
          submenu: []
        },
        {
          type: "separator"
        },
        {
          label: "Hide " + name,
          accelerator: "Command+H",
          role: "hide"
        },
        {
          label: "Hide Others",
          accelerator: "Command+Alt+H",
          role: "hideothers"
        },
        {
          label: "Show All",
          role: "unhide"
        },
        {
          type: "separator"
        },
        {
          label: "Quit",
          accelerator: "Command+Q",
          click() {
            app.quit();
          }
        }
      ] as Electron.MenuItemConstructorOptions[]
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          role: "undo"
        },
        {
          label: "Redo",
          accelerator: "Shift+CmdOrCtrl+Z",
          role: "redo"
        },
        {
          type: "separator"
        },
        {
          label: "Cut",
          accelerator: "CmdOrCtrl+X",
          role: "cut"
        },
        {
          label: "Copy",
          accelerator: "CmdOrCtrl+C",
          role: "copy"
        },
        {
          label: "Paste",
          accelerator: "CmdOrCtrl+V",
          role: "paste"
        },
        {
          label: "Select All",
          accelerator: "CmdOrCtrl+A",
          role: "selectall"
        }
      ] as Electron.MenuItemConstructorOptions[]
    },
    {
      label: "Window",
      role: "window",
      submenu: [
        {
          label: "Minimize",
          accelerator: "CmdOrCtrl+M",
          role: "minimize"
        },
        {
          // Like in browsers: closes the active tab of the launcher, or other windows
          id: "close-tab",
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: (_item, window) => {
            if (window == null) return;
            if (isMainWindow(window as BrowserWindow)) (window as BrowserWindow).webContents.send("app:close-tab");
            else window.close();
          }
        },
        {
          type: "separator"
        },
        {
          label: "Bring All to Front",
          role: "front"
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
