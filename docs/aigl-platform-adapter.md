# AIGL Platform Adapter Architecture

AIGL keeps Windows as the first-class desktop target, but platform-specific behavior must live behind a Platform Adapter instead of leaking into Agent, Memory, Skill, MCP, or Persona code.

## Layers

```text
AIGL Core
Agent Loop / Memory / Skills / MCP / Eval / Persona Surface
        |
HumanClaw Tool Contracts
        |
Computer and Vision Tool Interfaces
        |
Platform Adapter
        |
Windows Adapter first, then macOS / Linux / Android adapters
```

## Platform-Neutral Core

These modules should stay platform neutral:

- Agent Loop, Turn Items, tool observations, and generic recovery handling
- Memory and relationship state
- Persona Surface Gateway
- Tool contracts and Skill packages
- MCP session manager and Capability Manager
- Eval runners and reports

They may read `platform` metadata from observations, but should not hard-code Windows, macOS, Linux, Android, or iOS assumptions.

## Adapter Surface

The base adapter lives in `electron/humanclaw-platform-adapter.cjs`.

It currently owns:

- Platform identity and capability metadata
- Case-insensitive path comparison on Windows
- Protected root detection
- Default shell and PTY shell arguments
- ACL read/write command selection
- Windows process-tree termination via `taskkill`

The first connected consumer is `computer`. Gateway and Runtime also expose platform status so tools and evals can verify the active platform.

The Electron shell adapter lives in `electron/humanclaw-desktop-platform-adapter.cjs`.

It owns desktop-shell behavior that previously leaked into `electron/main.cjs`:

- Electron `desktopCapturer` screen snapshots
- `BrowserWindow.capturePage()` window snapshots
- Region capture overlay windows
- Display-aware window clamping and dialogue expansion layout
- Transparent/topmost/all-workspaces window behavior
- Mouse passthrough via `setIgnoreMouseEvents`

`main.cjs` should keep product state and IPC wiring, while this adapter owns Electron-specific screen/window primitives.

## Windows Priority

The Windows adapter remains the production path for now:

- Electron desktop shell
- VRM pet window and chat/control windows
- Screenshot and region capture
- Local computer/filesystem/process tools
- TTS/ASR desktop pipeline

Windows-only behavior is allowed inside the adapter or Windows-specific Electron capture/window code, but should not be copied into Agent prompt logic or generic tool contracts.

## Future Adapters

Future platform adapters should implement the same conceptual surface:

- `observeScreen`
- `listWindows`
- `focusWindow`
- `click`
- `typeText`
- `hotkey`
- `scroll`
- `drag`
- `runCommand`
- `killProcessTree`
- `readClipboard`
- `writeClipboard`

Expected backends:

- Windows: Electron, Win32/UIAutomation, PowerShell/cmd, `taskkill`
- macOS: Electron, Accessibility API, ScreenCaptureKit, AppleScript, zsh
- Linux: Electron, X11/Wayland-specific screenshot/input, DBus, bash
- Android: ADB, uiautomator, Appium, screenshot/OCR
- iOS simulator: XCUITest/Appium, simulator APIs

## Migration Rule

When adding platform-specific behavior:

1. Put the generic tool contract in `humanclaw-tool-contracts.cjs`.
2. Put platform-neutral orchestration in Agent/Runtime.
3. Put OS-specific command/API decisions in `humanclaw-platform-adapter.cjs` or a platform-specific adapter module.
4. Add a test that simulates at least Windows and one non-Windows adapter.
