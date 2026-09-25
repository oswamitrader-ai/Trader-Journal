package com.tradelock.shield

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object TradeLockNativeSync {

    private const val TAG = "TradeLockNativeSync"
    private const val SUPABASE_URL = "https://mreykdrbyfrwqovsleqi.supabase.co"
    private const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MDQ1NTcsImV4cCI6MjEwNTA4MDU1N30.X8JibBnbQh47nkHv51srbAWrdHZDLojs1xVupV3og1g"
    private const val SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUwNDU1NywiZXhwIjoyMTA1MDgwNTU3fQ.jFaxN67eNfjCG_OJKKdwG7srYFMEGU10HlUA8Aoqk5Q"

    private const val PREFS_NAME = "TradeLockPrefs"
    private const val KEY_USER_EMAIL = "locked_user_email"

    @Volatile
    private var isSyncingRunning = false
    private var syncThread: Thread? = null

    fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun saveUserEmail(context: Context, email: String) {
        if (email.isNotBlank()) {
            getPrefs(context).edit().putString(KEY_USER_EMAIL, email.trim().lowercase(Locale.getDefault())).apply()
            Log.i(TAG, "E-mail ancorado nativamente no Android: $email")
        }
    }

    fun getUserEmail(context: Context): String {
        return getPrefs(context).getString(KEY_USER_EMAIL, "") ?: ""
    }

    fun startNativeBackgroundSync(context: Context) {
        if (isSyncingRunning) return
        isSyncingRunning = true

        syncThread = Thread {
            Log.i(TAG, "Iniciando Motor de Sincronização Nativa TradeLock 24/7...")

            while (isSyncingRunning) {
                try {
                    val email = getUserEmail(context)
                    if (email.isNotBlank()) {
                        checkSupabaseState(context, email)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Erro no ciclo de sincronização nativa: ${e.message}", e)
                }

                try {
                    Thread.sleep(15000) // Polling a cada 15 segundos nativamente
                } catch (ie: InterruptedException) {
                    break
                }
            }
        }.apply {
            name = "TradeLockNativeSyncThread"
            isDaemon = true
            start()
        }
    }

    fun stopNativeBackgroundSync() {
        isSyncingRunning = false
        syncThread?.interrupt()
        syncThread = null
    }

    private fun checkSupabaseState(context: Context, email: String) {
        val cleanEmail = email.trim().lowercase(Locale.getDefault())

        // 1. Data de Hoje no Fuso Horário Local (YYYY-MM-DD)
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val todayStr = sdf.format(Date())

        // 2. Consulta Risk Settings do Supabase
        val settingsUrl = "$SUPABASE_URL/rest/v1/risk_settings?id=eq.$cleanEmail"
        val settingsJson = httpGet(settingsUrl)

        var dailyLossLimit = 0.0
        var maxTradesPerDay = 0

        if (settingsJson != null && settingsJson.length() > 0) {
            val obj = settingsJson.getJSONObject(0)
            dailyLossLimit = obj.optDouble("dailyLossLimit", 0.0)
            maxTradesPerDay = obj.optInt("maxTradesPerDay", 0)
        }

        // 3. Consulta Trades de Hoje
        val tradesUrl = "$SUPABASE_URL/rest/v1/trades?user_email=eq.$cleanEmail&date=eq.$todayStr"
        val tradesJson = httpGet(tradesUrl)

        var todayRealPnl = 0.0
        var todayTradesCount = 0

        if (tradesJson != null) {
            todayTradesCount = tradesJson.length()
            for (i in 0 until tradesJson.length()) {
                val t = tradesJson.getJSONObject(i)
                val accountType = t.optString("accountType", "REAL")
                val isReal = t.optBoolean("isReal", accountType == "REAL")
                if (isReal) {
                    val pnl = t.optDouble("pnl", 0.0)
                    todayRealPnl += pnl
                }
            }
        }

        // 4. Consulta Usuário e Assinatura
        val userUrl = "$SUPABASE_URL/rest/v1/system_users?email=eq.$cleanEmail"
        val userJson = httpGet(userUrl)

        var isSubscriptionActive = true
        if (userJson != null && userJson.length() > 0) {
            val u = userJson.getJSONObject(0)
            val active = u.optBoolean("active", true)
            val subStatus = u.optString("subscriptionStatus", "ACTIVE")
            if (!active || subStatus == "INACTIVE" || subStatus == "OVERDUE") {
                isSubscriptionActive = false
            }
        }

        // 5. Avaliação das Regras Invioláveis de Risco
        val isStopHit = dailyLossLimit > 0 && todayRealPnl < 0 && Math.abs(todayRealPnl) >= dailyLossLimit
        val isMaxTradesHit = maxTradesPerDay > 0 && todayTradesCount >= maxTradesPerDay
        val isLockActive = isStopHit || isMaxTradesHit || !isSubscriptionActive

        var reason = "Trava Anti-Fúria Ativa"
        if (!isSubscriptionActive) {
            reason = "Assinatura Inadimplente ou Suspensa"
        } else if (isStopHit && isMaxTradesHit) {
            reason = String.format(Locale.getDefault(), "Stop Loss (R$ %.2f) & Limite de Trades (%d) Atingidos", dailyLossLimit, maxTradesPerDay)
        } else if (isStopHit) {
            reason = String.format(Locale.getDefault(), "Stop Loss Diário Atingido: R$ %.2f (Perda: R$ %.2f)", dailyLossLimit, Math.abs(todayRealPnl))
        } else if (isMaxTradesHit) {
            reason = String.format(Locale.getDefault(), "Limite Máximo de %d Operações no Dia Atingido", maxTradesPerDay)
        }

        Log.d(TAG, "Sincronia Nativa -> Email: $cleanEmail | LockActive: $isLockActive | StopHit: $isStopHit | PnL Hoje: $todayRealPnl | Trades: $todayTradesCount")

        // 6. Atualiza o Estado Global dos Serviços Nativo
        TradeLockAccessibilityService.isAntiFuriaActive = isLockActive
        TradeLockAccessibilityService.lockReason = reason

        // 7. Garante que a VPN local acompanhe a Trava
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
    }

    private fun httpGet(urlString: String): JSONArray? {
        var conn: HttpURLConnection? = null
        try {
            val url = URL(urlString)
            conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("apikey", SUPABASE_SERVICE_KEY)
            conn.setRequestProperty("Authorization", "Bearer $SUPABASE_SERVICE_KEY")
            conn.setRequestProperty("Accept", "application/json")
            conn.connectTimeout = 5000
            conn.readTimeout = 5000

            if (conn.responseCode in 200..299) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val sb = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    sb.append(line)
                }
                reader.close()
                return JSONArray(sb.toString())
            }
        } catch (e: Exception) {
            // Ignorar erros pontuais de conexão
        } finally {
            conn?.disconnect()
        }
        return null
    }
}
