const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Playback } = require("./playback.cjs");
const { COMMANDS } = require("./rpc.cjs");
let window;
const playback = new Playback(app, (message) => {
  if (window && !window.isDestroyed())
    window.webContents.send("spoti:event", message);
});
const links = {
  source: "https://github.com/Peter3324w/Spoti-for-pc",
  upstream: "https://github.com/kota-zo/myspoti",
  chrome: "https://www.google.com/chrome/",
};
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    const entry = path.join(__dirname, "../dist/index.html");
    const entryUrl = pathToFileURL(entry).href;
    window = new BrowserWindow({
      width: 1440,
      height: 940,
      minWidth: 900,
      minHeight: 620,
      title: "Spoti for PC",
      backgroundColor: "#000000",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    window.webContents.session.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      if (url !== entryUrl) event.preventDefault();
    });
    ipcMain.handle("spoti:request", async (event, method, args) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== entryUrl
      )
        throw new Error("Untrusted sender");
      if (method === "desktop.connect") return playback.connect();
      if (method === "desktop.link") {
        if (!Object.hasOwn(links, args?.name)) throw new Error("Unknown link");
        await shell.openExternal(links[args.name]);
        return null;
      }
      if (!COMMANDS.has(method)) throw new Error("Unsupported command");
      return playback.request(method, args);
    });
    window.loadFile(entry);
  });
  let stopped = false;
  app.on("before-quit", (event) => {
    if (stopped) return;
    event.preventDefault();
    playback
      .stop()
      .catch(() => {})
      .finally(() => {
        stopped = true;
        app.quit();
      });
  });
  app.on("window-all-closed", () => app.quit());
}
