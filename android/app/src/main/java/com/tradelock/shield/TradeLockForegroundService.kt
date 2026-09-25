package com.tradelock.shield

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

class TradeLockForegroundService : Service() {

    companion object {
        private const val TAG = "TradeLockForegroundService"
        const val CHANNEL_ID = "tradelock_foreground_channel"
        const val NOTIFICATION_ID = 1001

        fun startService(context: Context) {
            try {
                val intent = Intent(context, TradeLockForegroundService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao iniciar TradeLockForegroundService", e)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Criando TradeLockForegroundService 24/7...")
        createNotificationChannel()
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)

        // Inicia o motor nativo de sincronização em segundo plano
        TradeLockNativeSync.startNativeBackgroundSync(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "TradeLockForegroundService mantendo proteção nativa ativa 24/7...")
        TradeLockNativeSync.startNativeBackgroundSync(this)
        return START_STICKY
    }

    override fun onDestroy() {
        Log.w(TAG, "TradeLockForegroundService sendo destruído... Reiniciando motor!")
        TradeLockNativeSync.stopNativeBackgroundSync()
        // Tenta auto-reiniciar imediatamente
        startService(applicationContext)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "TradeLock Shield Status",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notificação persistente da Trava Anti-Fúria 24/7 em segundo plano"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TradeLock Shield 🔒")
            .setContentText("Protegendo sua banca 24/7 em segundo plano")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()
    }
}
