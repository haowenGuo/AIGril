const path = require('path');
const { spawn } = require('child_process');

function normalizeString(value, fallback = '') {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim();
    return trimmed || fallback;
}

function normalizeArray(value) {
    if (!value) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function normalizeBoolean(value, fallback = false) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        if (/^(true|1|yes|on)$/i.test(value.trim())) {
            return true;
        }
        if (/^(false|0|no|off)$/i.test(value.trim())) {
            return false;
        }
    }
    return fallback;
}

function encodeBase64Utf8(value = '') {
    return Buffer.from(String(value), 'utf8').toString('base64');
}

function parseKeyChord(keys = []) {
    if (typeof keys === 'string') {
        return keys
            .split(/[+\s,]+/g)
            .map((entry) => normalizeString(entry).toLowerCase())
            .filter(Boolean);
    }
    return normalizeArray(keys)
        .map((entry) => normalizeString(entry).toLowerCase())
        .filter(Boolean);
}

function sendKeysToken(key = '') {
    const normalized = normalizeString(key).toLowerCase();
    const named = {
        enter: '{ENTER}',
        return: '{ENTER}',
        tab: '{TAB}',
        escape: '{ESC}',
        esc: '{ESC}',
        backspace: '{BACKSPACE}',
        delete: '{DELETE}',
        del: '{DELETE}',
        up: '{UP}',
        down: '{DOWN}',
        left: '{LEFT}',
        right: '{RIGHT}',
        home: '{HOME}',
        end: '{END}',
        pageup: '{PGUP}',
        pagedown: '{PGDN}',
        pgup: '{PGUP}',
        pgdn: '{PGDN}',
        space: ' ',
        printscreen: '{PRTSC}'
    };
    if (named[normalized]) {
        return named[normalized];
    }
    if (/^f([1-9]|1[0-9]|2[0-4])$/.test(normalized)) {
        return `{${normalized.toUpperCase()}}`;
    }
    if (normalized.length === 1) {
        return normalized.replace(/[+^%~(){}\[\]]/g, '{$&}');
    }
    return `{${normalized.toUpperCase()}}`;
}

function keyChordToSendKeys(keys = []) {
    const chord = parseKeyChord(keys);
    const modifiers = [];
    const regular = [];
    for (const key of chord) {
        if (['ctrl', 'control', 'cmd', 'command', 'meta'].includes(key)) {
            modifiers.push('^');
        } else if (['alt', 'option'].includes(key)) {
            modifiers.push('%');
        } else if (key === 'shift') {
            modifiers.push('+');
        } else {
            regular.push(key);
        }
    }
    return `${modifiers.join('')}${regular.map(sendKeysToken).join('') || ''}`;
}

class HumanClawPlatformAdapter {
    constructor(options = {}) {
        this.platform = normalizeString(options.platform, process.platform);
        this.arch = normalizeString(options.arch, process.arch);
        this.env = options.env && typeof options.env === 'object' ? options.env : process.env;
    }

    get id() {
        if (this.isWindows()) {
            return 'windows';
        }
        if (this.isMacOS()) {
            return 'macos';
        }
        if (this.isLinux()) {
            return 'linux';
        }
        return this.platform || 'unknown';
    }

    isWindows() {
        return this.platform === 'win32';
    }

    isMacOS() {
        return this.platform === 'darwin';
    }

    isLinux() {
        return this.platform === 'linux';
    }

    pathKey(filePath) {
        const resolved = path.resolve(String(filePath || ''));
        return this.isWindows() ? resolved.toLowerCase() : resolved;
    }

    isPathInside(rootPath, targetPath) {
        const root = path.resolve(rootPath);
        const target = path.resolve(targetPath);
        const rootComparable = this.pathKey(root);
        const targetComparable = this.pathKey(target);
        return targetComparable === rootComparable || targetComparable.startsWith(`${rootComparable}${path.sep}`);
    }

    uniquePaths(paths = []) {
        const seen = new Set();
        const result = [];
        for (const entry of normalizeArray(paths)) {
            const normalized = normalizeString(entry);
            if (!normalized) {
                continue;
            }
            const resolved = path.resolve(normalized);
            const key = this.pathKey(resolved);
            if (!seen.has(key)) {
                seen.add(key);
                result.push(resolved);
            }
        }
        return result;
    }

    protectedRoots() {
        if (this.isWindows()) {
            const systemDrive = this.env.SystemDrive || 'C:';
            const windir = this.env.WINDIR || `${systemDrive}\\Windows`;
            return this.uniquePaths([
                `${systemDrive}\\`,
                windir,
                `${systemDrive}\\Program Files`,
                `${systemDrive}\\Program Files (x86)`,
                `${systemDrive}\\ProgramData`
            ]);
        }
        if (this.isMacOS()) {
            return ['/', '/bin', '/dev', '/etc', '/Library', '/private', '/sbin', '/System', '/usr'];
        }
        return ['/', '/bin', '/boot', '/dev', '/etc', '/lib', '/proc', '/root', '/sbin', '/sys', '/usr'];
    }

    defaultShellExecutable() {
        if (this.isWindows()) {
            return this.env.ComSpec || 'cmd.exe';
        }
        return this.env.SHELL || 'bash';
    }

    shellArgs(command = '') {
        const text = normalizeString(command);
        if (!text) {
            return [];
        }
        return this.isWindows() ? ['/d', '/s', '/c', text] : ['-lc', text];
    }

    shellSpawnOptions({ cwd, env } = {}) {
        return {
            cwd,
            shell: true,
            windowsHide: this.isWindows(),
            env: {
                ...this.env,
                ...(env && typeof env === 'object' ? env : {})
            }
        };
    }

    ptySpawnOptions({ command = '', executable = '', args = [], cwd, env, term = 'xterm-256color', cols = 100, rows = 30, useConpty, useConptyDll } = {}) {
        const shell = normalizeString(executable, this.defaultShellExecutable());
        const ptyArgs = Array.isArray(args) && args.length
            ? args.map((entry) => String(entry))
            : this.shellArgs(command);
        return {
            executable: shell,
            args: ptyArgs,
            options: {
                name: term,
                cols,
                rows,
                cwd,
                ...(this.isWindows()
                    ? {
                          useConpty: useConpty === undefined ? true : normalizeBoolean(useConpty, true),
                          useConptyDll: normalizeBoolean(useConptyDll, false)
                      }
                    : {}),
                env: {
                    ...this.env,
                    ...(env && typeof env === 'object' ? env : {})
                }
            }
        };
    }

    aclReadCommand(targetPath) {
        return this.isWindows()
            ? { supported: true, command: 'icacls.exe', args: [targetPath] }
            : { supported: true, command: 'ls', args: ['-ld', targetPath] };
    }

    aclSetCommand(targetPath, icaclsArgs = []) {
        if (!this.isWindows()) {
            return {
                supported: false,
                reason: 'acl_set currently has a Windows icacls adapter only.'
            };
        }
        return {
            supported: true,
            command: 'icacls.exe',
            args: [targetPath, ...icaclsArgs]
        };
    }

    powershellCommand(script) {
        if (!this.isWindows()) {
            return {
                supported: false,
                reason: 'PowerShell desktop automation is currently implemented for Windows only.'
            };
        }
        return {
            supported: true,
            command: 'powershell.exe',
            args: ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script],
            windowsHide: true
        };
    }

    desktopScreenshotCommand({ outputPath } = {}) {
        if (!this.isWindows()) {
            return {
                supported: false,
                reason: 'screen_screenshot currently has a Windows desktop adapter only.'
            };
        }
        const encodedPath = encodeBase64Utf8(outputPath);
        return this.powershellCommand(`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$path = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'))
$dir = [IO.Path]::GetDirectoryName($path)
if ($dir) { [IO.Directory]::CreateDirectory($dir) | Out-Null }
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
@{ ok = $true; path = $path; width = $bounds.Width; height = $bounds.Height } | ConvertTo-Json -Compress
        `.trim());
    }

    clipboardReadCommand() {
        return this.powershellCommand(`
$ErrorActionPreference = 'Stop'
$value = Get-Clipboard -Raw
if ($null -eq $value) { $value = '' }
@{ ok = $true; text = $value } | ConvertTo-Json -Compress
        `.trim());
    }

    clipboardWriteCommand({ text = '' } = {}) {
        const encodedText = encodeBase64Utf8(text);
        return this.powershellCommand(`
$ErrorActionPreference = 'Stop'
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedText}'))
Set-Clipboard -Value $text
@{ ok = $true; bytes = [Text.Encoding]::UTF8.GetByteCount($text) } | ConvertTo-Json -Compress
        `.trim());
    }

    guiInputCommand(args = {}) {
        if (!this.isWindows()) {
            return {
                supported: false,
                reason: 'GUI input currently has a Windows desktop adapter only.'
            };
        }
        const action = normalizeString(args.action || args.operation || args.intent).toLowerCase();
        const x = Math.round(Number(args.x) || 0);
        const y = Math.round(Number(args.y) || 0);
        const endX = Math.round(Number(args.endX ?? args.toX ?? args.x2 ?? x) || 0);
        const endY = Math.round(Number(args.endY ?? args.toY ?? args.y2 ?? y) || 0);
        const durationMs = Math.round(Math.min(Math.max(Number(args.durationMs ?? args.duration ?? 120) || 120, 0), 10000));
        const delta = Math.round(Number(args.delta ?? args.scrollDelta ?? args.amount ?? -600) || -600);
        const keys = keyChordToSendKeys(args.keys || args.key || args.chord || '');
        const textBase64 = encodeBase64Utf8(args.text || args.content || '');
        const keyBase64 = encodeBase64Utf8(keys);
        const mouseScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AiglWinInput {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, int data, UIntPtr extra);
}
"@
function MoveTo([int]$mx, [int]$my) { [AiglWinInput]::SetCursorPos($mx, $my) | Out-Null }
function LeftClick() { [AiglWinInput]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [AiglWinInput]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero) }
function RightClick() { [AiglWinInput]::mouse_event(0x0008,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [AiglWinInput]::mouse_event(0x0010,0,0,0,[UIntPtr]::Zero) }
        `.trim();
        let body = '';
        if (['mouse_move', 'move_mouse'].includes(action)) {
            body = `${mouseScript}\nMoveTo ${x} ${y}`;
        } else if (['mouse_click', 'click'].includes(action)) {
            body = `${mouseScript}\nMoveTo ${x} ${y}\nLeftClick`;
        } else if (['mouse_double_click', 'double_click'].includes(action)) {
            body = `${mouseScript}\nMoveTo ${x} ${y}\nLeftClick\nStart-Sleep -Milliseconds 80\nLeftClick`;
        } else if (['mouse_right_click', 'right_click'].includes(action)) {
            body = `${mouseScript}\nMoveTo ${x} ${y}\nRightClick`;
        } else if (['mouse_drag', 'drag'].includes(action)) {
            body = `${mouseScript}
MoveTo ${x} ${y}
[AiglWinInput]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero)
$steps = [Math]::Max(1, [Math]::Min(40, [Math]::Round(${durationMs} / 30)))
for ($i = 1; $i -le $steps; $i++) {
    $nx = [Math]::Round(${x} + ((${endX} - ${x}) * $i / $steps))
    $ny = [Math]::Round(${y} + ((${endY} - ${y}) * $i / $steps))
    MoveTo $nx $ny
    Start-Sleep -Milliseconds ([Math]::Max(1, [Math]::Round(${durationMs} / $steps)))
}
[AiglWinInput]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)`;
        } else if (['scroll', 'mouse_scroll'].includes(action)) {
            body = `${mouseScript}\nMoveTo ${x} ${y}\n[AiglWinInput]::mouse_event(0x0800,0,0,${delta},[UIntPtr]::Zero)`;
        } else if (['keyboard_type', 'type_text', 'type'].includes(action)) {
            body = `
Add-Type -AssemblyName System.Windows.Forms
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${textBase64}'))
Set-Clipboard -Value $text
Start-Sleep -Milliseconds 60
[System.Windows.Forms.SendKeys]::SendWait('^v')
            `.trim();
        } else if (['keyboard_hotkey', 'hotkey', 'keyboard_press', 'press_key'].includes(action)) {
            body = `
Add-Type -AssemblyName System.Windows.Forms
$keys = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${keyBase64}'))
[System.Windows.Forms.SendKeys]::SendWait($keys)
            `.trim();
        } else {
            return {
                supported: false,
                reason: `Unsupported GUI action: ${action}`
            };
        }
        return this.powershellCommand(`
$ErrorActionPreference = 'Stop'
${body}
@{ ok = $true; action = '${action}'; x = ${x}; y = ${y}; endX = ${endX}; endY = ${endY}; durationMs = ${durationMs}; delta = ${delta} } | ConvertTo-Json -Compress
        `.trim());
    }

    async killProcessTree(child, signal = 'SIGTERM') {
        if (!child) {
            return { ok: false, status: 'missing_child' };
        }
        if (this.isWindows() && child.pid) {
            return await new Promise((resolve) => {
                const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
                    stdio: 'ignore',
                    windowsHide: true
                });
                killer.on('close', (code) => {
                    resolve({ ok: code === 0, status: code === 0 ? 'killed' : 'taskkill_failed', code, pid: child.pid });
                });
                killer.on('error', (error) => {
                    try {
                        child.kill(signal);
                    } catch {}
                    resolve({
                        ok: false,
                        status: 'taskkill_error',
                        pid: child.pid,
                        error: error?.message || String(error)
                    });
                });
            });
        }
        try {
            child.kill(signal);
            return { ok: true, status: 'killed', signal, pid: child.pid || null };
        } catch (error) {
            return {
                ok: false,
                status: 'kill_failed',
                signal,
                pid: child.pid || null,
                error: error?.message || String(error)
            };
        }
    }

    getStatus() {
        return {
            id: this.id,
            platform: this.platform,
            arch: this.arch,
            family: this.isWindows() ? 'windows' : this.isMacOS() ? 'macos' : this.isLinux() ? 'linux' : 'unknown',
            capabilities: {
                desktopApp: ['windows', 'macos', 'linux'].includes(this.id),
                shell: true,
                processTreeKill: this.isWindows(),
                aclRead: true,
                aclSet: this.isWindows(),
                pty: true,
                screenCapture: 'electron-adapter',
                windowControl: 'electron-adapter',
                guiInput: this.isWindows() ? 'windows-powershell-user32' : 'adapter-pending',
                clipboard: this.isWindows()
            },
            defaults: {
                shell: this.defaultShellExecutable()
            }
        };
    }
}

let defaultAdapter = null;

function createHumanClawPlatformAdapter(options = {}) {
    if (options instanceof HumanClawPlatformAdapter) {
        return options;
    }
    if (typeof options === 'string') {
        return new HumanClawPlatformAdapter({ platform: options });
    }
    return new HumanClawPlatformAdapter(options);
}

function getDefaultPlatformAdapter() {
    if (!defaultAdapter) {
        defaultAdapter = createHumanClawPlatformAdapter();
    }
    return defaultAdapter;
}

module.exports = {
    HumanClawPlatformAdapter,
    createHumanClawPlatformAdapter,
    getDefaultPlatformAdapter
};
