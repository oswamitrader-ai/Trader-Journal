package com.tradelock.shield

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import com.getcapacitor.BridgeActivity
import org.json.JSONObject

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        bridge?.webView?.let { webView ->
            webView.addJavascriptInterface(TradeLockAndroidBridge(this), "TradeLockAndroidBridge")
            webView.post {
                webView.loadUrl("https://localhost/mobile.html")
            }
        }
    }

    inner class TradeLockAndroidBridge(private val context: Context) {
        @JavascriptInterface
        fun onLockStateChanged(jsonState: String) {
            try {
                val json = JSONObject(jsonState)
                val isLockActive = json.optBoolean("isLockActive", false)
                val isStopHit = json.optBoolean("isStopHit", false)
                val reason = json.optString("reason", "Stop Loss Diário Atingido")

                TradeLockAccessibilityService.isAntiFuriaActive = isLockActive && isStopHit
                TradeLockAccessibilityService.lockReason = reason

                if (isLockActive && isStopHit) {
                    val vpnIntent = Intent(context, TradeLockVpnService::class.java).apply {
                        action = TradeLockVpnService.ACTION_CONNECT
                    }
                    context.startService(vpnIntent)
                } else {
                    val vpnIntent = Intent(context, TradeLockVpnService::class.java).apply {
                        action = TradeLockVpnService.ACTION_DISCONNECT
                    }
                    context.startService(vpnIntent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
