$ErrorActionPreference = "Stop"

$APP_VERSION = node -p "require('./package.json').version"

Write-Host "Building VTogether version $APP_VERSION"

$distFolder = Join-Path $PSScriptRoot "dist"

if (Test-Path $distFolder) {
    Write-Host "Cleaning up old build..."
    Remove-Item -Recurse -Force $distFolder
}

New-Item -ItemType Directory -Path $distFolder | Out-Null

Write-Host "Running Electron Packager..."
Start-Process -NoNewWindow -Wait -FilePath "cmd.exe" -ArgumentList @(
    "/c", "npm", "exec", "electron-packager", "--", ".", "VTogether",
    "--app-bundle-id=dev.meowisworking.vtogether",
    "--app-copyright=""VTogether © 2025 by MeowSkyKung is licensed under CC BY-SA 4.0""",
    "--platform=win32",
    "--arch=x64",
    "--out=$distFolder",
    "--overwrite",
    "--executable-name=VTogether",
    "--icon=VTogether.ico",
    "--ignore=""packages""",
    "--asar.unpack=""**/*.{node,dll}"""
) -PassThru

$oldPath = "$distFolder/VTogether-win32-x64"
$newPath = "$distFolder/VTogether-$APP_VERSION-win32-x64"

if (Test-Path $newPath) {
    Remove-Item -Recurse -Force $newPath
}

Move-Item -Path $oldPath -Destination $newPath

$zipPath = "$distFolder/VTogether-$APP_VERSION-win32-x64.zip"
Compress-Archive -Path "$newPath/*" -DestinationPath "$zipPath" -Force

Write-Host "Build complete: $zipPath"
