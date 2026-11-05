import { test, expect, _electron as electron } from "@playwright/test";
import { fileURLToPath } from "node:url";

test("packaged renderer can call the real isolated desktop IPC", async () => {
  test.skip(
    process.platform !== "win32",
    "The native desktop smoke check runs on the Windows build runner.",
  );
  const app = await electron.launch({
    args: [fileURLToPath(new URL("../", import.meta.url))],
  });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Your music. Your desktop." }),
    ).toBeVisible();
    const session = await page.evaluate(async () => {
      const client = (window as any).spoti;
      if (!client) throw new Error("Desktop preload was not installed");
      return client.request("session.status");
    });
    expect(session).toMatchObject({ connected: false, signedIn: false });
    await expect(
      page.getByRole("button", { name: "Explore the preview" }),
    ).toHaveCount(0);
  } finally {
    await app.close();
  }
});
