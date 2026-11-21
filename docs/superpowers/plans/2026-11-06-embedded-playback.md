# Embedded playback implementation plan

**Goal:** One My Spoti window, embedded Spotify login and protected playback, with no initial Play click required in a separate browser.

**Architecture:** Replace the desktop Chrome child with an isolated Electron WebContentsView using Castlabs Electron 45.2.1+wvcus. Keep the upstream Kotlin API. Relay bridge evaluation and messages over the existing private JVM stdin/stdout connection, rather than exposing a browser debugging port. Evaluate playback commands with user activation and permit autoplay only in the dedicated playback session.

**Constraints:** Work locally on dev; no production builds, installer packaging, pushes or publication. Peter approved the approximately 158 MB Windows runtime plus supporting DRM components on November 6. Preserve the downloaded archive/cache. Do not copy Chrome cookies; users sign in once to the new isolated playback profile. Real Windows audio and Spotify licensing must be checked separately from mocks.

## Task 1: Embedded bridge transport
- [x] Add failing Kotlin tests for bridge evaluation acknowledgement, page messages and failed evaluations.
- [x] Implement EmbeddedHost and route private host messages in Main while preserving CDP compatibility for upstream tests.
- [x] Run desktop JVM tests offline using cached dependencies.

## Task 2: Single-window playback lifecycle
- [x] Add failing Node tests covering embedded startup, session visibility, user-activated evaluation, cancellation, failure cleanup and blocking external navigation.
- [x] Replace Chrome ownership with a WebContentsView, dedicated persistent session and private debugger binding. Keep all remote content sandboxed without application IPC or Node access.
- [x] Add a local sign-in header with a return button; dismiss the login view after authentication. Update stale Chrome UI text.
- [x] Add a development launcher that accepts the cached Windows ECS executable without downloading or building an installer.
- [x] Run Node tests and TypeScript checks.

## Task 3: Runtime and integrated verification
- [x] Verify the runtime archive checksum, extract to the shared cache and initialize its DRM component.
- [x] Run the Windows runtime against the local app using development assets. Check key-system availability, one-window login and the real JVM connection.
- [ ] Peter must sign in and check first-play audio; the new profile has no signed-in account. Key-system and bridge checks pass, which do not establish Spotify license acceptance.
- [x] Update setup and verification notes, obtain a fresh code review, fix significant findings and commit verified changes locally on dev.

## Review focus
- Remote page navigation and popup destinations never gain application preload/IPC access.
- Closing/reconnecting cannot leave an owned remote view or JVM alive.
- A bridge evaluation from a prior session never reaches its replacement.
- No stock Electron fallback claims that protected playback is supported.
- Login failure and expired sessions leave a usable return/retry path.

Ruling: execute directly in the existing clean dev checkout to follow Peter's local-dev workflow; no branch integration is needed. The user's acceptance of the proposed download and implementation is authorization to proceed without another design approval.

Verification: 16 Node tests, seven Windows Chromium UI tests, TypeScript and JS syntax checks pass. Offline JVM suite: 187 passing, 30 authenticated live tests skipped. Native Windows Electron: one BrowserWindow, real preload IPC, embedded desktop Web Player with bridge v1, connected=true/signedIn=false, Widevine MP4/AAC support, accounts.spotify.com navigation in the same view.

Review: independent reviewer found failure-state overwrite and untrusted execution contexts; both fixed with RED→GREEN regressions. Additional staging review found no important issues. Runtime-driven fixes for initial navigation, desktop user agent and local JVM jars were separately verified.
