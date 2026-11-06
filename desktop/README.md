# Spoti for PC

Windows interface for [Myspoti](https://github.com/kota-zo/myspoti), using its original Kotlin API and an embedded Spotify playback view. Modified November 5, 2026 by Peter Phiri. GPL-3.0; upstream copyright and third-party notices remain applicable.

## Browser preview

Requires Node.js 24 or later.

```
cd desktop
npm ci
npm run dev
```

Open http://localhost:5173 and choose **Explore the preview**. Sample artwork and fictional sample library are included solely for reviewing the interface. The preview cannot play audio or access an account.

## Windows development

Use Node.js 24, Java 17 or later, and the pinned **Castlabs Electron 45.2.1+wvcus** runtime. This runtime includes integration for Widevine protected audio. Stock Electron and Google Chrome are no longer used for desktop playback.

Install dependencies without triggering a second runtime download when an archive is already cached:

```
npm ci --ignore-scripts --allow-remote=root
```

For an ordinary Windows checkout with Windows dependencies installed:

```
npm run backend:build
npm start
```

`npm start` now starts a local Vite development preview and the desktop app; it does not build production assets. Set `SPOTI_ELECTRON_PATH` to the extracted Castlabs `electron.exe` when using a cached runtime. Set `SPOTI_JAVA` if Java is not on PATH. The launcher also recognizes the shared runtime cache under `%USERPROFILE%\.codex\cache\spoti-playback\electron-v45.2.1-wvcus-win32-x64` and an existing Spoti installation's Java runtime.

For a WSL checkout, keep Vite and its Linux dependencies in WSL:

```
npm run dev -- --port 3001 --strictPort
```

Then launch `scripts/dev-desktop.cjs` with Windows Node, setting `SPOTI_DEV_URL=http://localhost:3001/`. The desktop launcher reuses this server instead of trying to run Linux Vite dependencies on Windows. It stages the compiled JVM jars into a local, content-addressed cache because reading them directly across the WSL share makes Java startup very slow. `SPOTI_BACKEND_LIB` can override that development-only path. `SPOTI_DEV_PROFILE` optionally selects a dedicated development profile. Use a free port and retain the trailing slash.

Select **Connect to Spotify**. Spotify's sign-in page appears inside the same app window; **Return to My Spoti** dismisses it. After login, the page hides and the custom interface loads your account. Playback continues inside the app. This uses a separate persistent playback partition; you will sign in once again because Chrome's cookies are not copied. No external Chrome window is opened. Closing the app closes the owned playback view and JVM.

The runtime downloads its Widevine component on first use. Missing components, failed navigation and backend errors offer a reconnect path. Google/Apple/Facebook social-login navigation is not currently supported inside this restricted login view; use Spotify email/password login. Key-system availability alone does not prove that Spotify accepts the runtime's DRM licenses.

The first version includes home, search, library filters, album/playlist/artist views, paginated track lists, liked songs, queue, playback controls and legal credits. Podcasts in home may appear, but podcast/show detail pages, Android extensions, offline downloads and playlist editing are not yet ported. No donation destination has been configured.

## Checks

```
npm test
npm run build
npx playwright install chromium
npx electron --version
npm run test:ui
```

Upstream and desktop JVM tests:

```
cd backend
./gradlew :api:test :api-spotify:test :host-cdp:test :desktop-server:test :desktop-server:installDist
```

Upstream live CDP tests are skipped unless a signed-in Chrome CDP endpoint is explicitly supplied. UI tests use a labeled sample library or test adapters; they do not prove Spotify login, DRM playback, or account access.

The standalone build in `desktop/backend` uses Gradle 8.11.1 and compiles the shared modules with the installed JDK (17+), without changing the Android build.

## Existing Windows installer workflow

The packaging workflow below predates embedded playback and has not been validated with the Castlabs runtime or Spotify licensing. It is not part of this local development change. Do not use stock Electron caches for embedded-playback packaging.

The `Desktop Windows` GitHub Actions workflow builds an unsigned Windows x64 NSIS installer and a source archive. It does not publish a release. To package locally, build the backend, copy a Windows Java runtime matching the JDK used to compile the backend into `desktop/runtime` (with `bin/java.exe`), then run:

```
npm run package:win -- --publish never
```

Windows SmartScreen may flag the unsigned installer. Installer behavior and real audio must be checked on Windows before release. Distribute the matching complete source archive alongside each installer, retain LICENSE, THIRD_PARTY_NOTICES.md and bundled licenses, and include build instructions. The source link in About points to this fork; make the matching source public before distribution.

For an offline local test build, first build the renderer and backend, then run the following with **Windows Node.js**. Supply existing Windows Electron, Java and electron-builder tool caches:

```
node scripts/package-local-windows.cjs --electron-dist "C:\cache\electron\dist" --runtime "C:\cache\jre21" --7zip-path "C:\cache\7zip\7za.exe" --nsis-dir "C:\cache\nsis" --nsis-resources-dir "C:\cache\nsis-resources" --output-dir "C:\Users\your-name\Downloads"
```

The helper checks the supplied Java/backend IPC, stages files on Windows, blocks packaging downloads and copies the completed installer to the requested folder. It uses the supplied Electron version, skips executable resource editing/signing and never publishes. The Java runtime must support the backend's compiled Java version. This route also works from WSL by invoking Windows Node against the script's Windows/UNC path. Keep the supplied runtime and tools cached for future builds.
