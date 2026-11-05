const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { RpcClient } = require("./rpc.cjs");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function findChrome() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(
            process.env.PROGRAMFILES || "C:\\Program Files",
            "Google/Chrome/Application/chrome.exe",
          ),
          path.join(
            process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
            "Google/Chrome/Application/chrome.exe",
          ),
          path.join(
            process.env.LOCALAPPDATA || "",
            "Google/Chrome/Application/chrome.exe",
          ),
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/opt/google/chrome/chrome",
        ];
  return candidates.find(existsSync);
}
async function loadDeviceId(profile) {
  const file = path.join(profile, "device-id");
  try {
    const id = (await fs.readFile(file, "utf8")).trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new Error("The playback device identity is invalid.");
    return id;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const id = require("node:crypto").randomUUID();
    await fs.writeFile(file, id, { mode: 0o600, flag: "wx" });
    return id;
  }
}
class Playback {
  constructor(app, emit) {
    this.app = app;
    this.emit = emit;
    this.status = { connected: false, signedIn: false };
    this.generation = 0;
    this.findChrome = findChrome;
    this.spawn = spawn;
    this.platform = process.platform;
  }
  async connect() {
    if (this.connecting) return this.connecting;
    const generation = ++this.generation;
    this.connecting = this.start(generation).finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }
  async start(generation) {
    const check = () => {
      if (generation !== this.generation)
        throw new Error("Playback startup cancelled.");
    };
    await this.terminate();
    check();
    const chromePath = this.findChrome();
    if (!chromePath)
      throw new Error(
        "Google Chrome is required for playback. Install Chrome, then try again.",
      );
    const profile = path.join(this.app.getPath("userData"), "playback-profile");
    await fs.mkdir(profile, { recursive: true });
    check();
    const deviceId = await loadDeviceId(profile);
    check();
    const portFile = path.join(profile, "DevToolsActivePort");
    await fs.rm(portFile, { force: true });
    check();
    const chrome = this.spawn(
      chromePath,
      [
        `--user-data-dir=${profile}`,
        "--remote-debugging-port=0",
        "--remote-debugging-address=127.0.0.1",
        "--no-first-run",
        "--no-default-browser-check",
        "--app=https://open.spotify.com/",
      ],
      { stdio: "ignore" },
    );
    this.chrome = chrome;
    let failed = false;
    chrome.once("error", () => {
      failed = true;
    });
    chrome.once("exit", () => {
      failed = true;
      if (this.chrome === chrome) {
        this.rpc?.close();
        this.backend?.kill();
        this.update({
          connected: false,
          signedIn: false,
          error: "The playback window closed. Reconnect to continue.",
        });
      }
    });
    try {
      let port;
      for (let n = 0; n < 100; n++) {
        check();
        if (failed)
          throw new Error(
            "Chrome could not start. Close any old Spoti playback windows and try again.",
          );
        try {
          const contents = await fs.readFile(portFile, "utf8");
          port = Number(contents.split("\n")[0]);
          if (port > 0 && port < 65536) break;
        } catch {}
        await sleep(200);
      }
      check();
      if (failed)
        throw new Error("The Chrome playback window closed during startup.");
      if (!port)
        throw new Error(
          "Chrome did not become ready. Close its playback window and reconnect.",
        );
      const root = this.app.isPackaged
        ? process.resourcesPath
        : path.resolve(__dirname, "../..");
      const lib = this.app.isPackaged
        ? path.join(root, "backend/lib")
        : path.join(
            root,
            "base/desktop-server/build/install/desktop-server/lib",
          );
      if (!existsSync(lib))
        throw new Error(
          "Playback backend is missing. Run npm run backend:build first.",
        );
      const java = this.app.isPackaged
        ? path.join(root, "runtime/bin/java.exe")
        : process.env.JAVA_HOME
          ? path.join(
              process.env.JAVA_HOME,
              "bin",
              process.platform === "win32" ? "java.exe" : "java",
            )
          : "java";
      const backend = this.spawn(
        java,
        [
          "-cp",
          path.join(lib, "*"),
          "app.myspoti.desktop.MainKt",
          `http://127.0.0.1:${port}`,
          deviceId,
        ],
        { stdio: ["pipe", "pipe", "ignore"], windowsHide: true },
      );
      this.backend = backend;
      const rpc = new RpcClient(backend);
      this.rpc = rpc;
      rpc.on("event", (message) => {
        if (this.rpc !== rpc) return;
        if (message.event === "session") this.status = message.value;
        this.emit(message);
      });
      this.update({ connected: false, signedIn: false, connecting: true });
      return this.status;
    } catch (e) {
      if (generation === this.generation) await this.terminate();
      throw e;
    }
  }
  update(value) {
    this.status = value;
    this.emit({ event: "session", value });
  }
  request(method, args) {
    if (method === "session.status") return Promise.resolve(this.status);
    if (!this.rpc)
      return Promise.reject(new Error("Connect to Spotify first."));
    return this.rpc.request(method, args);
  }
  async stop() {
    ++this.generation;
    const pending = this.connecting;
    await this.terminate();
    if (pending) await pending.catch(() => {});
    this.status = { connected: false, signedIn: false };
  }
  async terminate() {
    const rpc = this.rpc;
    this.rpc = null;
    rpc?.close();
    const backend = this.backend;
    this.backend = null;
    const chrome = this.chrome;
    this.chrome = null;
    const terminateChild = (child) =>
      new Promise((resolve) => {
        if (!child || child.exitCode !== null || child.signalCode) {
          resolve();
          return;
        }
        const timer = setTimeout(resolve, 5000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
        child.once("error", () => {
          clearTimeout(timer);
          resolve();
        });
        child.kill();
      });
    const jobs = [terminateChild(backend)];
    if (chrome?.pid && chrome.exitCode === null && !chrome.signalCode) {
      if (this.platform === "win32")
        jobs.push(
          new Promise((resolve, reject) => {
            const killer = this.spawn(
              "taskkill",
              ["/PID", String(chrome.pid), "/T", "/F"],
              { stdio: "ignore", windowsHide: true },
            );
            const timer = setTimeout(
              () =>
                reject(
                  new Error(
                    "Chrome is still closing. Close the playback window and try again.",
                  ),
                ),
              10000,
            );
            killer.once("exit", (code) => {
              clearTimeout(timer);
              if (code === 0 || chrome.exitCode !== null) resolve();
              else
                reject(
                  new Error(
                    "Could not close the previous playback window. Close it and reconnect.",
                  ),
                );
            });
            killer.once("error", () => {
              clearTimeout(timer);
              reject(
                new Error("Could not close the previous playback window."),
              );
            });
          }),
        );
      else jobs.push(terminateChild(chrome));
    }
    await Promise.all(jobs);
  }
}
module.exports = { Playback, findChrome, loadDeviceId };
