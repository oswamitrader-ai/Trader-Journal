package com.tradelock.shield

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.webkit.JavascriptInterface
import com.getcapacitor.BridgeActivity
import org.json.JSONObject

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Inicia o Serviço de Primeiro Plano PERSISTENTE 24/7
        TradeLockForegroundService.startService(this)

        // 2. Solicita isenção de otimização de bateria do Android (Doze Mode)
        requestIgnoreBatteryOptimization()

        // 3. Configura a ponte JS com o WebView
        bridge?.webView?.let { webView ->
            webView.addJavascriptInterface(TradeLockAndroidBridge(this), "TradeLockAndroidBridge")
            webView.post {
                webView.loadUrl("https://localhost/mobile.html")
            }
        }
    }

    private fun requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            val packageName = packageName
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    try {
                        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                        startActivity(intent)
                    } catch (ex: Exception) {
                        ex.printStackTrace()
                    }
                }
            }
        }
    }

    inner class TradeLockAndroidBridge(private val context: Context) {
        @JavascriptInterface
        fun setUserEmail(email: String) {
            if (email.isNotBlank()) {
                TradeLockNativeSync.saveUserEmail(context, email)
            }
        }

        @JavascriptInterface
        fun onLockStateChanged(jsonState: String) {
            try {
                val json = JSONObject(jsonState)
                val isLockActive = json.optBoolean("isLockActive", false)
                val reason = json.optString("reason", "Trava Anti-Fúria Ativa")
                val email = json.optString("userEmail", "")

                if (email.isNotBlank()) {
                    TradeLockNativeSync.saveUserEmail(context, email)
                }

                TradeLockAccessibilityService.isAntiFuriaActive = isLockActive
                TradeLockAccessibilityService.lockReason = reason

                if (isLockActive) {
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
