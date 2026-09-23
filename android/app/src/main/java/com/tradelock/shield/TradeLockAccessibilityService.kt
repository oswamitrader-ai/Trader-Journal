package com.tradelock.shield

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent

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

        @Volatile
        var isAntiFuriaActive: Boolean = false

        @Volatile
        var lockReason: String = "Stop Loss Diário Atingido (Trava Anti-Fúria)"
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return

            if (BROKER_PACKAGE_NAMES.contains(packageName)) {
                Log.w(TAG, "Tentativa de abertura do aplicativo de corretora detectada: $packageName")

                if (isAntiFuriaActive) {
                    Log.e(TAG, "TRAVA ANTI-FÚRIA ATIVA! Disparando Overlay de Bloqueio em Tela Cheia!")
                    launchFullBlockOverlay(packageName)
                }
            }
        }
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
