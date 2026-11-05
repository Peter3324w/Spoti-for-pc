# Spoti for PC

Windows interface for [Myspoti](https://github.com/kota-zo/myspoti), using its original Kotlin API and Chrome CDP playback host. Modified November 5, 2026 by Peter Phiri. GPL-3.0; upstream copyright and third-party notices remain applicable.

## Browser preview

Requires Node.js 24 or later.

```
cd desktop
npm ci
npm run dev
```

Open http://localhost:5173 and choose **Explore the preview**. Sample artwork and fictional sample library are included solely for reviewing the interface. The preview cannot play audio or access an account.

## Windows development

Install Google Chrome, Node.js 24 and Java 17 or later. Chrome is needed for Spotify's existing Widevine playback; stock Electron is used only for our local UI.

```
cd desktop
npm ci
npm run backend:build
npm start
```

Select **Connect to Spotify**, then sign in in the dedicated Chrome playback window. Leave that window running (it can be minimized). Spoti uses a separate persistent Chrome profile, never your usual browser profile. The desktop UI loads your library after the backend confirms login. Closing Spoti terminates its owned playback processes. Closing Chrome requires reconnecting from Spoti.

The first version includes home, search, library filters, album/playlist/artist views, paginated track lists, liked songs, queue, playback controls and legal credits. Podcasts in home may appear, but podcast/show detail pages, Android extensions, offline downloads and playlist editing are not yet ported. No donation destination has been configured.

## Checks

```
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

Upstream and desktop JVM tests:

```
cd backend
./gradlew :api:test :api-spotify:test :host-cdp:test :desktop-server:test :desktop-server:installDist
```

Upstream live CDP tests are skipped unless a signed-in Chrome CDP endpoint is explicitly supplied. UI tests use a labeled sample library or test adapters; they do not prove Spotify login, DRM playback, or account access.

The standalone build in `desktop/backend` uses Gradle 8.11.1 and compiles the shared modules with the installed JDK (17+), without changing the Android build.

## Windows installer

The `Desktop Windows` GitHub Actions workflow builds an unsigned Windows x64 NSIS installer and a source archive. It does not publish a release. To package locally, build the backend, copy a Windows Java runtime matching the JDK used to compile the backend into `desktop/runtime` (with `bin/java.exe`), then run:

```
npm run package:win -- --publish never
```

Keep Chrome installed. Windows SmartScreen may flag the unsigned installer. Installer behavior and real audio must be checked on Windows before release. Distribute the matching complete source archive alongside each installer, retain LICENSE, THIRD_PARTY_NOTICES.md and bundled licenses, and include build instructions. The source link in About points to this fork; make the matching source public before distribution.
