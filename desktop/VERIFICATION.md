# Desktop verification — November 5, 2026

## Verified locally on Linux / Java 21

- TypeScript (including unused imports/parameters) and Vite production renderer build pass.
- Six Node tests pass: RPC reply correlation/events, service crash rejection, command allowlist/timeouts, startup cancellation, waiting for Windows taskkill completion, and persistent playback device identity.
- Six Playwright browser tests pass: labeled preview/no audio, search/filter/legal navigation, missing-Chrome error and 900px layout, API-shaped playlist pagination and playback-command dispatch/session loss, stale search ordering, and switching tracks during a pending like.
- A seventh Playwright test launches the real Electron app and checks preload/IPC. It is explicitly skipped on Linux and enabled on the Windows build runner.
- Kotlin JVM build and installDist pass: 181 upstream API tests and four desktop protocol tests, zero failures. All 30 upstream live CDP tests are skipped without an explicitly supplied signed-in browser.
- The protocol suite runs under a Windows-style default code page. Its UTF-8 regression test was observed failing with a default-encoding PrintWriter and passing with explicit UTF-8.
- An actual JVM child process returned session status and correctly rejected an authenticated API request while signed out, over the real stdin/stdout protocol.
- Visually inspected Home and playlist at 1440×960 and playlist at 900×650; no page errors or horizontal document overflow in that flow. The signed-out screen's automated design inspection passes its measurements (one advisory for small metadata text).
- Review identified Chrome lifecycle and song-save races; fixes have regression coverage.

Initial dependency downloads failed on intermittent DNS resolution. Local verification used a temporary process-local hostname mapping; no system network settings or repository network configuration were changed.

## Windows and live verification

The `Desktop Windows` workflow builds the Java 17 backend, runs the Node/browser/native Electron tests, and packages an unsigned Windows x64 installer with Java and license notices. See that workflow's run results for Windows verification; the Linux checks above do not prove installation behavior.

Live Spotify authentication, DRM playback and audible audio still require a signed-in Windows test. Fixture tests do not prove account access. Chrome remains a prerequisite and its separate playback window must remain running. Android extensions/downloads are not ported in this first desktop slice.
