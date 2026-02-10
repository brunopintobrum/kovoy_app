$ErrorActionPreference = "Stop"

function Get-DotEnvValue([string]$path, [string]$key) {
  if (-not (Test-Path $path)) {
    throw "Missing file: $path"
  }

  $line = Get-Content $path | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return ($line -replace "^$key=", "")
}

$envPath = Join-Path $PSScriptRoot "..\\.env"

$apiToken = Get-DotEnvValue $envPath "GLITCHTIP_API_TOKEN"
$baseUrl = Get-DotEnvValue $envPath "GLITCHTIP_PUBLIC_ORIGIN"
$webhookBase = Get-DotEnvValue $envPath "GLITCHTIP_GITHUB_ISSUES_WEBHOOK_URL"
$webhookToken = Get-DotEnvValue $envPath "GLITCHTIP_GITHUB_ISSUES_WEBHOOK_TOKEN"

if (-not $apiToken) { throw "Missing GLITCHTIP_API_TOKEN in .env" }
if (-not $baseUrl) { $baseUrl = "http://localhost:8000" }
if (-not $webhookBase) { throw "Missing GLITCHTIP_GITHUB_ISSUES_WEBHOOK_URL in .env" }
if (-not $webhookToken) { throw "Missing GLITCHTIP_GITHUB_ISSUES_WEBHOOK_TOKEN in .env" }

$orgSlug = "kovoy-app"
$projects = @("kovoy-backend", "kovoy-frontend")

$headers = @{ Authorization = "Bearer $apiToken" }
$targetUrl = $webhookBase + "?token=" + $webhookToken

foreach ($projectSlug in $projects) {
  $endpoint = "$baseUrl/api/0/projects/$orgSlug/$projectSlug/alerts/"

  $alerts = Invoke-RestMethod -Method Get -Uri $endpoint -Headers $headers

  $hasWebhook = $false
  foreach ($a in @($alerts)) {
    foreach ($r in @($a.alertRecipients)) {
      if ($r.recipientType -eq "webhook" -and $r.url -eq $targetUrl) {
        $hasWebhook = $true
      }
    }
  }

  if ($hasWebhook) {
    Write-Output "[$projectSlug] already configured"
    continue
  }

  # Smallest threshold available: if GlitchTip sees at least 1 event in a 1-minute window, it can notify.
  $body = @{
    name = "GitHub Issues (Webhook)"
    alertRecipients = @(@{ recipientType = "webhook"; url = $targetUrl })
    timespanMinutes = 1
    quantity = 1
    uptime = $false
  } | ConvertTo-Json -Depth 10

  $resp = Invoke-WebRequest -SkipHttpErrorCheck -Method Post -Uri $endpoint -Headers $headers -ContentType "application/json" -Body $body
  if ($resp.StatusCode -ne 201) {
    throw "[$projectSlug] Failed to create alert. HTTP $($resp.StatusCode): $($resp.Content)"
  }

  Write-Output "[$projectSlug] configured"
}

