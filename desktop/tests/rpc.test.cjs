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
test("reconnect waits for old playback processes and shutdown cancels startup", async () => {
  const { Playback } = require("../electron/playback.cjs");
  let release;
  const stopped = new Promise((resolve) => {
    release = resolve;
  });
  let chromeCalls = 0;
  const p = new Playback(
    { isPackaged: false, getPath: () => "/tmp/spoti-test" },
    () => {},
  );
  p.terminate = async () => stopped;
  p.findChrome = () => {
    chromeCalls++;
    return "/chrome";
  };
  const starting = p.connect();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(chromeCalls, 0, "Chrome must wait for prior termination");
  const stopping = p.stop();
  release();
  await assert.rejects(starting, /cancelled/);
  await stopping;
  assert.equal(chromeCalls, 0, "A stopped startup must never spawn Chrome");
});
test("Windows termination waits for taskkill completion for the owned Chrome PID", async () => {
  const { Playback } = require("../electron/playback.cjs");
  const p = new Playback(
    { isPackaged: false, getPath: () => "/tmp/spoti-test" },
    () => {},
  );
  p.platform = "win32";
  const chrome = child();
  chrome.pid = 12345;
  chrome.exitCode = null;
  chrome.signalCode = null;
  p.chrome = chrome;
  const killer = new EventEmitter();
  let called;
  p.spawn = (command, args) => {
    called = { command, args };
    return killer;
  };
  let finished = false;
  const closing = p.terminate().then(() => {
    finished = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finished, false);
  assert.deepEqual(called, {
    command: "taskkill",
    args: ["/PID", "12345", "/T", "/F"],
  });
  killer.emit("exit", 0);
  await closing;
  assert.equal(finished, true);
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
