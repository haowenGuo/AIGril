$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$RunDir = Join-Path $RepoRoot "backend\blog_content\auto_blog_runs\2026-04-22-16h-blog-autowriter"
$LockFile = Join-Path $RunDir "runner.lock"

if (-not (Test-Path $LockFile)) {
    Write-Output "No runner.lock found. The runner may not be active."
    exit 0
}

$content = Get-Content $LockFile
$pidLine = $content | Where-Object { $_ -like "pid=*" } | Select-Object -First 1
if (-not $pidLine) {
    Write-Output "runner.lock exists, but no PID was found: $LockFile"
    exit 1
}

$runnerPid = [int]($pidLine -replace "^pid=", "")
$process = Get-Process -Id $runnerPid -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $runnerPid -Force
    Write-Output "Stopped AIGril auto blog runner PID $runnerPid."
} else {
    Write-Output "Runner PID $runnerPid was not running."
}

Remove-Item -Path $LockFile -Force -ErrorAction SilentlyContinue
