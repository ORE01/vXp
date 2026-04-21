# ============================================================
# PROJECT TREE (relevant files only) – timestamped output
# PowerShell 5.1 + 7 compatible
# ASCII-safe version
# ============================================================

$Root = "C:\Users\wendlert\Desktop\valueXpro_dev\aktuell\electron_app"
$MaxDepth = 6

$ExcludeDirs = @(
  "node_modules",
  "venv",
  "dist",
  "assets",
  "bin",
  "ML_TrainedModels",
  ".git",
  ".vscode",
  "__pycache__"
)

$IncludeExtensions = @("*.js", "*.html", "*.css", "*.json", "*.py")

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$TimestampFile = Get-Date -Format "yyyyMMdd_HHmmss"
$OutFile = Join-Path $Root "project_tree_relevant_$TimestampFile.txt"

$Output = New-Object System.Collections.Generic.List[string]

function Add-Line {
  param([string]$line)
  $Output.Add($line)
}

function Show-Tree {
  param(
    [string]$Path,
    [int]$Depth,
    [string]$Prefix = ""
  )

  if ($Depth -gt $MaxDepth) {
    return
  }

  try {
    $items = Get-ChildItem -Path $Path -Force -ErrorAction Stop |
      Where-Object {
        if ($_.PSIsContainer) {
          $ExcludeDirs -notcontains $_.Name
        }
        else {
          $IncludeExtensions -contains ("*" + $_.Extension)
        }
      } |
      Sort-Object @{ Expression = { -not $_.PSIsContainer } }, Name
  }
  catch {
    Add-Line "$Prefix[ACCESS DENIED OR UNREADABLE: $Path]"
    return
  }

  $count = $items.Count
  $i = 0

  foreach ($item in $items) {
    $i++
    $isLast = ($i -eq $count)

    $branch = if ($isLast) { "\-- " } else { "+-- " }

    Add-Line "$Prefix$branch$($item.Name)"

    if ($item.PSIsContainer) {
      $newPrefix = if ($isLast) { "$Prefix    " } else { "$Prefix|   " }
      Show-Tree -Path $item.FullName -Depth ($Depth + 1) -Prefix $newPrefix
    }
  }
}

# ------------------------------------------------------------
# Header
# ------------------------------------------------------------
Add-Line "PROJECT TREE (relevant files only)"
Add-Line "Generated: $Timestamp"
Add-Line "Root: $Root"
Add-Line "MaxDepth: $MaxDepth"
Add-Line "Excluded dirs: $($ExcludeDirs -join ', ')"
Add-Line "Included: $($IncludeExtensions -join ', ')"
Add-Line ""
Add-Line "electron_app"

Show-Tree -Path $Root -Depth 1

# ------------------------------------------------------------
# Output (console + file)
# ------------------------------------------------------------
$Output | ForEach-Object { Write-Host $_ }
$Output | Out-File -FilePath $OutFile -Encoding UTF8

Write-Host ""
Write-Host "Project tree written to:" -ForegroundColor Green
Write-Host "  $OutFile" -ForegroundColor Cyan


# # ============================================================
# # PROJECT TREE (relevant files only) – with timestamped output
# # PowerShell 5.1 + 7 compatible
# # ============================================================

# $Root = "C:\Users\wendlert\Desktop\valueXpro_dev\aktuell\electron_app"
# $MaxDepth = 6

# $ExcludeDirs = @(
#   "node_modules",
#   "venv",
#   "dist",
#   "assets",
#   "bin",
#   "ML_TrainedModels",
#   ".git",
#   ".vscode",
#   "__pycache__"
# )

# $IncludeExtensions = @("*.js","*.html","*.css","*.json","*.py")

# $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
# $TimestampFile = Get-Date -Format "yyyyMMdd_HHmmss"
# $OutFile = Join-Path $Root "project_tree_relevant_$TimestampFile.txt"

# $Output = New-Object System.Collections.Generic.List[string]

# function Add-Line($line) {
#   $Output.Add($line)
# }

# function Show-Tree($Path, $Depth, $Prefix = "") {
#   if ($Depth -gt $MaxDepth) { return }

#   $items = Get-ChildItem -Path $Path -Force |
#     Where-Object {
#       if ($_.PSIsContainer) {
#         $ExcludeDirs -notcontains $_.Name
#       } else {
#         $IncludeExtensions -contains ("*" + $_.Extension)
#       }
#     }

#   $count = $items.Count
#   $i = 0

#   foreach ($item in $items) {
#     $i++
#     $isLast = ($i -eq $count)
#     $branch = if ($isLast) { "└── " } else { "├── " }

#     Add-Line "$Prefix$branch$($item.Name)"

#     if ($item.PSIsContainer) {
#       $newPrefix = if ($isLast) { "$Prefix    " } else { "$Prefix│   " }
#       Show-Tree $item.FullName ($Depth + 1) $newPrefix
#     }
#   }
# }

# # ------------------------------------------------------------
# # Header
# # ------------------------------------------------------------
# Add-Line "PROJECT TREE (relevant files only)"
# Add-Line "Generated: $Timestamp"
# Add-Line "Root: $Root"
# Add-Line "MaxDepth: $MaxDepth"
# Add-Line "Excluded dirs: $($ExcludeDirs -join ', ')"
# Add-Line "Included: $($IncludeExtensions -join ', ')"
# Add-Line ""
# Add-Line "electron_app"

# Show-Tree $Root 1

# # ------------------------------------------------------------
# # Output (console + file, UTF8 safe)
# # ------------------------------------------------------------
# $Output | ForEach-Object { Write-Host $_ }
# $Output | Out-File -FilePath $OutFile -Encoding UTF8

# Write-Host ""
# Write-Host "✅ Project tree written to:" -ForegroundColor Green
# Write-Host "   $OutFile" -ForegroundColor Cyan
