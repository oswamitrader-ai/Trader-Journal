package com.tradelock.shield

import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import java.io.FileInputStream

/** Optional network block for broker packages only. Other apps keep their normal connection. */
class TradeLockVpnService : VpnService() {
    companion object {
        const val ACTION_CONNECT="com.tradelock.shield.START_VPN"
        const val ACTION_DISCONNECT="com.tradelock.shield.STOP_VPN"
    }
    private var tunnel: ParcelFileDescriptor?=null
    private var worker: Thread?=null
    @Volatile private var running=false
    override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int {
        if(intent?.action==ACTION_DISCONNECT || !TradeLockAccessibilityService.isAntiFuriaActive){shutdown();stopSelf();return START_NOT_STICKY}
        if(running)return START_STICKY
        if(prepare(this)!=null){stopSelf();return START_NOT_STICKY}
        try {
            val builder=Builder().setSession("TradeLock — corretoras bloqueadas").addAddress("10.0.0.2",32).addAddress("fd00::2",128)
                .addRoute("0.0.0.0",0).addRoute("::",0).setBlocking(true)
            var packages=0
            for(pkg in TradeLockAccessibilityService.BROKER_PACKAGE_NAMES) {
                try {packageManager.getPackageInfo(pkg,0);builder.addAllowedApplication(pkg);packages++}catch(_:android.content.pm.PackageManager.NameNotFoundException){}
            }
            // An empty allowlist would capture the entire device. Never establish it.
            if(packages==0){stopSelf();return START_NOT_STICKY}
            val descriptor=builder.establish() ?: run {stopSelf();return START_NOT_STICKY}
            tunnel=descriptor;running=true
            worker=Thread {
                try { FileInputStream(descriptor.fileDescriptor).use {input ->
                    val buffer=ByteArray(32767)
                    while(running && input.read(buffer)>=0) { /* Drop only traffic from explicitly blocked broker apps. */ }
                }}catch(_:Exception){}finally{running=false}
            }.apply {name="TradeLockBrokerBlock";start()}
            return START_STICKY
        }catch(_:Exception){shutdown();stopSelf();return START_NOT_STICKY}
    }
    private fun shutdown(){running=false;try{tunnel?.close()}catch(_:Exception){};tunnel=null;worker?.interrupt();worker=null}
    override fun onRevoke(){shutdown();stopSelf();super.onRevoke()}
    override fun onDestroy(){shutdown();super.onDestroy()}
}
