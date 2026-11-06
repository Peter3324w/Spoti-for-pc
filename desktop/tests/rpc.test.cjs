const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const { RpcClient } = require("../electron/rpc.cjs");
function child() {
  const c = new EventEmitter();
  c.stdout = new PassThrough();
  c.stdin = new PassThrough();
  return c;
}
test("out of order replies resolve the right requests and events stay separate", async () => {
  const c = child();
  const rpc = new RpcClient(c, 500);
  const events = [];
  rpc.on("event", (e) => events.push(e));
  const a = rpc.request("account");
  const b = rpc.request("home");
  c.stdout.write(
    '{"id":2,"ok":true,"value":"home"}\n{"event":"player","value":null}\n{"id":1,"ok":true,"value":"account"}\n',
  );
  assert.equal(await a, "account");
  assert.equal(await b, "home");
  assert.equal(events[0].event, "player");
  rpc.close();
});
test("process failure rejects pending commands immediately", async () => {
  const c = child();
  const rpc = new RpcClient(c, 500);
  const p = rpc.request("home");
  c.emit("exit", 1);
  await assert.rejects(p, /stopped/);
  rpc.close();
});
test("commands time out and invalid methods never reach the backend", async () => {
  const c = child();
  const rpc = new RpcClient(c, 20);
  await assert.rejects(rpc.request("raw.request"), /Unsupported/);
  await assert.rejects(rpc.request("home"), /timed out/);
  rpc.close();
});
test("shutdown cancels embedded startup before a playback page is created", async () => {
  const { Playback } = require("../electron/playback.cjs");
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  let pages = 0;
  const p = new Playback({isPackaged:false, getPath:()=>"/tmp/spoti-test"}, () => {}, {
    components: {whenReady: () => ready},
    createPage: async () => { pages++; },
  });
  const starting = p.connect();
  await new Promise(resolve => setImmediate(resolve));
  const stopping = p.stop();
  release();
  await assert.rejects(starting, /cancelled/);
  await stopping;
  assert.equal(pages, 0);
});
test("stock Electron fails clearly instead of opening an external browser", async () => {
  const { Playback } = require("../electron/playback.cjs");
  const p = new Playback({isPackaged:false}, () => {}, {createPage: async () => { throw Error("must not open"); }});
  await assert.rejects(p.connect(), /DRM-capable/);
});
test("playback device identity stays stable across launches", async () => {
  const fs = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const { loadDeviceId } = require("../electron/playback.cjs");
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "spoti-device-"));
  try {
    const first = await loadDeviceId(profile);
    assert.match(first, /^[0-9a-f-]{36}$/i);
    assert.equal(await loadDeviceId(profile), first);
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test("embedded playback relays private evaluations, dismisses login and owns only its JVM", async () => {
  const fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path");
  const { Playback } = require("../electron/playback.cjs");
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "spoti-embedded-"));
  const backend = child();
  backend.exitCode = null;
  backend.kill = () => { backend.exitCode = 0; backend.emit("exit", 0); };
  let callbacks, closed = false, visible, evaluated;
  const events = [], commands = [], writes = [];
  backend.stdin.on("data", bytes => writes.push(JSON.parse(bytes.toString())));
  const p = new Playback({isPackaged:false, getPath:()=>profile}, e => events.push(e), {
    components: {whenReady:async()=>{}},
    spawn: (command,args) => { commands.push({command,args}); return backend; },
    createPage: async cb => { callbacks = cb; return {
      load: async()=>{}, evaluate:async script=>{evaluated=script;},
      setLoginVisible: value=>{visible=value;}, close:async()=>{closed=true;},
    }; },
  });
  try {
    await p.connect();
    assert.equal(visible, true);
    assert.equal(commands.length, 1);
    assert.equal(commands[0].args.at(-2), "--embedded");
    backend.stdout.write('{"event":"host.evaluate","id":7,"script":"play()"}\n');
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(evaluated, "play()");
    assert.deepEqual(writes.at(-1), {host:"result",id:7,ok:true});
    assert.equal(events.some(e=>e.event==="host.evaluate"), false);
    callbacks.message('{"type":"ready"}');
    assert.deepEqual(writes.at(-1), {host:"message",payload:'{"type":"ready"}'});
    backend.stdout.write('{"event":"session","value":{"connected":true,"signedIn":true}}\n');
    assert.equal(visible, false);
    callbacks.lifecycle("failed");
    backend.stdout.write('{"event":"session","value":{"connected":false,"signedIn":false,"error":null}}\n');
    assert.match(p.status.error, /could not load/);
    await p.stop();
    assert.equal(closed, true);
    assert.equal(backend.exitCode, 0);
  } finally { await p.stop(); await fs.rm(profile,{recursive:true,force:true}); }
});

test("shutdown does not wait for an unfinished DRM component download", async () => {
  const {Playback} = require("../electron/playback.cjs");
  const p = new Playback({isPackaged:false},()=>{}, {components:{whenReady:()=>new Promise(()=>{})},createPage:async()=>{}});
  const starting = p.connect();
  const rejected = assert.rejects(starting,/cancelled/);
  await new Promise(resolve=>setImmediate(resolve));
  await Promise.race([p.stop(),new Promise((_,reject)=>setTimeout(()=>reject(Error("shutdown hung")),200))]);
  await rejected;
});
