param(
  [string] $TitlePattern = 'Exnova',
  [int] $MaxNodesPerWindow = 5000,
  [int] $MaxDepth = 24,
  [string] $OutputPath = ''
)

$ErrorActionPreference = 'Stop'

try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class TradeLockProbeWindows {
  public sealed class WindowInfo {
    public IntPtr Handle { get; set; }
    public int ProcessId { get; set; }
    public string Title { get; set; }
  }

  private delegate bool EnumWindowsCallback(IntPtr handle, IntPtr state);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr state);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr handle, StringBuilder text, int maxCount);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr handle, out int processId);

  public static WindowInfo[] GetVisibleWindows() {
    var windows = new List<WindowInfo>();
    EnumWindows((handle, state) => {
      if (!IsWindowVisible(handle)) return true;
      var buffer = new StringBuilder(1024);
      GetWindowText(handle, buffer, buffer.Capacity);
      int processId;
      GetWindowThreadProcessId(handle, out processId);
      windows.Add(new WindowInfo { Handle = handle, ProcessId = processId, Title = buffer.ToString() });
      return true;
    }, IntPtr.Zero);
    return windows.ToArray();
  }
}
'@
} catch {
  Write-Error "Não foi possível carregar a Automação de Interface do Windows: $($_.Exception.Message)"
  exit 2
}

if ($MaxNodesPerWindow -lt 1 -or $MaxDepth -lt 1) {
  Write-Error 'MaxNodesPerWindow e MaxDepth precisam ser maiores que zero.'
  exit 2
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutputPath = Join-Path $env:TEMP "tradelock-exnova-uia-$stamp.json"
}

function Get-SafeValue {
  param([scriptblock] $Read)
  try { & $Read } catch { $null }
}

$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
 $windows = @(
  foreach ($candidate in [TradeLockProbeWindows]::GetVisibleWindows()) {
    $owner = Get-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue
    if ($candidate.Title -match $TitlePattern -or ($owner -and $owner.ProcessName -match $TitlePattern)) {
      [pscustomobject]@{
        Handle = $candidate.Handle
        ProcessId = $candidate.ProcessId
        WindowTitle = $candidate.Title
      }
    }
  }
)

if ($windows.Count -eq 0) {
  Write-Output "Nenhuma janela com título correspondente a '$TitlePattern' foi encontrada."
  Write-Output 'Confirme se a Exnova está aberta e visível na mesma sessão do Windows.'
  exit 1
}

$results = [System.Collections.Generic.List[object]]::new()

foreach ($window in $windows) {
  $process = Get-Process -Id $window.ProcessId -ErrorAction SilentlyContinue
  $windowResult = [ordered]@{
    processId = $window.ProcessId
    processName = if ($process) { $process.ProcessName } else { $null }
    windowTitle = $window.WindowTitle
    nodeCount = 0
    truncated = $false
    elements = @()
  }

  try {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($window.Handle)
    $queue = [System.Collections.Generic.Queue[object]]::new()
    $queue.Enqueue([pscustomobject]@{ Element = $root; Depth = 0 })
    $elements = [System.Collections.Generic.List[object]]::new()

    while ($queue.Count -gt 0) {
      if ($elements.Count -ge $MaxNodesPerWindow) {
        $windowResult.truncated = $true
        break
      }

      $entry = $queue.Dequeue()
      $element = $entry.Element
      $depth = $entry.Depth

      $current = Get-SafeValue { $element.Current }
      if ($null -eq $current) { continue }

      $value = Get-SafeValue { $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value }
      $text = Get-SafeValue {
        $pattern = $element.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern)
        $pattern.DocumentRange.GetText(2000)
      }
      $bounds = Get-SafeValue {
        $rect = $current.BoundingRectangle
        if ($rect.IsEmpty) { $null }
        else { [ordered]@{ x = [Math]::Round($rect.X, 1); y = [Math]::Round($rect.Y, 1); width = [Math]::Round($rect.Width, 1); height = [Math]::Round($rect.Height, 1) } }
      }

      $elements.Add([ordered]@{
        depth = $depth
        name = $current.Name
        controlType = $current.ControlType.ProgrammaticName
        automationId = $current.AutomationId
        className = $current.ClassName
        helpText = $current.HelpText
        isEnabled = $current.IsEnabled
        isOffscreen = $current.IsOffscreen
        bounds = $bounds
        value = $value
        text = $text
      })

      if ($depth -ge $MaxDepth) { continue }

      $child = Get-SafeValue { $walker.GetFirstChild($element) }
      while ($null -ne $child) {
        $queue.Enqueue([pscustomobject]@{ Element = $child; Depth = $depth + 1 })
        $next = Get-SafeValue { $walker.GetNextSibling($child) }
        if ($null -eq $next -or [object]::ReferenceEquals($next, $child)) { break }
        $child = $next
      }
    }

    $windowResult.nodeCount = $elements.Count
    $windowResult.elements = @($elements.ToArray())
  } catch {
    $windowResult.error = $_.Exception.Message
  }

  $results.Add($windowResult)
}

$report = [ordered]@{
  capturedAt = (Get-Date).ToString('o')
  readOnly = $true
  titlePattern = $TitlePattern
  processBitness = [IntPtr]::Size * 8
  windows = @($results.ToArray())
}

$json = ConvertTo-Json -InputObject $report -Depth 10
$parent = Split-Path -Parent $OutputPath
if ($parent -and -not (Test-Path -LiteralPath $parent)) {
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8

$total = ($results | Measure-Object -Property nodeCount -Sum).Sum
Write-Output "Sonda concluída. Janelas: $($results.Count); elementos acessíveis: $total."
Write-Output "Relatório salvo localmente em: $OutputPath"
if ($results | Where-Object { $_.truncated }) {
  Write-Output 'A leitura atingiu o limite de elementos; use -MaxNodesPerWindow para ampliar se necessário.'
}
