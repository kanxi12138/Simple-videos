param([switch]$SkipLint)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$signingDirectory = Join-Path $projectRoot '.local\signing'
New-Item -ItemType Directory -Path $signingDirectory -Force | Out-Null
$keyStore = Join-Path $signingDirectory 'simple-videos.jks'
$passwordFile = Join-Path $signingDirectory 'password.dpapi'
if (-not (Test-Path -LiteralPath $keyStore)) {
    $randomBytes = New-Object byte[] 32
    $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $randomGenerator.GetBytes($randomBytes) } finally { $randomGenerator.Dispose() }
    $password = [Convert]::ToBase64String($randomBytes)
    $securePassword = ConvertTo-SecureString -String $password -AsPlainText -Force
    $securePassword | ConvertFrom-SecureString | Set-Content -LiteralPath $passwordFile
    $env:SIMPLE_VIDEOS_STORE_PASSWORD = $password
    $env:SIMPLE_VIDEOS_KEY_PASSWORD = $password
    & keytool -genkeypair -keystore $keyStore -storepass:env SIMPLE_VIDEOS_STORE_PASSWORD -keypass:env SIMPLE_VIDEOS_KEY_PASSWORD -alias simple-videos -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Simple Videos' -noprompt
    if ($LASTEXITCODE -ne 0) { throw '创建签名失败' }
} else {
    $securePassword = Get-Content -LiteralPath $passwordFile | ConvertTo-SecureString
    $credential = [PSCredential]::new('simple-videos', $securePassword)
    $env:SIMPLE_VIDEOS_STORE_PASSWORD = $credential.GetNetworkCredential().Password
    $env:SIMPLE_VIDEOS_KEY_PASSWORD = $env:SIMPLE_VIDEOS_STORE_PASSWORD
}
$env:SIMPLE_VIDEOS_KEYSTORE = $keyStore
try {
    Push-Location (Join-Path $projectRoot 'android')
    $buildArguments = @('assembleRelease')
    if ($SkipLint) {
        $buildArguments += @('-x', 'lintVitalRelease', '-x', 'lintVitalAnalyzeRelease', '-x', 'lintVitalReportRelease')
    }
    & .\gradlew.bat @buildArguments
    if ($LASTEXITCODE -ne 0) { throw 'Android 构建失败' }
    Copy-Item -LiteralPath 'app\build\outputs\apk\release\app-release.apk' -Destination (Join-Path $projectRoot 'Simple-videos-1.0.21.apk')
} finally {
    Pop-Location
    Remove-Item Env:SIMPLE_VIDEOS_KEYSTORE -ErrorAction SilentlyContinue
    Remove-Item Env:SIMPLE_VIDEOS_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SIMPLE_VIDEOS_KEY_PASSWORD -ErrorAction SilentlyContinue
}
