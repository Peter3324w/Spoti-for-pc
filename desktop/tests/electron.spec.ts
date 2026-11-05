import { test, expect, _electron as electron } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

test("packaged renderer can call the real isolated desktop IPC", async () => {
  test.skip(
    process.platform !== "win32",
    "The native desktop smoke check runs on the Windows build runner.",
  );
  test.setTimeout(90000);
  console.log("Native smoke: launching Electron");
  const app = await electron.launch({
    timeout: 60000,
    // Playwright quotes Windows args through cmd.exe; a trailing backslash escapes its closing quote.
    args: [resolve(fileURLToPath(new URL("../", import.meta.url)))],
  });
  console.log("Native smoke: Electron launch resolved");
  try {
    const page = await app.firstWindow();
    console.log("Native smoke: first window found");
    await expect(
      page.getByRole("heading", { name: "Your music. Your desktop." }),
    ).toBeVisible();
    console.log("Native smoke: renderer visible, checking IPC");
    const session = await page.evaluate(async () => {
      const client = (window as any).spoti;
      if (!client) throw new Error("Desktop preload was not installed");
      return client.request("session.status");
    });
    console.log("Native smoke: IPC responded");
    expect(session).toMatchObject({ connected: false, signedIn: false });
    await expect(
      page.getByRole("button", { name: "Explore the preview" }),
    ).toHaveCount(0);
  } finally {
    console.log("Native smoke: closing Electron");
    await app.close();
    console.log("Native smoke: Electron closed");
  }
});
