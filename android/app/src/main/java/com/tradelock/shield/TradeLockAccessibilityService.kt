package com.tradelock.shield

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.Locale

class TradeLockAccessibilityService : AccessibilityService() {

    companion object {
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
        var isAntiFuriaActive: Boolean = false

        @Volatile
        var lockReason: String = "Stop Loss Diário Atingido (Trava Anti-Fúria)"
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || !isAntiFuriaActive) return

        val packageName = event.packageName?.toString() ?: return

        // 1. Bloqueio direto de apps nativos de corretoras
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && BROKER_PACKAGE_NAMES.contains(packageName)) {
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

        for (keyword in BROKER_KEYWORDS) {
            if (text.contains(keyword) || contentDescription.contains(keyword)) {
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
        Log.i(TAG, "TradeLockAccessibilityService conectado e pronto para blindar apps de corretoras!")
    }
}
