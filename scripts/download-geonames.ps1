$ErrorActionPreference = "Stop"

$baseDir = Join-Path $PSScriptRoot "..\\data\\geonames"
if (!(Test-Path $baseDir)) {
    New-Item -ItemType Directory -Path $baseDir | Out-Null
}

$countryUrl = "https://download.geonames.org/export/dump/countryInfo.txt"
$adminUrl = "https://download.geonames.org/export/dump/admin1CodesASCII.txt"
$citiesUrl = "https://download.geonames.org/export/dump/cities15000.zip"

$countryPath = Join-Path $baseDir "countryInfo.txt"
$adminPath = Join-Path $baseDir "admin1CodesASCII.txt"
$citiesZipPath = Join-Path $baseDir "cities15000.zip"
$citiesTxtPath = Join-Path $baseDir "cities15000.txt"

Write-Host "Downloading countryInfo.txt..."
Invoke-WebRequest -Uri $countryUrl -OutFile $countryPath

Write-Host "Downloading admin1CodesASCII.txt..."
Invoke-WebRequest -Uri $adminUrl -OutFile $adminPath

Write-Host "Downloading cities15000.zip..."
Invoke-WebRequest -Uri $citiesUrl -OutFile $citiesZipPath

Write-Host "Extracting cities15000.zip..."
Expand-Archive -Path $citiesZipPath -DestinationPath $baseDir -Force

if (!(Test-Path $citiesTxtPath)) {
    Write-Error "cities15000.txt not found after extraction."
    exit 1
}

Write-Host "Done."
