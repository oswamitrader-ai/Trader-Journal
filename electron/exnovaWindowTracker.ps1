param([int]$ParentProcessId = 0)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class ExnovaWindowTracker {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,int a,out Rect r,int size);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  public static object Snapshot() {
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    var foreground = GetForegroundWindow();
    foreach(var process in Process.GetProcessesByName("Exnova")) {
      using(process) {
        var h = process.MainWindowHandle;
        if(h == IntPtr.Zero || !IsWindowVisible(h)) continue;
        Rect r;
        if(DwmGetWindowAttribute(h,9,out r,16) != 0 && !GetWindowRect(h,out r)) continue;
        return new { handle=h.ToInt64().ToString(), visible=!IsIconic(h), foreground=h==foreground,
          bounds=new {x=r.Left,y=r.Top,width=r.Right-r.Left,height=r.Bottom-r.Top} };
      }
    }
    return new { visible=false, foreground=false };
  }
}
'@
while ($ParentProcessId -eq 0 -or (Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue)) {
  [ExnovaWindowTracker]::Snapshot() | ConvertTo-Json -Compress
  Start-Sleep -Milliseconds 100
}
