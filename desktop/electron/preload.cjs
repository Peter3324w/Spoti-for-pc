const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("spoti", {
  request: (method, args = {}) =>
    ipcRenderer.invoke("spoti:request", method, args),
  subscribe: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("spoti:event", listener);
    return () => ipcRenderer.removeListener("spoti:event", listener);
  },
});
