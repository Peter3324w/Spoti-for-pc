# Windows Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A Windows music client with a Spotify-style React UI and the original Myspoti Kotlin integration.

**Architecture:** Electron owns Chrome and a Kotlin JSON-lines RPC child process. An isolated preload exposes only allowlisted requests; the renderer displays API models and subscribes to player/session events.

**Tech Stack:** Electron, React, TypeScript, Vite, Playwright, Kotlin JVM, upstream Chrome CDP host.

**Spec:** docs/superpowers/specs/2026-11-05-windows-desktop-design.md

## Global Constraints
- Windows desktop; GPL-3.0; preserve Myspoti and third-party notices.
- Reuse `:api-spotify` and `:host-cdp`; no privileged remote page.
- Chrome prerequisite, dedicated profile, dynamic loopback CDP; explicit browser-preview state.
- No publication, pushes, or live account mutations during automated tests.

## Review Focus
- Chrome missing: actionable install/retry error, no silent fallback.
- JVM crashes: reject pending requests and show reconnect state.
- Session expires: no stale personalized data or apparent successful commands.
- Page requests finish out of order: only current query/navigation is displayed.
- Long libraries: use nextOffset and prevent duplicate page requests.

### Task 1: JVM RPC host and desktop-only build
**Files:** `base/desktop-server/**`, `desktop/backend/settings.gradle.kts`, `desktop/backend/build.gradle.kts`
**Interfaces:** consumes upstream SpotifyApi/CdpHost; produces JSON lines `{id,ok,value|error}` and `{event,value}`; commands are allowlisted.
- [x] Write failing tests for command validation and RPC envelope serialization.
- [x] Add JVM application with session/start, page reload injection, account/catalog/library/search/player commands and player events.
- [x] Add a standalone desktop Gradle build that reuses upstream module directories and excludes Android plugins and toolchain provisioning.
- [x] Run new tests plus upstream API, Spotify and CDP suites; installDist.

### Task 2: Desktop shell and lifecycle
**Files:** `desktop/package.json`, `desktop/electron/**`, `desktop/tests/rpc.test.*`, `desktop/scripts/**`
**Interfaces:** consumes Task 1 protocol; exposes `window.spoti.request(method,args)` and `subscribe(callback)` to trusted renderer only.
- [x] Test request correlation, timeouts and process exit first.
- [x] Implement RPC child, Chrome discovery/startup/cleanup, isolated preload, trusted IPC, app window and packaging resources.
- [x] Verify unit tests; add Windows build workflow and bundle Java/backend/notices.

### Task 3: Spotify-style UI
**Files:** `desktop/src/**`, `desktop/index.html`, `desktop/vite.config.ts`, `desktop/tests/ui.spec.ts`
**Interfaces:** consumes preload API and upstream JSON models; browser preview has no music playback.
- [x] Add browser tests for signed-out state, preview navigation, search results, pagination and errors before UI implementation.
- [x] Implement shell, reusable media/track displays, session connection, home/search/detail/library/queue, playback controls and About.
- [x] Run TypeScript/build/unit/Playwright checks and inspect real browser at desktop and narrow widths.
- [x] Document run/build commands and separate verified behavior from Windows/live playback checks.
