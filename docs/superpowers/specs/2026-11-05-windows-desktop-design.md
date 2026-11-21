# Spoti for PC — Windows desktop

Build a Windows desktop client using Myspoti's existing Kotlin API, Spotify integration and Chrome CDP host. The user has selected Windows, asked for the existing integration, and requested Spotify's web-player layout with Playwright used for inspection and testing. Their instruction to continue authorizes proceeding with sensible implementation choices.

## Implementation decisions
- Electron hosts a React/TypeScript UI. Keep remote Spotify pages out of the privileged UI process.
- A Kotlin JVM application exposes a strict JSON-lines RPC interface over child-process stdin/stdout, reusing `:api-spotify` and `:host-cdp`. No HTTP service or credentials in the renderer.
- Installed Chrome runs Spotify with an app-specific persistent profile and a dynamic loopback debugging port. Login is visible in Chrome; playback remains there. Do not claim embedded DRM support. Closing Spoti closes the owned Chrome process and JVM process.
- A standalone Gradle 8.11.1 build reuses upstream JVM module directories, using the installed Java 17+ JDK for compilation. Android build files remain unchanged.
- Windows installers bundle the backend and Java runtime. Initial development may require local Java. No automatic publishing or releases.
- UI mirrors open.spotify.com's dark surfaces, persistent library sidebar, top search, media shelves, track lists and bottom transport. Own app name/mark, standard open-source icons and system fonts; Spotify content comes from the API.
- First usable slice: login, account, home shelves, search, library filtering, paginated albums/playlists/liked tracks, artist top tracks, play/pause/skip/seek/shuffle/repeat/volume, queue, retry/error states, and legal credits.
- Retain GPL-3.0, upstream notices and clear Myspoti attribution. Link complete source from About.
- Do not misrepresent sample data as a signed-in account. Browser-only preview is explicitly a preview and cannot play music.

## Verification and constraints
Use Playwright for browser layout/navigation and error-state checks. Unit-test RPC response matching, invalid methods and player time handling. Compile Kotlin and run its upstream JVM tests. Build renderer and a Windows package where the environment permits. Real Windows audio and authenticated live API checks require Windows plus a signed-in Spotify account; report these separately from automated fixture tests.

## Known tradeoffs
Chrome is a prerequisite and initially opens a separate playback/login window. This is intentional reuse of the working upstream host, pending a verified embedded engine. Android-only extensions/downloads are outside this first desktop slice.
