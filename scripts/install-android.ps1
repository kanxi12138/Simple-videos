param([string]$Serial)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdkDirectory = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adbExecutable = Join-Path $sdkDirectory 'platform-tools\adb.exe'
$buildTools = Get-ChildItem -LiteralPath (Join-Path $sdkDirectory 'build-tools') -Directory | Sort-Object { [Version]$_.Name } -Descending | Select-Object -First 1
$apkSigner = Join-Path $buildTools.FullName 'apksigner.bat'
$apk = Join-Path $projectRoot 'Simple-videos-1.0.21.apk'
if (-not (Test-Path -LiteralPath $apk)) { throw '请先构建 Android APK' }
if (-not $Serial) {
    $connectedDevices = @(& $adbExecutable devices | Select-String '^\S+\s+device$' | ForEach-Object { ($_.Line -split '\s+')[0] })
    if ($connectedDevices.Count -ne 1) { throw '需要一台已授权的 ADB 设备，或通过 -Serial 指定设备' }
    $Serial = $connectedDevices[0]
}
$metadata = & (Join-Path $buildTools.FullName 'aapt.exe') dump badging $apk
if ($LASTEXITCODE -ne 0 -or -not ($metadata | Select-String "package: name='com.simplevideos.app' versionCode='1000021' versionName='1.0.21'")) {
    throw 'APK 包名或版本与预期不符'
}
function Get-ApkCertificate([string]$FilePath) {
    $certificateOutput = & $apkSigner verify --print-certs $FilePath
    if ($LASTEXITCODE -ne 0) { throw 'APK 签名验证失败' }
    $match = $certificateOutput | Select-String 'certificate SHA-256 digest: ([a-f0-9]{64})'
    if (-not $match) { throw '无法读取 APK 证书' }
    return $match.Matches[0].Groups[1].Value
}
$newCertificate = Get-ApkCertificate $apk
$installedPackages = & $adbExecutable -s $Serial shell pm list packages com.simplevideos.app
if ($LASTEXITCODE -ne 0) { throw '无法读取手机应用状态' }
$installedPath = $null
if ($installedPackages -contains 'package:com.simplevideos.app') {
    $installed = & $adbExecutable -s $Serial shell pm path com.simplevideos.app
    if ($LASTEXITCODE -ne 0) { throw '无法读取已安装应用路径，未执行覆盖' }
    $installedPath = ($installed | Select-String '^package:.*base.apk$' | Select-Object -First 1).Line
    if (-not $installedPath) { throw '已安装应用路径无效，未执行覆盖' }
}
if ($installedPath) {
    $checkDirectory = Join-Path $projectRoot '.local\install-check'
    New-Item -ItemType Directory -Path $checkDirectory -Force | Out-Null
    $installedApk = Join-Path $checkDirectory 'installed.apk'
    & $adbExecutable -s $Serial pull $installedPath.Substring(8) $installedApk
    if ($LASTEXITCODE -ne 0) { throw '无法读取已安装 APK，未执行覆盖' }
    if ((Get-ApkCertificate $installedApk) -ne $newCertificate) { throw '手机应用与本项目签名不一致，已停止安装，未卸载或清空数据' }
}
& $adbExecutable -s $Serial install -r $apk
if ($LASTEXITCODE -ne 0) { throw '安装失败' }
& $adbExecutable -s $Serial shell am start -n com.simplevideos.app/.MainActivity
if ($LASTEXITCODE -ne 0) { throw '应用启动失败' }
$packageInfo = & $adbExecutable -s $Serial shell dumpsys package com.simplevideos.app
if ($LASTEXITCODE -ne 0 -or -not ($packageInfo | Select-String 'versionCode=1000021\b') -or -not ($packageInfo | Select-String 'versionName=1\.0\.21\b')) {
    throw '安装后的系统包版本与预期不符'
}
Write-Output '系统包版本确认：1.0.21 / 1000021'
Write-Output "安装并启动完成。证书 SHA-256: $newCertificate"
