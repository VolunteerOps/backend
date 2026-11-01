# Dot-source this script from PowerShell before building either sibling Android app.
# Only the two public Google Play SDK keys are copied into the current process.
$mobileEnvFile = Join-Path $PSScriptRoot '../.env'
$mobileKeyNames = @('REVENUECAT_ANDROID_API_KEY', 'REVENUECAT_OPS_ANDROID_API_KEY')
foreach ($mobileLine in Get-Content -LiteralPath $mobileEnvFile) {
    if ($mobileLine -match '^(REVENUECAT_ANDROID_API_KEY|REVENUECAT_OPS_ANDROID_API_KEY)=(.*)$') {
        $mobileKeyName = $Matches[1]
        $mobilePublicKey = $Matches[2].Trim().Trim('"').Trim("'")
        if ($mobilePublicKey -notmatch '^goog_[A-Za-z0-9]+$') { throw "Invalid public Google Play key for $mobileKeyName" }
        [Environment]::SetEnvironmentVariable($mobileKeyName, $mobilePublicKey, 'Process')
        Write-Host "$mobileKeyName loaded (value hidden)."
    }
}
foreach ($mobileKeyName in $mobileKeyNames) {
    if (-not [Environment]::GetEnvironmentVariable($mobileKeyName, 'Process')) { throw "Missing $mobileKeyName in backend .env" }
}
Remove-Variable mobilePublicKey, mobileLine, mobileKeyName, mobileKeyNames, mobileEnvFile -ErrorAction SilentlyContinue
