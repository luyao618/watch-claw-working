# Release Guide

This project ships to end users as a packaged Electron desktop app.

The verified release workflow in this repository is currently macOS-focused.
Windows and Linux targets remain in the Electron Builder config, but they do not
have dedicated, validated packaging scripts yet.

## What users get

- macOS: `Watch Claw-<version>.dmg` and `Watch Claw-<version>-mac.zip`
- Windows: NSIS installer output (configured, not yet validated in this repo)
- Linux: AppImage output (configured, not yet validated in this repo)

Users do not need to install Node.js, pnpm, TypeScript, or `tsx`.

## What the release scripts do

- `pnpm build:electron:mac`
  1. Builds the Vite frontend into `dist/`
  2. Bundles `bridge/server.ts` into `build/bridge/server.cjs`
  3. Packages a macOS `.zip` build with `electron-builder`
  4. Writes artifacts to `release/`

- `pnpm build:electron:mac:dmg`
  1. Reruns the same web and bridge build steps
  2. Builds the macOS DMG variant for distribution

- `pnpm build:electron`
  1. Compatibility alias to `pnpm build:electron:mac`

## Production layout

- `dist/` contains the web UI loaded by Electron
- `electron/main.cjs` is the Electron main process entry
- `electron/preload.cjs` exposes the preload API
- `build/bridge/server.cjs` is the production Bridge Server artifact

The packaged app launches the precompiled bridge directly. Production no longer relies on `tsx` or raw `.ts` files.

## Release steps

```bash
pnpm install
pnpm build:electron:mac
```

Use `pnpm build:electron:mac:dmg` when you are preparing the polished macOS installer.

After the build finishes, upload the files in `release/` for your target platform.

## Local verification

1. Run `pnpm build:electron:mac`
2. Open the generated app archive from `release/`
3. Confirm the window opens and the bridge process starts without a local dev server
4. Confirm the app still reacts to OpenClaw session activity
