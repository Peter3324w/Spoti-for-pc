const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { RpcClient } = require("./rpc.cjs");
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
  constructor(app, emit, {components, createPage, spawn: spawnProcess = spawn} = {}) {
    this.app = app;
    this.emit = emit;
    this.components = components;
    this.createPage = createPage;
    this.spawn = spawnProcess;
    this.status = { connected: false, signedIn: false };
    this.generation = 0;
  }
  async connect() {
    if (this.connecting) return this.connecting;
    const generation = ++this.generation;
    this.connecting = this.start(generation).finally(() => { this.connecting = null; });
    return this.connecting;
  }
  async start(generation) {
    const current = () => generation === this.generation;
    const check = () => { if (!current()) throw new Error("Playback startup cancelled."); };
    await this.terminate();
    check();
    try {
      if (!this.components || !this.createPage) throw new Error(
        "The DRM-capable playback runtime is required. Start Spoti with its Castlabs Electron runtime.",
      );
      this.playbackError = null;
      this.loginCompleted = false;
      this.update({connected:false, signedIn:false, connecting:true});
      let timer;
      try {
        await Promise.race([
          this.components.whenReady(),
          new Promise((_, reject) => { this.cancelStartup = () => reject(new Error("Playback startup cancelled.")); }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("The playback component took too long to load. Check your connection and reconnect.")), 120000); }),
        ]);
      } finally { clearTimeout(timer); this.cancelStartup = null; }
      check();
      const profile = path.join(this.app.getPath("userData"), "playback-profile");
      await fs.mkdir(profile, {recursive:true});
      const deviceId = await loadDeviceId(profile);
      check();
      const root = this.app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "../..");
      const lib = !this.app.isPackaged && process.env.SPOTI_BACKEND_LIB ? process.env.SPOTI_BACKEND_LIB : this.app.isPackaged ? path.join(root,"backend/lib")
        : path.join(root,"base/desktop-server/build/install/desktop-server/lib");
      if (!existsSync(lib)) throw new Error("Playback backend is missing. Run npm run backend:build first.");
      const page = await this.createPage({
        message: payload => { if (current()) this.sendHost({host:"message",payload}); },
        playbackError: failure => {
          if (!current() || failure.kind !== 'audio-license' || this.playbackError) return;
          this.playbackError = "Spotify could not authorize audio playback. Playback has stopped to prevent songs being skipped. The playback engine needs setup.";
          this.failPage(this.playbackError);
        },
        lifecycle: state => {
          if (!current()) return;
          if (state === "failed") {
            this.failPage();
          } else this.sendHost({host:state});
        },
      });
      if (!current()) { await page.close(); check(); }
      this.page = page;
      this.loginDismissed = false;
      const java = process.env.SPOTI_JAVA || (this.app.isPackaged
        ? path.join(root,"runtime/bin/java.exe")
        : process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME,"bin",process.platform === "win32" ? "java.exe" : "java") : "java");
      const backend = this.spawn(java,["-cp",path.join(lib,"*"),"app.myspoti.desktop.MainKt","--embedded",deviceId],
        {stdio:["pipe","pipe","ignore"],windowsHide:true});
      this.backend = backend;
      const rpc = new RpcClient(backend);
      this.rpc = rpc;
      rpc.on("event", message => {
        if (!current() || this.rpc !== rpc) return;
        if (message.event === "host.evaluate") {
          page.evaluate(message.script).then(
            () => { if (current() && this.rpc === rpc) this.sendHost({host:"result",id:message.id,ok:true}); },
            () => { if (current() && this.rpc === rpc) this.sendHost({host:"result",id:message.id,ok:false}); },
          );
          return;
        }
        if (message.event === "session") {
          if (message.value.signedIn) this.loginCompleted = true;
          const show = !this.loginCompleted && !this.loginDismissed && !message.value.error;
          page.setLoginVisible(show);
          this.update({...message.value, loginVisible:show, ...(this.playbackError ? {error:this.playbackError} : {})});
        } else this.emit(message);
      });
      page.setLoginVisible(true);
      this.update({connected:false,signedIn:false,connecting:true,loginVisible:true});
      page.load().catch(() => {
        if (current() && this.page === page) {
          this.failPage();
        }
      });
      return this.status;
    } catch (error) {
      if (current()) {
        await this.terminate();
        this.update({connected:false,signedIn:false,error:error.message});
      }
      throw error;
    }
  }
  failPage(error = "Spotify could not load. Check your connection and reconnect.") {
    ++this.generation; // Ignore every late bridge/lifecycle callback from this failed engine.
    this.update({connected:false,signedIn:false,loginVisible:false,error});
    this.terminate().catch(() => {});
  }
  sendHost(message) {
    if (this.backend && !this.backend.stdin.destroyed) this.backend.stdin.write(JSON.stringify(message) + "\n");
  }
  hideLogin() {
    this.loginDismissed = true;
    this.page?.setLoginVisible(false);
    this.update({...this.status, loginVisible:false});
    return this.status;
  }
  update(value) { this.status = value; this.emit({event:"session",value}); }
  request(method,args) {
    if (method === "session.status") return Promise.resolve(this.status);
    if (this.playbackError && ["player.play","player.resume","player.next","player.previous"].includes(method)) {
      return Promise.reject(new Error(this.playbackError));
    }
    if (!this.rpc) return Promise.reject(new Error("Connect to Spotify first."));
    return this.rpc.request(method,args).catch(error => {
      throw new Error(this.playbackError || error.message);
    });
  }
  async stop() {
    ++this.generation;
    this.cancelStartup?.();
    const pending = this.connecting;
    await this.terminate();
    if (pending) await pending.catch(() => {});
    this.status = {connected:false,signedIn:false};
  }
  async terminate() {
    const rpc = this.rpc; this.rpc = null; rpc?.close();
    const backend = this.backend; this.backend = null;
    const page = this.page; this.page = null;
    const jobs = [];
    if (page) jobs.push(page.close());
    if (backend && backend.exitCode === null && !backend.signalCode) jobs.push(new Promise(resolve => {
      const timer = setTimeout(resolve,5000);
      const done = () => {clearTimeout(timer);resolve();};
      backend.once("exit",done); backend.once("error",done); backend.kill();
    }));
    await Promise.all(jobs);
  }
}
module.exports = {Playback, loadDeviceId};
