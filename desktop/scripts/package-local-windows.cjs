// Packages the already-built renderer/backend with explicitly supplied cached Windows tools.
// No npm installation, runtime download, signing, or publishing is performed here.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");

async function checkBackend(java, libraries) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      java,
      [
        "-cp",
        path.join(libraries, "*"),
        "app.myspoti.desktop.MainKt",
        "http://127.0.0.1:1",
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let buffer = "",
      diagnostics = "",
      finished = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(
      () => finish(new Error("Bundled Java/backend smoke test timed out.")),
      15000,
    );
    child.on("error", finish);
    child.on("exit", () => {
      if (!finished)
        finish(
          new Error(
            `Bundled Java/backend exited before responding. ${diagnostics.slice(0, 1500)}`,
          ),
        );
    });
    child.stderr.on("data", (bytes) => {
      diagnostics += bytes.toString();
    });
    child.stdout.on("data", (bytes) => {
      buffer += bytes.toString("utf8");
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          const response = JSON.parse(line);
          if (response.id === 1) {
            if (response.ok && response.value?.signedIn === false) finish();
            else finish(new Error("Unexpected backend status response."));
          }
        } catch {}
      }
    });
    child.stdin.on("error", (error) => {
      if (!finished) finish(error);
    });
    child.stdin.write(
      JSON.stringify({ id: 1, method: "session.status", args: {} }) + "\n",
    );
  });
}

async function main() {
  if (process.platform !== "win32")
    throw new Error(
      "Run this helper with Windows Node.js. Build the renderer/backend first.",
    );
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2)
    args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
  for (const key of [
    "electron-dist",
    "runtime",
    "7zip-path",
    "nsis-dir",
    "nsis-resources-dir",
    "output-dir",
  ])
    if (!args[key]) throw new Error(`Missing --${key}`);
  const project = path.resolve(__dirname, "..");
  const original = JSON.parse(
    await fsp.readFile(path.join(project, "package.json"), "utf8"),
  );
  const runtime = path.resolve(args.runtime),
    electronDist = path.resolve(args["electron-dist"]);
  const sourceLibraries = path.resolve(
    project,
    "../base/desktop-server/build/install/desktop-server/lib",
  );
  const stage = await fsp.mkdtemp(path.join(os.tmpdir(), "spoti-local-build-"));
  const libraries = path.join(stage, "backend-lib");
  await fsp.cp(sourceLibraries, libraries, { recursive: true });
  console.log(`Local build folder: ${stage}`);
  for (const file of [
    path.join(project, "dist/index.html"),
    path.join(libraries, "desktop-server.jar"),
    path.join(runtime, "bin/java.exe"),
    path.join(electronDist, "electron.exe"),
    args["7zip-path"],
    path.join(args["nsis-dir"], "Bin/makensis.exe"),
  ])
    await fsp.access(file);
  const electronVersion = (
    await fsp.readFile(path.join(electronDist, "version"), "utf8")
  ).trim();
  console.log(
    `Checking the supplied Windows Java runtime and backend; cached Electron ${electronVersion}.`,
  );
  await checkBackend(path.join(runtime, "bin/java.exe"), libraries);
  console.log("Windows Java/backend IPC smoke passed.");

  // A missing packaging tool is an error, never permission to download it.
  const denyDownload = () => {
    throw new Error(
      "Offline local packaging: an uncached download was requested. Nothing was downloaded.",
    );
  };
  for (const name of ["node:http", "node:https"]) {
    const api = require(name);
    api.request = denyDownload;
    api.get = denyDownload;
  }
  globalThis.fetch = denyDownload;
  process.env.HTTP_PROXY = process.env.HTTPS_PROXY = "http://127.0.0.1:9";
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
  process.env.ELECTRON_BUILDER_7ZIP_PATH = path.resolve(args["7zip-path"]);
  process.env.ELECTRON_BUILDER_NSIS_DIR = path.resolve(args["nsis-dir"]);
  process.env.ELECTRON_BUILDER_NSIS_RESOURCES_DIR = path.resolve(
    args["nsis-resources-dir"],
  );

  for (const name of ["dist", "electron"])
    await fsp.cp(path.join(project, name), path.join(stage, name), {
      recursive: true,
    });
  const appPackage = {
    name: original.name,
    version: original.version,
    description: original.description,
    author: original.author,
    license: original.license,
    private: true,
    type: "module",
    main: original.main,
  };
  await fsp.writeFile(
    path.join(stage, "package.json"),
    JSON.stringify(appPackage, null, 2),
  );
  const config = {
    ...original.build,
    electronVersion,
    electronDist,
    npmRebuild: false,
    directories: { output: path.join(stage, "output") },
    win: { ...original.build.win, signAndEditExecutable: false },
    extraResources: original.build.extraResources.map((item) => ({
      ...item,
      from:
        item.from === "runtime"
          ? runtime
          : item.from.includes("desktop-server/build/install")
            ? libraries
            : path.resolve(project, item.from),
    })),
  };
  const { build, Platform, Arch } = require("electron-builder");
  const artifacts = await build({
    projectDir: stage,
    config,
    publish: "never",
    targets: Platform.WINDOWS.createTarget("nsis", Arch.x64),
  });
  const installer = artifacts.find(
    (file) => file.endsWith(".exe") && !file.includes("__uninstaller"),
  );
  if (!installer)
    throw new Error("The local build did not produce an installer.");
  const output = path.resolve(args["output-dir"]);
  await fsp.mkdir(output, { recursive: true });
  let destination = path.join(output, path.basename(installer));
  if (fs.existsSync(destination)) {
    const parsed = path.parse(destination);
    destination = path.join(
      parsed.dir,
      `${parsed.name} (local ${Date.now()})${parsed.ext}`,
    );
  }
  await fsp.copyFile(installer, destination, fs.constants.COPYFILE_EXCL);
  console.log(
    JSON.stringify({
      installer: destination,
      unpackedApp: path.join(stage, "output/win-unpacked/Spoti for PC.exe"),
      electronVersion,
      javaRuntime: runtime,
      bytes: (await fsp.stat(destination)).size,
    }),
  );
}
main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
