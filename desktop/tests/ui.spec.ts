import { test, expect } from "@playwright/test";
test("browser preview is explicit and does not pretend to play audio", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your music. Your desktop." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore the preview" }).click();
  await expect(
    page.getByText("Interface preview · sample library · no audio"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open Night Drive", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Night Drive", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play Night Drive", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Playback is available in the Windows app",
  );
});
test("search, library filters and legal credits are reachable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the preview" }).click();
  await page.getByRole("searchbox").fill("velvet");
  await expect(
    page.getByRole("heading", { name: "Search results" }),
  ).toBeVisible();
  await expect(
    page.getByText("Velvet Hour", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Albums", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("complementary", { name: "Your library" })
      .getByText("Night Drive", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "About Spoti for PC" }).click();
  await expect(page.getByRole("dialog")).toContainText("Myspoti");
  await expect(page.getByRole("dialog")).toContainText("GPL-3.0");
});
test("connection failures offer retry and small windows do not overflow", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).spoti = {
      request: async (method: string) => {
        if (method === "session.status")
          return { connected: false, signedIn: false };
        throw new Error("Google Chrome is required for playback.");
      },
      subscribe: () => () => {},
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect to Spotify", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Google Chrome is required",
  );
  await expect(
    page.getByRole("button", { name: "Connect to Spotify", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 900, height: 650 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

async function signedIn(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.commands = [];
    w.emit = () => {};
    const details = {
      uri: "spotify:playlist:test",
      name: "Live-shaped playlist",
      owner: "Listener",
      images: [],
      trackCount: 2,
    };
    const track = {
      uri: "spotify:track:first",
      name: "First song",
      durationMs: 200000,
      artists: [{ name: "Artist" }],
      album: { name: "Album", images: [] },
    };
    w.spoti = {
      subscribe: (callback: any) => {
        w.emit = callback;
        return () => {};
      },
      request: async (method: string, args: any = {}) => {
        w.commands.push({ method, args });
        if (method === "session.status")
          return { connected: true, signedIn: true };
        if (method === "account") return { name: "Listener" };
        if (method === "home")
          return { greeting: "Hello, Listener", shelves: [] };
        if (method === "library")
          return {
            items: [{ ...details, kind: "PLAYLIST" }],
            nextOffset: null,
          };
        if (method === "playlist")
          return {
            details,
            tracks: {
              items: [
                {
                  ...track,
                  ...(args.offset
                    ? { uri: "spotify:track:second", name: "Second song" }
                    : {}),
                },
              ],
              total: 2,
              nextOffset: args.offset ? null : 1,
            },
          };
        if (method === "search") {
          await new Promise((r) =>
            setTimeout(r, args.query === "old" ? 800 : 20),
          );
          return {
            tracks: { items: [{ ...track, name: args.query }] },
            artists: { items: [] },
            albums: { items: [] },
            playlists: { items: [] },
          };
        }
        if (method === "player.volume") return 0.7;
        if (method === "library.contains") return false;
        if (method === "player.play") {
          w.emit({
            event: "player",
            value: {
              item: track,
              isPaused: false,
              isBuffering: false,
              positionMs: 0,
              timestampMs: Date.now(),
              speed: 1,
              shuffle: false,
              repeat: "OFF",
            },
          });
          return null;
        }
        return null;
      },
    };
  });
}
test("API-shaped playlists paginate and playback actions reach the desktop adapter", async ({
  page,
}) => {
  await signedIn(page);
  await page.goto("/");
  await page
    .getByRole("complementary", { name: "Your library" })
    .getByRole("button", { name: "Live-shaped playlist", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Live-shaped playlist" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load more songs" }).click();
  await expect(
    page.getByRole("button", { name: "Second song Artist", exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Load more songs" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Play Live-shaped playlist" }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(
    await page.evaluate(() =>
      (window as any).commands.some((c: any) => c.method === "player.pause"),
    ),
  ).toBe(true);
  await page.evaluate(() =>
    (window as any).emit({
      event: "session",
      value: { connected: false, signedIn: false },
    }),
  );
  await expect(
    page.getByRole("heading", { name: "Your music. Your desktop." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toHaveCount(0);
});
test("a slower old search cannot overwrite the current query", async ({
  page,
}) => {
  await signedIn(page);
  await page.goto("/");
  const search = page.getByRole("searchbox");
  await search.fill("old");
  await page.waitForTimeout(380);
  await search.fill("new");
  await expect(
    page.getByRole("button", { name: "new Artist", exact: false }),
  ).toBeVisible();
  await page.waitForTimeout(900);
  await expect(
    page.getByRole("button", { name: "old Artist", exact: false }),
  ).toHaveCount(0);
});
test("saving the previous song cannot mark the next song as liked", async ({
  page,
}) => {
  await signedIn(page);
  await page.goto("/");
  await page
    .getByRole("complementary", { name: "Your library" })
    .getByRole("button", { name: "Live-shaped playlist", exact: false })
    .click();
  await page.getByRole("button", { name: "Play Live-shaped playlist" }).click();
  await page.evaluate(() => {
    const w = window as any;
    const request = w.spoti.request;
    w.spoti.request = (method: string, args: any) =>
      method === "library.save"
        ? new Promise((resolve) => {
            w.finishSave = resolve;
          })
        : request(method, args);
  });
  await page.getByRole("button", { name: "Save to Liked Songs" }).click();
  await page.evaluate(() => {
    const w = window as any;
    w.emit({
      event: "player",
      value: {
        item: {
          uri: "spotify:track:second",
          name: "Second song",
          artists: [],
          durationMs: 180000,
        },
        isPaused: false,
        positionMs: 0,
        timestampMs: Date.now(),
        speed: 1,
        repeat: "OFF",
      },
    });
  });
  await expect(
    page.getByRole("contentinfo", { name: "Music player" }),
  ).toContainText("Second song");
  await page.evaluate(() => (window as any).finishSave(null));
  await expect(
    page.getByRole("button", { name: "Save to Liked Songs" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Remove from Liked Songs" }),
  ).toHaveCount(0);
});
