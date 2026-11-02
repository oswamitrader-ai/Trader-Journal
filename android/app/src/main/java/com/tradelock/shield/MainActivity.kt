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
        fun setAuthSession(session: String) { try { TradeLockNativeSync.acceptSession(context,JSONObject(session)) } catch (_: Exception) {} }

        @JavascriptInterface
        fun getAuthSession(): String = NativeSessionStore.read(context)?.toString() ?: "null"

        @JavascriptInterface
        fun clearAuthSession() { NativeSessionStore.clear(context); TradeLockNativeSync.requestSync() }

        @JavascriptInterface
        fun getProtectionStatus(): String = JSONObject()
            .put("accessibilityEnabled", TradeLockAccessibilityService.isConnected())
            .put("lastSyncedAt", TradeLockNativeSync.getPrefs(context).getLong("native_last_sync",0))
            .put("syncError", TradeLockNativeSync.getPrefs(context).getString("native_sync_error", ""))
            .toString()

        @JavascriptInterface
        fun openAccessibilitySettings() { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
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
                val isLockActive = json.optBoolean("isLockActive", true)
                val reason = json.optString("reason", "Trava Anti-Fúria Ativa")
                val email = json.optString("userEmail", "")

                if (email.isNotBlank()) {
                    TradeLockNativeSync.saveUserEmail(context, email)
                }

                // A JS snapshot may tighten protection; only an authenticated native read can release it.
                if (isLockActive) TradeLockNativeSync.applyProtection(context,true,reason)
                TradeLockNativeSync.requestSync()

            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
