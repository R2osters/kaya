# Lance la simulation d'une des deux apps sur l'émulateur.
#
#   .\scripts\sim.ps1 client
#   .\scripts\sim.ps1 driver
#
# Pourquoi une seule à la fois : les deux dev-clients demandent leur bundle à
# localhost:8081, et `adb reverse` est global au device. Deux Metro sur des
# ports différents ne servent donc à rien tant qu'un seul émulateur tourne —
# l'app qui n'a pas 8081 charge le bundle de l'autre et plante sur un module
# natif qu'elle n'embarque pas. Ce script fait le basculement proprement.
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("client", "driver")]
  [string]$App
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$adb = "D:\tools\android-sdk\platform-tools\adb.exe"
$package = if ($App -eq "client") { "com.kaya.kaya_client" } else { "com.kaya.kaya_driver" }

# 1. Libérer le port 8081, quel que soit le Metro qui l'occupe.
$busy = netstat -ano | Select-String ":8081\s.*LISTENING"
if ($busy) {
  $pid8081 = ($busy[0] -split '\s+')[-1]
  Write-Host "Arrêt du Metro en place (pid $pid8081)"
  Stop-Process -Id $pid8081 -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
}

# 2. Metro pour l'app demandée, enraciné dans SON dossier — un Metro lancé à la
#    racine du monorepo ne résout l'entrée d'aucune des deux apps.
Write-Host "Démarrage de Metro pour $App"
Start-Process -FilePath "npx" -ArgumentList "expo","start","--dev-client","--port","8081" `
  -WorkingDirectory "$root\apps\$App" -WindowStyle Minimized

# 3. Tunnels : Metro et backend vus depuis l'émulateur.
& $adb reverse tcp:8081 tcp:8081 | Out-Null
& $adb reverse tcp:3000 tcp:3000 | Out-Null

# 4. Relancer l'app. Le force-stop est nécessaire : sans lui le dev-client
#    garde le bundle déjà chargé.
Start-Sleep -Seconds 20
& $adb shell am force-stop $package
Start-Sleep -Seconds 2
& $adb shell monkey -p $package -c android.intent.category.LAUNCHER 1 | Out-Null

Write-Host "$App lancée. Le premier bundle prend ~30 s."
