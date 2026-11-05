const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const required = [
  path.resolve(root, "../base/desktop-server/build/install/desktop-server/lib"),
  path.join(root, "runtime/bin/java.exe"),
];
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(
      `Packaging input missing: ${file}\nBuild the backend and add a Windows Java runtime before packaging. See desktop/README.md.`,
    );
    process.exit(1);
  }
}
if (
  !fs
    .readdirSync(required[0])
    .some((name) => /^desktop-server.*\.jar$/.test(name))
) {
  console.error(
    "The desktop backend JAR is missing. Run npm run backend:build.",
  );
  process.exit(1);
}
