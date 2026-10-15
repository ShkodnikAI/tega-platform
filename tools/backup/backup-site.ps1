<#
 Monthly backup of the site's persistent disk (/data on Render) to this computer.
 Archive is encrypted with age (public key), so the file is safe on any drive.

 One-time setup:
   1) ssh-keygen -t ed25519            (Enter, Enter, Enter)
   2) Render -> Account Settings -> SSH Public Keys -> add the content of %USERPROFILE%\.ssh\id_ed25519.pub
   3) test:  ssh srv-db6h9sbl550s73at0gdg@ssh.frankfurt.render.com "ls /data"
   4) .\backup-site.ps1 -PublicKey age1... -Register      (creates the monthly Windows scheduled task)

 Restore:  age -d -i tega-norms.key -o b.tar.gz tega-data-YYYY-MM-DD.tar.gz.age ; tar xzf b.tar.gz
#>
param(
  [Parameter(Mandatory = $true)][string]$PublicKey,
  [string]$Dest = "$env:USERPROFILE\Backups\tega",
  [string]$Ssh = "srv-db6h9sbl550s73at0gdg@ssh.frankfurt.render.com",
  [int]$Keep = 12,
  [switch]$Register
)
$ErrorActionPreference = "Stop"
foreach ($t in "ssh", "age") { if (-not (Get-Command $t -ErrorAction SilentlyContinue)) { throw "$t not found" } }
New-Item -ItemType Directory -Force $Dest | Out-Null

if ($Register) {
  $self = $MyInvocation.MyCommand.Path
  $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$self`" -PublicKey $PublicKey -Dest `"$Dest`""
  $act = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg
  $trg = New-ScheduledTaskTrigger -Weekly -WeeksInterval 4 -DaysOfWeek Sunday -At 12:00
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun:$false
  Register-ScheduledTask -TaskName "TEGA site backup" -Action $act -Trigger $trg -Settings $set -Force | Out-Null
  "Scheduled task 'TEGA site backup' created (every 4 weeks, Sunday 12:00; runs at next start if the PC was off)."
  return
}

$out = Join-Path $Dest ("tega-data-{0:yyyy-MM-dd}.tar.gz.age" -f (Get-Date))
$tmp = "$out.part"
# cmd.exe keeps the pipe binary-safe (PowerShell 5.1 would re-encode it)
cmd /c "ssh -o BatchMode=yes $Ssh `"tar czf - -C /data .`" | age -r $PublicKey -o `"$tmp`""
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tmp) -or (Get-Item $tmp).Length -lt 200) { Remove-Item $tmp -ErrorAction SilentlyContinue; throw "backup failed" }
Move-Item -Force $tmp $out
Get-ChildItem $Dest -Filter "tega-data-*.age" | Sort-Object Name -Descending | Select-Object -Skip $Keep | Remove-Item
"{0}  {1:N1} MB" -f $out, ((Get-Item $out).Length / 1MB)
