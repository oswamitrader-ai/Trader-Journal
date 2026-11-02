package com.tradelock.shield

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.Locale
import android.os.Handler
import android.os.Looper

class TradeLockAccessibilityService : AccessibilityService() {

    companion object {
        private var instance: TradeLockAccessibilityService? = null
        fun isConnected() = instance != null
        fun checkCurrentWindow() { instance?.let { service -> service.handler.post { service.enforceCurrentWindow() } } }
        private const val TAG = "TradeLockAccessibility"

        val BROKER_PACKAGE_NAMES = setOf(
            "com.exnova",
            "com.iqoption",
            "com.iqoption.x",
            "com.qxbroker.app",
            "com.quotex.trade",
            "com.pocketoption.app",
            "com.binomo.app",
            "com.olymptrade"
        )

        val BROWSER_PACKAGE_NAMES = setOf(
            "com.android.chrome",
            "org.mozilla.firefox",
            "com.sec.android.app.sbrowser",
            "com.microsoft.emmx",
            "com.opera.browser",
            "com.opera.mini.native",
            "com.brave.browser",
            "com.duckduckgo.mobile.android",
            "com.vivaldi.browser",
            "com.ucmobile.intl"
        )

        val BROKER_KEYWORDS = listOf(
            "exnova",
            "iqoption",
            "quotex",
            "qxbroker",
            "pocketoption",
            "binomo",
            "olymptrade"
        )

        @Volatile
        var isAntiFuriaActive: Boolean = true

        @Volatile
        var lockReason: String = "Stop Loss Diário Atingido (Trava Anti-Fúria)"
    }
    private val handler = Handler(Looper.getMainLooper())
    private var lastOverlayAt = 0L
    private val monitor = object : Runnable {
        override fun run() { enforceCurrentWindow(); handler.postDelayed(this,1000) }
    }
    private fun enforceCurrentWindow() {
        if (!isAntiFuriaActive) return
        val root = rootInActiveWindow ?: return
        val pkg = root.packageName?.toString() ?: return
        if (BROKER_PACKAGE_NAMES.any {pkg==it || pkg.startsWith("$it.")}) launchFullBlockOverlay(pkg)
        else if (BROWSER_PACKAGE_NAMES.contains(pkg) && checkNodeForBrokerKeywords(root)) launchFullBlockOverlay(pkg)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || !isAntiFuriaActive) return

        val packageName = event.packageName?.toString() ?: return

        // 1. Bloqueio direto de apps nativos de corretoras
        if (BROKER_PACKAGE_NAMES.any { packageName==it || packageName.startsWith("$it.") }) {
            Log.e(TAG, "TRAVA ANTI-FÚRIA ATIVA! Bloqueando App de Corretora: $packageName")
            launchFullBlockOverlay(packageName)
            return
        }

        // 2. Bloqueio de navegação web em navegadores mobile (Chrome, Firefox, Samsung Internet, etc.)
        if (BROWSER_PACKAGE_NAMES.contains(packageName)) {
            if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || 
                event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
                event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
                
                val rootNode = rootInActiveWindow
                if (rootNode != null && checkNodeForBrokerKeywords(rootNode)) {
                    Log.e(TAG, "TRAVA ANTI-FÚRIA ATIVA! Detectado site de corretora no navegador: $packageName")
                    launchFullBlockOverlay(packageName)
                }
            }
        }
    }

    private fun checkNodeForBrokerKeywords(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false

        val text = node.text?.toString()?.lowercase(Locale.getDefault()) ?: ""
        val contentDescription = node.contentDescription?.toString()?.lowercase(Locale.getDefault()) ?: ""

        val id = node.viewIdResourceName.orEmpty().lowercase(Locale.ROOT)
        val addressField = listOf("url_bar","url_field","location_bar","address_bar","omnibox").any { id.contains(it) }
        for (keyword in BROKER_KEYWORDS) {
            if (addressField && Regex("(^|[/:.])"+Regex.escape(keyword)+"\\.(com|io|net|org)([/?:#]|$)").containsMatchIn(text)) {
                return true
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i)
            if (checkNodeForBrokerKeywords(child)) {
                return true
            }
        }

        return false
    }

    private fun launchFullBlockOverlay(brokerPackage: String) {
        if (System.currentTimeMillis()-lastOverlayAt < 1200) return
        lastOverlayAt = System.currentTimeMillis()
        try {
            val intent = Intent(this, OverlayBlockActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                putExtra("BROKER_PACKAGE", brokerPackage)
                putExtra("LOCK_REASON", lockReason)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao disparar OverlayBlockActivity em tela cheia", e)
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "TradeLockAccessibilityService interrompido.")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        TradeLockNativeSync.restoreProtection(this)
        TradeLockForegroundService.startService(this)
        handler.post(monitor)
        Log.i(TAG, "TradeLockAccessibilityService conectado e pronto para blindar apps de corretoras!")
    }
    override fun onDestroy() { handler.removeCallbacksAndMessages(null); instance=null; super.onDestroy() }
}
