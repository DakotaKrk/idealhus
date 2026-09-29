<#
  Laddar upp hemsidan till Loopias webbhotell (idealhus.se) med krypterad
  FTP - explicit FTP över TLS, som Loopia rekommenderar.

  Kör i PowerShell, i mappen idealhus:
      powershell -ExecutionPolicy Bypass -File .\publicera.ps1

  Du skriver själv in FTP-användaren och lösenordet från Loopias kundzon.
  De sparas ingenstans. Bara filerna i publicera-filer.txt laddas upp
  (listan skrivs av _extra.py). Se vad som skulle laddas upp, utan att
  ladda upp något:
      powershell -ExecutionPolicy Bypass -File .\publicera.ps1 -Prova
#>
param([switch]$Prova)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# Loggen visar hur det gick, utan användarnamn och lösenord.
$Logg = Join-Path $env:TEMP 'idealhus-publicera.log'
Set-Content -LiteralPath $Logg -Value ("Start " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -Encoding UTF8
function Logga([string]$rad) {
    Write-Host $rad
    Add-Content -LiteralPath $Logg -Value $rad -Encoding UTF8
}
trap {
    Logga ("FEL: " + $_.Exception.Message)
    Write-Host ""
    Read-Host 'Något gick fel (se ovan). Tryck Enter för att stänga'
    exit 1
}

$Server = 'ftpcluster.loopia.se'
$Doman = 'idealhus.se'

$filer = @(Get-Content -LiteralPath 'publicera-filer.txt' -Encoding UTF8 |
    Where-Object { $_ -and -not $_.StartsWith('#') })
$saknas = @($filer | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($saknas.Count) { throw ("Filer saknas: " + ($saknas -join ', ') + " - kör byggskripten först.") }
$storlek = ($filer | ForEach-Object { (Get-Item -LiteralPath $_ -Force).Length } | Measure-Object -Sum).Sum
Write-Host ("{0} filer, {1:N1} MB" -f $filer.Count, ($storlek / 1MB))

if ($Prova) {
    $filer | ForEach-Object { Write-Host "  $_" }
    return
}

Write-Host ""
Write-Host "Ladda upp Idealhus till Loopia" -ForegroundColor Cyan
Write-Host ""

# Uppladdningen görs av curl, som finns i Windows. curl frågar själv
# efter lösenordet en gång och skickar det exakt som det skrivs - .NET:s
# egen FTP-klient fick inte in lösenordet hos Loopia.
$curl = Join-Path $env:SystemRoot 'System32\curl.exe'
if (-not (Test-Path -LiteralPath $curl)) { throw "Hittar inte curl.exe i Windows." }

# Lösenordet skrivs i Windows vanliga inloggningsruta - där går det att
# skriva och klistra in som i vilken ruta som helst. Det lämnas direkt
# till curl via standard in, så det syns inte på skärmen eller i loggen.
$kred = Get-Credential -UserName 'idealhus.se' -Message 'Lösenordet för FTP-kontot hos Loopia. Du kan klistra in med Ctrl+V.'
if (-not $kred) { throw "Avbrutet - inget lösenord angavs." }
$anvandare = $kred.UserName.TrimStart('\')
$losen = $kred.GetNetworkCredential().Password
function Citera([string]$t) { return $t.Replace([string][char]92, [string][char]92 + [char]92).Replace('"', [string][char]92 + '"') }
$config = 'user = "' + (Citera $anvandare) + ':' + (Citera $losen) + '"'
$losen = $null

# FTP-kontot har "Hela hemkatalogen", så domänens mapp ligger under roten.
$rot = "$Doman/public_html"
# TLS 1.2: med TLS 1.3 begärde Loopias server omförhandling mitt i
# överföringen, och flera filer blev tomma på servern.
$grund = @('--ssl-reqd', '--ssl-no-revoke', '--tls-max', '1.2', '--ftp-create-dirs', '--ftp-pasv',
           '--fail', '--show-error', '--silent', '--retry', '2')

function LaddaUpp([string[]]$lista, [string]$cfg) {
    $arg = $grund + @('--config', $cfg)
    foreach ($fil in $lista) { $arg += @('--upload-file', $fil, "ftp://$Server/$rot/$fil") }
    & $curl @arg
    return $LASTEXITCODE
}

# Filen på webben ska vara lika stor som filen här. .htaccess visas
# aldrig på webben och kan inte kontrolleras så.
function Felaktiga([string[]]$lista) {
    $fel = @()
    foreach ($fil in $lista) {
        if ($fil -eq '.htaccess') { continue }
        $lokal = (Get-Item -LiteralPath $fil -Force).Length
        $webb = & $curl --silent --ssl-no-revoke --output NUL --write-out '%{size_download}' "https://$Doman/$fil`?kontroll=$([guid]::NewGuid().ToString('N'))"
        if ([int64]$webb -ne $lokal) { $fel += $fil }
    }
    return ,$fel
}

Logga "Laddar upp $($filer.Count) filer som $anvandare ..."
# Uppgifterna till curl i en tillfällig fil (UTF-8 utan BOM - Windows
# PowerShell lade annars ett osynligt tecken först som curl inte förstod).
# Filen tas bort direkt efteråt, vad som än händer.
$tillfallig = Join-Path $env:TEMP ('idealhus-' + [guid]::NewGuid().ToString('N') + '.cfg')
try {
    [System.IO.File]::WriteAllText($tillfallig, $config + "`n", (New-Object System.Text.UTF8Encoding $false))
    $config = $null
    $kod = LaddaUpp $filer $tillfallig
    if ($kod -eq 67) { throw "Loopia godkände inte användarnamnet eller lösenordet (curl 67). Kontrollera lösenordet på FTP-kontot." }
    if ($kod -ne 0) { throw "Uppladdningen avbröts (curl-kod $kod)." }

    # Kontrollera och ladda upp igen det som inte blev rätt, upp till tre varv.
    for ($varv = 1; $varv -le 3; $varv++) {
        Logga "Kontrollerar filerna på https://$Doman ..."
        $fel = Felaktiga $filer
        if ($fel.Count -eq 0) { break }
        Logga ("{0} filer blev inte rätt, laddar upp dem igen: {1}" -f $fel.Count, ($fel -join ', '))
        $kod = LaddaUpp $fel $tillfallig
        if ($kod -ne 0) { throw "Omladdningen avbröts (curl-kod $kod)." }
    }
    $fel = Felaktiga $filer
    if ($fel.Count) { throw ("Dessa filer blev fortfarande inte rätt: " + ($fel -join ', ')) }
} finally {
    Remove-Item -LiteralPath $tillfallig -Force -ErrorAction SilentlyContinue
}

Logga "Klart. Alla $($filer.Count) filer är uppladdade och kontrollerade på https://$Doman."
Write-Host ""
Read-Host 'Klart! Tryck Enter för att stänga fönstret'
