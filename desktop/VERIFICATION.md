# Signed-in failure investigation — November 6, 2026

Peter's signed-in test did **not** pass: selecting a song caused rapid skipping and then silent apparent playback. The failure was reproduced in the actual Windows development app.

- Spotify's audio-licence endpoint returned repeated HTTP **500** responses; selected tracks advanced only a fraction of a second before moving on. The page then played a muted advert while the custom UI retained the last song. This was not corrected by maximum music volume.
- The engine had media keys, volume **1.0**, a ready media decoder and the active Spotify Connect device. The failing Windows runtime's signature was checked with official `castlabs-evs 1.3.3`: **Certificate is valid for development only**.
- Castlabs issue193 records the same Spotify500/skipping symptom and resolution through EVS signing: https://github.com/castlabs/electron-releases/issues/193. Correct signing remains to be done; successful audible playback is still unverified.
- A failed audio licence now disposes the view/JVM and retains an explanatory error, blocking frontend play/skip and backend recovery instead of cycling through tracks. The failing response's headers and body are not relayed to the UI or logs.
- Once authenticated, temporary session changes cannot re-show the Spotify browser page. Remote navigation stays hidden until it loads, avoiding the blank browser view over the local interface.
- A fresh signed-in Windows guard test selected a Liked Songs track, observed the real licence failure, and confirmed: setup error visible, embedded page disposed, backend stopped, and subsequent Play rejected. The app was left stopped at the explanatory error.
- Independent review identified that a one-shot JS pause could be undone by Kotlin recovery. The final implementation disposes both playback view and JVM and ignores late callbacks; regression coverage includes a pending play request and a late backend resume.
- **18 Node tests pass**, including the failure guard, stale backend recovery rejection, login latch, navigation loading and hook cleanup. TypeScript and JS syntax checks pass. These checks do not fix or prove Spotify licensing.
- Signing prerequisites and exact steps: [playback-signing.md](docs/playback-signing.md). The CLI is prepared locally; no EVS account was created, no signup email sent and no signing request made. A verified account is required. No production app build or installer was created.

---

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
