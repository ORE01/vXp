$ErrorActionPreference="Stop"

function Patch-File($path, $repls) {
  if (-not (Test-Path $path)) { Write-Host "SKIP missing: $path"; return }
  $c = Get-Content $path -Raw -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($c)) { Write-Host "SKIP empty: $path"; return }
  $orig = $c
  foreach ($k in $repls.Keys) { $c = $c.Replace($k, $repls[$k]) }
  if ($c -ne $orig) {
    Set-Content -Path $path -Value $c -Encoding UTF8
    Write-Host "UPDATED: $path"
  } else {
    Write-Host "NOCHANGE: $path"
  }
}

# --- PORT.js (features/SELECT_PORTFOLIO) ---
# Fix wrong UI path + wrong renderer.js path + utils paths
Patch-File "src\renderer\features\SELECT_PORTFOLIO\PORT.js" @{
  "features/UI/"      = "core/ui/"                 # defensive
  "../UI/"            = "../../core/ui/"
  "../../UI/"         = "../../core/ui/"
  "features/renderer.js" = "../../renderer.js"
  "../renderer.js"    = "../../renderer.js"
  "./renderer.js"     = "../../renderer.js"
  "../utils/"         = "../../../utils/"
  "../../utils/"      = "../../../utils/"
  "../charts/"        = "../../../charts/"
  "../../charts/"     = "../../../charts/"
}

# --- MVaR.js (features/ANALYSE_PORTFOLIO/MARKET_RISK) ---
Patch-File "src\renderer\features\ANALYSE_PORTFOLIO\MARKET_RISK\MVaR.js" @{
  "features/UI/"         = "core/ui/"
  "../UI/"               = "../../../core/ui/"
  "../../UI/"            = "../../../core/ui/"
  "features/renderer.js" = "../../../renderer.js"
  "../renderer.js"       = "../../../renderer.js"
  "../utils/"            = "../../../../utils/"
  "../../utils/"         = "../../../../utils/"
  "../charts/"           = "../../../../charts/"
  "../../charts/"        = "../../../../charts/"
}

# --- CVaR.js (features/ANALYSE_PORTFOLIO/CREDIT_RISK) ---
Patch-File "src\renderer\features\ANALYSE_PORTFOLIO\CREDIT_RISK\CVaR.js" @{
  "../utils/"      = "../../../../utils/"
  "../../utils/"   = "../../../../utils/"
  "../charts/"     = "../../../../charts/"
  "../../charts/"  = "../../../../charts/"
}

# --- ML.js (features/MARKET_DATA/FORCASTING) ---
Patch-File "src\renderer\features\MARKET_DATA\FORCASTING\ML.js" @{
  "../utils/"      = "../../../../utils/"
  "../../utils/"   = "../../../../utils/"
  "../charts/"     = "../../../../charts/"
  "../../charts/"  = "../../../../charts/"
}

# --- saveHistoricRiskMetrics.js (features/ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS) ---
Patch-File "src\renderer\features\ANALYSE_PORTFOLIO\HISTORIC_RISK_METRICS\saveHistoricRiskMetrics.js" @{
  "features/UI/" = "core/ui/"
  "../UI/"       = "../../../core/ui/"
  "../../UI/"    = "../../../core/ui/"
}

# --- CustomerReportsPresetUI.js (features/REPORTS) ---
Patch-File "src\renderer\features\REPORTS\CustomerReportsPresetUI.js" @{
  "renderer/renderer/renderer.js" = "../../renderer.js"
  "features/renderer.js"          = "../../renderer.js"
  "../renderer.js"                = "../../renderer.js"
  "../utils/"                     = "../../../utils/"
  "../../utils/"                  = "../../../utils/"
}

# --- SummaryMarketRisk.js (features/ANALYSE_PORTFOLIO) ---
Patch-File "src\renderer\features\ANALYSE_PORTFOLIO\SummaryMarketRisk.js" @{
  "renderer/renderer/UI/panels.js" = "../../core/ui/panels.js"
  "../UI/panels.js"                = "../../core/ui/panels.js"
  "./UI/panels.js"                 = "../../core/ui/panels.js"
}

# --- core/ui/MODAL_HELPER/ModalActionHandler.js ---
Patch-File "src\renderer\core\ui\MODAL_HELPER\ModalActionHandler.js" @{
  "../renderer.js"      = "../../../renderer.js"
  "../../renderer.js"   = "../../../renderer.js"
  "../utils/"           = "../../../../utils/"
  "../../utils/"        = "../../../../utils/"
}

# --- core/bootstrap/bootstrapBindings.js: tabs.js ---
Patch-File "src\renderer\core\bootstrap\bootstrapBindings.js" @{
  "../utils/"      = "../../../utils/"
  "../../utils/"   = "../../../utils/"
}

Write-Host "DONE"
