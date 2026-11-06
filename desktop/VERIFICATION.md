# Embedded desktop verification — November 6, 2026

- Downloaded Windows x64 Castlabs Electron **45.2.1+wvcus** (158.4 MB); verified SHA256 against the release's SHASUMS256.txt: `a17f87a95a62e8f336d6fa18e57b9bc83d513b02211e4e5771a45cfd7482740e`.
- The Windows runtime installed Widevine **4.10.3112.0**. In the actual isolated Spotify playback view, `requestMediaKeySystemAccess` succeeds for Widevine with MP4/AAC audio. This establishes key-system availability, not Spotify license acceptance or audible playback.
- A real Windows Electron launch reports exactly one BrowserWindow, successful isolated preload IPC, a working embedded Spotify page and the sandboxed private debugger binding. No external Chrome is launched.
- Native verification caught a new view having no renderer before navigation: sending Page.enable at that point hung indefinitely. Initializing about:blank before attaching fixes it. A regression test covers this ordering.
- Native verification also caught Spotify serving its limited mobile site under Electron's default user agent. The playback view now uses the runtime's desktop Chromium identity; the full desktop Web Player renders.
- The real Windows Java process emits private host.evaluate and session events from the new stdio bridge. Direct jar reads across the WSL share were too slow to initialize during a 15-second probe; the same jars initialize immediately from Windows-local storage. The launcher stages immutable jar snapshots by content hash.
- **16 Node tests pass**, including navigation isolation, trusted top-frame bridge messages, user activation, failure persistence, component-download cancellation, closing an already-destroyed parent and local jar-cache invalidation.
- **Seven browser interface tests pass in the cached Windows Chromium**, including the embedded sign-in return action. Linux UI runs failed because the cached browser needs missing Linux shared libraries; rerunning on Windows required no browser download.
- TypeScript checking and JS syntax checks pass. No production renderer build or installer packaging was run.
- Kotlin checks pass offline: **181 upstream API tests and six desktop tests**, zero failures. All **30 upstream live CDP tests** remain skipped without an authenticated browser.
- Independent review found error-state overwrite and untrusted subframe bridge messages; both have observed failing regression tests and fixes. The added local jar-staging code received a separate review with no important findings.

**Still requires Peter's signed-in test:** Spotify login completion, initial Play directly from My Spoti after a fresh launch, license acceptance and audible audio, pause/resume, track switching and reconnect. Existing Chrome cookies are not copied. The previously installed app/installer still represents the old separate-Chrome version until an installer update is explicitly requested.

---

## Historical verification (November 5, before embedded playback)

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
