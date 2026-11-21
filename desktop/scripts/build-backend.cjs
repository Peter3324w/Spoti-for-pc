const { spawnSync } = require("node:child_process");
const path = require("node:path");
const cwd = path.resolve(__dirname, "../backend");
const windows = process.platform === "win32";
const wrapper = path.join(cwd, windows ? "gradlew.bat" : "gradlew");
const command = windows ? "powershell.exe" : wrapper;
const args = windows
  ? [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `& '${wrapper.replaceAll("'", "''")}' ':desktop-server:installDist'; exit $LASTEXITCODE`,
    ]
  : [":desktop-server:installDist"];
const result = spawnSync(command, args, { cwd, stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
