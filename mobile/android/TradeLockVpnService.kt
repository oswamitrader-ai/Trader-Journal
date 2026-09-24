package com.tradelock.shield

import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.InetAddress
import java.nio.ByteBuffer

/**
 * TradeLockVpnService - Serviço de VPN Local Nativo Android
 * Intercepta e cancela pacotes de rede direcionados aos servidores e WebSockets das Corretoras
 * (Exnova, IQ Option, Quotex, PocketOption, Binomo) sem utilizar servidores externos.
 */
class TradeLockVpnService : VpnService(), Runnable {

    companion object {
        private const val TAG = "TradeLockVpnService"
        const val ACTION_CONNECT = "com.tradelock.shield.START_VPN"
        const val ACTION_DISCONNECT = "com.tradelock.shield.STOP_VPN"

        val BLOCKED_DOMAINS = listOf(
            "exnova.com", "trade.exnova.com", "ws.exnova.com", "api.exnova.com",
            "iqoption.com", "trade.iqoption.com", "ws.iqoption.com", "api.iqoption.com",
            "quotex.com", "qxbroker.com", "ws.qxbroker.com",
            "pocketoption.com", "binomo.com"
        )
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private var vpnThread: Thread? = null
    @Volatile
    private var isRunning = false

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_DISCONNECT) {
            stopVpn()
            return START_NOT_STICKY
        }

        if (!isRunning) {
            startVpn()
        }
        return START_STICKY
    }

    private fun startVpn() {
        try {
            Log.d(TAG, "Iniciando VPN Local TradeLock...")
            val builder = Builder()
                .addAddress("10.0.0.2", 32)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("8.8.8.8")
                .setSession("TradeLock Anti-Furia Shield")
                .setBlocking(true)

            // Permite que o próprio app do TradeLock navegue sem passar pela VPN
            try {
                builder.addDisallowedApplication(packageName)
            } catch (e: Exception) {
                Log.w(TAG, "Nao foi possivel excluir o proprio pacote da VPN", e)
            }

            vpnInterface = builder.establish()
            isRunning = true

            vpnThread = Thread(this, "TradeLockVpnThread").apply { start() }
            Log.i(TAG, "VPN TradeLock ativada com sucesso!")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao estabelecer VpnService local", e)
            stopVpn()
        }
    }

    override fun run() {
        val descriptor = vpnInterface?.fileDescriptor ?: return
        val inputStream = FileInputStream(descriptor)
        val outputStream = FileOutputStream(descriptor)
        val packet = ByteBuffer.allocate(32767)

        while (isRunning) {
            try {
                val length = inputStream.read(packet.array())
                if (length > 0) {
                    packet.limit(length)
                    
                    // Inspeção simples de pacotes DNS/IP para domínios de corretoras
                    val isBlocked = inspectAndFilterPacket(packet)
                    if (!isBlocked) {
                        // Se não for domínio bloqueado, repassa o pacote normalmente
                        outputStream.write(packet.array(), 0, length)
                    } else {
                        Log.d(TAG, "Pacote de corretora interceptado e bloqueado pela Trava Anti-Fúria!")
                    }
                    packet.clear()
                }
            } catch (e: Exception) {
                if (!isRunning) break
                Log.e(TAG, "Erro no loop de pacotes da VPN", e)
            }
        }
    }

    private fun inspectAndFilterPacket(packet: ByteBuffer): Boolean {
        try {
            val array = packet.array()
            val length = packet.limit()
            if (length < 28) return false

            val protocol = array[9].toInt() and 0xFF
            if (protocol != 17) return false // Apenas pacotes UDP

            val ipHeaderLength = (array[0].toInt() and 0x0F) * 4
            if (length < ipHeaderLength + 8) return false

            val destPort = ((array[ipHeaderLength + 2].toInt() and 0xFF) shl 8) or (array[ipHeaderLength + 3].toInt() and 0xFF)

            // Intercepta consultas DNS na Porta 53
            if (destPort == 53) {
                val payloadString = String(array, ipHeaderLength + 8, length - (ipHeaderLength + 8), Charsets.ISO_8859_1).lowercase(java.util.Locale.getDefault())
                for (domain in BLOCKED_DOMAINS) {
                    if (payloadString.contains(domain)) {
                        Log.w(TAG, "Requisição DNS para corretora bloqueada via VPN local: $domain")
                        return true
                    }
                }
            }
        } catch (e: Exception) {
            // Ignorar erros de parse para não afetar tráfego normal
        }
        return false
    }

    private fun stopVpn() {
        isRunning = false
        try {
            vpnThread?.interrupt()
            vpnInterface?.close()
            vpnInterface = null
            Log.i(TAG, "VPN TradeLock encerrada.")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao parar VpnService", e)
        }
        stopSelf()
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }
}
