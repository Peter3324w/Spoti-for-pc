const { EventEmitter } = require("node:events");
const { createInterface } = require("node:readline");
const COMMANDS = new Set([
  "session.status",
  "account",
  "home",
  "search",
  "library",
  "liked",
  "playlist",
  "album",
  "artist",
  "player.play",
  "player.pause",
  "player.resume",
  "player.next",
  "player.previous",
  "player.seek",
  "player.shuffle",
  "player.repeat",
  "player.volume",
  "queue",
  "library.contains",
  "library.save",
]);
class RpcClient extends EventEmitter {
  constructor(child, timeout = 45000) {
    super();
    this.child = child;
    this.timeout = timeout;
    this.pending = new Map();
    this.nextId = 0;
    this.stopped = false;
    this.lines = createInterface({ input: child.stdout });
    this.lines.on("line", (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (message.event) {
        this.emit("event", message);
        return;
      }
      const item = this.pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer);
      this.pending.delete(message.id);
      if (message.ok) item.resolve(message.value);
      else item.reject(new Error(message.error || "Request failed"));
    });
    child.on("exit", () =>
      this.fail("Playback service stopped. Reconnect to continue."),
    );
    child.on("error", () =>
      this.fail(
        "Playback service could not start. Check the Java installation.",
      ),
    );
    child.stdin.on("error", () =>
      this.fail("Playback service stopped. Reconnect to continue."),
    );
  }
  fail(message) {
    this.stopped = true;
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error(message));
    }
    this.pending.clear();
    this.emit("event", {
      event: "session",
      value: { connected: false, signedIn: false, error: message },
    });
  }
  request(method, args = {}) {
    if (!COMMANDS.has(method))
      return Promise.reject(new Error("Unsupported command"));
    if (this.stopped)
      return Promise.reject(
        new Error("Playback service stopped. Reconnect to continue."),
      );
    if (!args || Array.isArray(args) || typeof args !== "object")
      return Promise.reject(new Error("Invalid arguments"));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Request timed out. Please try again."));
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, args }) + "\n");
    });
  }
  close() {
    this.lines.close();
    this.fail("Playback service stopped.");
  }
}
module.exports = { RpcClient, COMMANDS };
