$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase
Add-Type -ReferencedAssemblies UIAutomationClient,UIAutomationTypes,WindowsBase -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Globalization;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Automation;
public static class ExnovaStakeInput {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X,Y; public POINT(int x,int y){X=x;Y=y;} }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT {public int dx,dy;public uint mouseData,dwFlags,time;public UIntPtr dwExtraInfo;}
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT {public ushort wVk,wScan;public uint dwFlags,time;public UIntPtr dwExtraInfo;}
  [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION {[FieldOffset(0)]public MOUSEINPUT mi;[FieldOffset(0)]public KEYBDINPUT ki;}
  [StructLayout(LayoutKind.Sequential)] public struct INPUT {public uint type;public INPUTUNION data;}
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint flags);
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,int a,out RECT r,int size);
  [DllImport("user32.dll")] static extern uint SendInput(uint count,INPUT[] inputs,int size);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT point);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  static void Guard(IntPtr handle,int x,int y,int width,int height) {
    uint pid; GetWindowThreadProcessId(handle,out pid);
    using(var p=Process.GetProcessById((int)pid)) if(!String.Equals(p.ProcessName,"Exnova",StringComparison.OrdinalIgnoreCase))throw new Exception("Janela não pertence à Exnova.");
    if(GetForegroundWindow()!=handle)throw new Exception("A Exnova perdeu o foco; preenchimento cancelado.");
    RECT r;if(DwmGetWindowAttribute(handle,9,out r,16)!=0 || Math.Abs(r.Left-x)>1 || Math.Abs(r.Top-y)>1 || Math.Abs(r.Right-r.Left-width)>1 || Math.Abs(r.Bottom-r.Top-height)>1)throw new Exception("Janela se moveu; recalibre o campo.");
    foreach(int key in new int[]{1,2,16,17,18,91,92})if((GetAsyncKeyState(key)&0x8000)!=0)throw new Exception("Aguardando finalizar a interação do usuário.");
  }
  static INPUT Key(ushort key,bool up){return new INPUT{type=1,data=new INPUTUNION{ki=new KEYBDINPUT{wVk=key,dwFlags=up?2u:0u}}};}
  static INPUT Text(char value,bool up){return new INPUT{type=1,data=new INPUTUNION{ki=new KEYBDINPUT{wScan=value,dwFlags=4u|(up?2u:0u)}}};}
  public static string Write(long hwnd,int x,int y,int width,int height,int left,int top,int fieldWidth,int fieldHeight,string value) {
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    decimal amount;
    if(!decimal.TryParse(value,NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture,out amount)||amount<=0||amount>100000000)throw new Exception("Valor de entrada inválido.");
    var handle=new IntPtr(hwnd); Guard(handle,x,y,width,height);
    if(left<x+width*.70 || top<y || top+fieldHeight>y+height*.30 || fieldWidth<40 || fieldHeight<20)throw new Exception("Área Invest não validada.");
    int px=left+Math.Min(fieldWidth/3,28),py=top+(int)(fieldHeight*.66);
    var hit=WindowFromPoint(new POINT(px,py));
    if(GetAncestor(hit,2)!=handle){uint hitPid;GetWindowThreadProcessId(hit,out hitPid);string owner="outra janela";try{using(var p=Process.GetProcessById((int)hitPid))owner=p.ProcessName;}catch{}throw new Exception("O campo Invest está encoberto por "+owner+".");}
    // Prefer a writable accessibility value belonging to the observed Invest rectangle.
    var element=AutomationElement.FromPoint(new Point(px,py));
    for(int level=0;element!=null&&level<3;level++,element=TreeWalker.ControlViewWalker.GetParent(element)) {
      var b=element.Current.BoundingRectangle;
      object pattern;
      if(element.Current.ProcessId==(int)GetProcessId(handle) && b.Width<=fieldWidth+12 && b.Height<=fieldHeight+12 && b.Left>=left-8 && b.Top>=top-8 && element.TryGetCurrentPattern(ValuePattern.Pattern,out pattern)) {
        var vp=(ValuePattern)pattern;
        if(!vp.Current.IsReadOnly){Guard(handle,x,y,width,height);vp.SetValue(value);return "uia";}
      }
    }
    // Qt can render this field without ValuePattern. Input stays inside the calibrated
    // amount field, uses only numeric text and Tab, and NEVER sends Enter or order actions.
    Guard(handle,x,y,width,height);
    POINT previousCursor;GetCursorPos(out previousCursor);
    SetCursorPos(px,py);
    var click=new INPUT[]{new INPUT{type=0,data=new INPUTUNION{mi=new MOUSEINPUT{dwFlags=2}}},new INPUT{type=0,data=new INPUTUNION{mi=new MOUSEINPUT{dwFlags=4}}}};
    if(SendInput(2,click,Marshal.SizeOf(typeof(INPUT)))!=2)throw new Exception("Windows recusou o foco no campo.");
    System.Threading.Thread.Sleep(80);
    Guard(handle,x,y,width,height);
    POINT cursor;GetCursorPos(out cursor);
    if(cursor.X!=px || cursor.Y!=py)throw new Exception("Interação do usuário detectada; preenchimento cancelado.");
    var keys=new List<INPUT>{Key(17,false),Key(65,false),Key(65,true),Key(17,true)};
    foreach(char c in value){keys.Add(Text(c,false));keys.Add(Text(c,true));}
    keys.Add(Key(9,false));keys.Add(Key(9,true));
    if(SendInput((uint)keys.Count,keys.ToArray(),Marshal.SizeOf(typeof(INPUT)))!=keys.Count)throw new Exception("Windows recusou o preenchimento.");
    GetCursorPos(out cursor);
    if(cursor.X==px && cursor.Y==py)SetCursorPos(previousCursor.X,previousCursor.Y);
    return "keyboard";
  }
  static uint GetProcessId(IntPtr handle){uint pid;GetWindowThreadProcessId(handle,out pid);return pid;}
}
'@
Write-Output '{"ready":true}'
while ($null -ne ($line = [Console]::ReadLine())) {
  try {
    $r = $line | ConvertFrom-Json
    $mode=[ExnovaStakeInput]::Write([long]$r.handle,[int]$r.bounds.x,[int]$r.bounds.y,[int]$r.bounds.width,[int]$r.bounds.height,[int]$r.field.x,[int]$r.field.y,[int]$r.field.width,[int]$r.field.height,[string]$r.amount)
    @{id=$r.id;ok=$true;mode=$mode} | ConvertTo-Json -Compress
  } catch { @{id=$r.id;ok=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress }
}
