package com.tradelock.shield

import android.app.Activity
import android.os.Bundle
import android.os.CountDownTimer
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import java.util.Calendar
import java.util.Locale

/**
 * OverlayBlockActivity - Tela Nativa de Bloqueio em Tela Cheia (Android)
 * Exibe o Duelo Touro vs Urso, KPIs de Risco e Contagem Regressiva quando o trader tenta burlar a trava.
 */
class OverlayBlockActivity : Activity() {

    private lateinit var tvTimer: TextView
    private lateinit var tvReason: TextView
    private lateinit var btnUnderstand: Button
    private var timer: CountDownTimer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Torna a Activity cheia, por cima da tela de bloqueio e com iluminação ativa
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )

        setContentView(createNativeBlockLayout())
        startCountdownToMidnight()
    }

    private fun createNativeBlockLayout(): View {
        val root = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setBackgroundColor(android.graphics.Color.parseColor("#000000"))
            setPadding(40, 60, 40, 40)
            gravity = android.view.Gravity.CENTER_HORIZONTAL
        }

        // Tag de Alerta Crimson
        val tvHeader = TextView(this).apply {
            text = "🛡️ ACESSO BLOQUEADO PELO TRADELOCK"
            setTextColor(android.graphics.Color.parseColor("#F43F5E"))
            textSize = 18f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = android.view.Gravity.CENTER
        }
        root.addView(tvHeader)

        // Subtítulo
        val tvSub = TextView(this).apply {
            text = "SUA BANCA ESTÁ PROTEGIDA CONTRA O TRADE DE FÚRIA"
            setTextColor(android.graphics.Color.parseColor("#94A3B8"))
            textSize = 12f
            setPadding(0, 10, 0, 30)
            gravity = android.view.Gravity.CENTER
        }
        root.addView(tvSub)

        // Caixa de Razão
        val reasonStr = intent.getStringExtra("LOCK_REASON") ?: "Stop Loss Diário Atingido"
        tvReason = TextView(this).apply {
            text = "⚠️ $reasonStr"
            setTextColor(android.graphics.Color.parseColor("#FCA5A5"))
            setBackgroundColor(android.graphics.Color.parseColor("#18181B"))
            setPadding(30, 25, 30, 25)
            textSize = 14f
            gravity = android.view.Gravity.CENTER
        }
        root.addView(tvReason)

        // Timer Regressivo Azul Ciano
        tvTimer = TextView(this).apply {
            text = "00:00:00"
            setTextColor(android.graphics.Color.parseColor("#06B6D4"))
            textSize = 36f
            typeface = android.graphics.Typeface.MONOSPACE
            setPadding(0, 40, 0, 40)
            gravity = android.view.Gravity.CENTER
        }
        root.addView(tvTimer)

        // Mensagem do Mentor IA
        val tvMentor = TextView(this).apply {
            text = "💡 Diagnóstico do Mentor IA: 'A disciplina é a ponte entre as suas metas e a sua consistência no mercado. Respeite o Stop de hoje para operar com tranquilidade amanhã.'"
            setTextColor(android.graphics.Color.parseColor("#CBD5E1"))
            textSize = 13f
            setPadding(30, 30, 30, 30)
            setBackgroundColor(android.graphics.Color.parseColor("#09090B"))
            gravity = android.view.Gravity.CENTER
        }
        root.addView(tvMentor)

        // Botão Entendido / Voltar à Home
        btnUnderstand = Button(this).apply {
            text = "ENTENDIDO - VOLTAR AO TRADELOCK"
            setBackgroundColor(android.graphics.Color.parseColor("#E11D48"))
            setTextColor(android.graphics.Color.WHITE)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setOnClickListener {
                finish()
            }
        }
        val params = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = 50 }
        root.addView(btnUnderstand, params)

        return root
    }

    private fun startCountdownToMidnight() {
        val now = Calendar.getInstance()
        val midnight = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val millisUntilMidnight = midnight.timeInMillis - now.timeInMillis

        timer = object : CountDownTimer(millisUntilMidnight, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val hours = (millisUntilFinished / (1000 * 60 * 60)) % 24
                val minutes = (millisUntilFinished / (1000 * 60)) % 60
                val seconds = (millisUntilFinished / 1000) % 60
                tvTimer.text = String.format(Locale.getDefault(), "%02d:%02d:%02d", hours, minutes, seconds)
            }

            override fun onFinish() {
                tvTimer.text = "00:00:00 - MERCADO LIBERADO!"
                finish()
            }
        }.start()
    }

    override fun onBackPressed() {
        // Bloqueia o botão voltar para impedir que o trader feche a tela e burle o bloqueio
        moveTaskToBack(true)
    }

    override fun onDestroy() {
        timer?.cancel()
        super.onDestroy()
    }
}
