<#
  Обновление библиотеки норм НРР из SmrPro (запускается на компьютере владельца, Windows PowerShell).

  Что делает:
    1) берёт из папки базы только нужные таблицы (rscer, mat, meh) и технические части (tech);
    2) упаковывает в zip и шифрует публичным ключом age (расшифровать может только владелец приватного ключа);
    3) загружает зашифрованный файл как релиз в приватный репозиторий (через GitHub CLI);
    4) по желанию перезапускает сайт (Render deploy hook).

  Нужно один раз:  winget install FiloSottile.age ;  winget install GitHub.cli ;  gh auth login
  Запуск:          .\update-norms.ps1 -PublicKey age1... [-Base "D:\SmrPro\Base\NRR2022"] [-DeployHook "https://api.render.com/deploy/srv-...?key=..."]
  Ничего секретного в самом скрипте нет: публичный ключ и хук задаются параметрами.
#>
param(
  [Parameter(Mandatory = $true)][string]$PublicKey,
  [string]$Base = "D:\SmrPro\Base\NRR2022",
  [string]$Repo = "ShkodnikAI/tega-content",
  [string]$DeployHook = ""
)
$ErrorActionPreference = "Stop"

foreach ($tool in "age", "gh") {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Не найден '$tool'. Установите: winget install $(if ($tool -eq 'age') {'FiloSottile.age'} else {'GitHub.cli'})" }
}
if (-not (Test-Path $Base)) { throw "Папка базы не найдена: $Base" }

$tag = "norms-" + (Get-Date -Format "yyyyMMdd-HHmm")
$work = Join-Path $env:TEMP $tag
New-Item -ItemType Directory -Force $work | Out-Null
try {
  $stage = Join-Path $work "stage"
  New-Item -ItemType Directory -Force $stage | Out-Null
  foreach ($n in "rscer", "mat", "meh") {
    $files = Get-ChildItem $Base -File | Where-Object { $_.BaseName -ieq $n -and $_.Extension -imatch '^\.(dat|fpt)$' }
    if ($files.Count -lt 2) { throw "Не найдены таблицы '$n' (.dat и .fpt) в $Base" }
    $files | Copy-Item -Destination $stage
  }
  if (Test-Path (Join-Path $Base "tech")) { Copy-Item (Join-Path $Base "tech") (Join-Path $stage "tech") -Recurse }

  $zip = Join-Path $work "norms.zip"
  Compress-Archive -Path "$stage\*" -DestinationPath $zip -CompressionLevel Optimal -Force
  $enc = Join-Path $work "norms.zip.age"
  & age -r $PublicKey -o $enc $zip
  if ($LASTEXITCODE -ne 0) { throw "age: ошибка шифрования" }

  $hash = (Get-FileHash $enc -Algorithm SHA256).Hash.ToLower()
  $notes = "NRR-2022 bundle. sha256(norms.zip.age)=$hash"
  & gh release create $tag $enc --repo $Repo --title $tag --notes $notes
  if ($LASTEXITCODE -ne 0) { throw "gh: не удалось создать релиз" }
  Write-Host "Загружено: $Repo релиз $tag ($([math]::Round((Get-Item $enc).Length/1MB,1)) МБ), sha256=$hash"

  if ($DeployHook) {
    Invoke-RestMethod -Method Post -Uri $DeployHook | Out-Null
    Write-Host "Сайт отправлен на перезапуск."
  } else {
    Write-Host "Перезапустите сайт вручную (Render -> Manual Deploy), чтобы он подхватил новую версию."
  }
}
finally {
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}
