<#
  fix_freeswitch_microsip.ps1
  Run this in an ADMINISTRATOR PowerShell whenever MicroSIP can't connect to FreeSWITCH.

  What it does:
  - Forces FreeSWITCH to auto-detect its IP instead of using a hardcoded one or VPN's fake "local" IP
  - Stops FreeSWITCH from using STUN for external IP (which leaks your VPN's public exit IP)
  - Copies the latest ai_agent_handler.lua (pointing at the live Render backend) into FreeSWITCH
  - Clears stale pid/db locks and restarts FreeSWITCH cleanly
#>

$ErrorActionPreference = "Stop"
$fsRoot = "C:\Program Files\FreeSWITCH"
$repoRoot = "D:\Projects\Markova Projects\Markova Ai Call Center\ai call center"

Write-Host "`n=== 1. Stopping FreeSWITCH and clearing stale locks ===" -ForegroundColor Cyan
Stop-Process -Name freeswitch -Force -ErrorAction SilentlyContinue
Stop-Process -Name FreeSwitchConsole -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Remove-Item "$fsRoot\run\freeswitch.pid" -Force -ErrorAction SilentlyContinue
Remove-Item "$fsRoot\db\*.db" -Force -ErrorAction SilentlyContinue

Write-Host "`n=== 2. Patching vars.xml to force auto IP detection ===" -ForegroundColor Cyan
$varsPath = "$fsRoot\conf\vars.xml"
if (Test-Path $varsPath) {
    $content = Get-Content $varsPath -Raw

    if ($content -notmatch 'local_ip_v4=') {
        $content = $content -replace '<include>', "<include>`r`n  <X-PRE-PROCESS cmd=`"set`" data=`"local_ip_v4=auto`"/>"
        Write-Host "  Inserted local_ip_v4 override." -ForegroundColor Green
    } else {
        $content = $content -replace 'data="local_ip_v4=[^"]*"', "data=`"local_ip_v4=auto`""
        Write-Host "  Updated existing local_ip_v4 override." -ForegroundColor Green
    }

    $content = $content -replace '<X-PRE-PROCESS cmd="stun-set" data="external_rtp_ip=stun:stun\.freeswitch\.org"/>', "<X-PRE-PROCESS cmd=`"set`" data=`"external_rtp_ip=auto`"/>"
    $content = $content -replace '<X-PRE-PROCESS cmd="stun-set" data="external_sip_ip=stun:stun\.freeswitch\.org"/>', "<X-PRE-PROCESS cmd=`"set`" data=`"external_sip_ip=auto`"/>"
    $content = $content -replace 'data="external_rtp_ip=[^"]*"', "data=`"external_rtp_ip=auto`""
    $content = $content -replace 'data="external_sip_ip=[^"]*"', "data=`"external_sip_ip=auto`""

    Set-Content -Path $varsPath -Value $content -Encoding UTF8
    Write-Host "  vars.xml patched." -ForegroundColor Green
} else {
    Write-Host "  Warning: vars.xml not found." -ForegroundColor Yellow
}

Write-Host "`n=== 3. Copying latest ai_agent_handler.lua ===" -ForegroundColor Cyan
$sourceLua = "$repoRoot\freeswitch_config\scripts\ai_agent_handler.lua"
$targetLua = "$fsRoot\scripts\ai_agent_handler.lua"

if (Test-Path $sourceLua) {
    Copy-Item -Path $sourceLua -Destination $targetLua -Force
    Write-Host "  Successfully copied ai_agent_handler.lua to FreeSWITCH." -ForegroundColor Green
} else {
    Write-Host "  Warning: $sourceLua not found." -ForegroundColor Yellow
}

Write-Host "`n=== 4. Starting FreeSWITCH ===" -ForegroundColor Cyan
Start-Process -FilePath "$fsRoot\FreeSwitchConsole.exe" -WorkingDirectory $fsRoot
Write-Host "  FreeSWITCH started successfully in a new window!" -ForegroundColor Green

Write-Host "`nAll done. You can now connect MicroSIP and dial 8888." -ForegroundColor Cyan
