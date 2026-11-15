$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
public class ExnovaFrame {
  [StructLayout(LayoutKind.Sequential)] struct Rect {public int Left,Top,Right,Bottom;}
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd,out Rect bounds);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr dc,uint flags);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  public static string Read(){
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    foreach(var process in Process.GetProcessesByName("Exnova"))using(process){
      var hwnd=process.MainWindowHandle; Rect rect;
      if(hwnd==IntPtr.Zero||IsIconic(hwnd)||!GetWindowRect(hwnd,out rect))continue;
      int w=rect.Right-rect.Left,h=rect.Bottom-rect.Top;
      if(w<400||h<250||w>8192||h>4320)continue;
      using(var image=new Bitmap(w,h)){
        using(var g=Graphics.FromImage(image)){var dc=g.GetHdc();try{if(!PrintWindow(hwnd,dc,2))continue;}finally{g.ReleaseHdc(dc);}}
        // Reject a black GPU surface, even when the title bar was rendered.
        int colored=0;
        for(int y=h/5;y<h*4/5;y+=8)for(int x=w/8;x<w*7/8;x+=8){var c=image.GetPixel(x,y);if(Math.Max(c.R,Math.Max(c.B,c.G))-Math.Min(c.R,Math.Min(c.B,c.G))>30)colored++;}
        if(colored<12)continue;
        using(var ms=new MemoryStream()){image.Save(ms,ImageFormat.Png);return Convert.ToBase64String(ms.ToArray());}
      }
    }
    return "";
  }
}
"@
while($null -ne [Console]::ReadLine()){try{[Console]::WriteLine([ExnovaFrame]::Read())}catch{[Console]::WriteLine('')}}
