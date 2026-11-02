package com.tradelock.shield

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit

object TradeLockNativeSync {
    private const val URL_BASE = "https://mreykdrbyfrwqovsleqi.supabase.co"
    private const val PUBLIC_KEY = "sb_publishable_6ntxWuCoI_0Upy2PVIB6Nw__mMUiPUX"
    private val wake = Semaphore(0)
    private val http = OkHttpClient.Builder().pingInterval(20, TimeUnit.SECONDS).build()
    @Volatile private var running = false
    @Volatile private var socket: WebSocket? = null
    @Volatile private var socketToken = ""
    @Volatile private var lastReply = 0L
    private var thread: Thread? = null
    private var sequence = 0L
    fun getPrefs(context: Context): SharedPreferences = context.getSharedPreferences("TradeLockPrefs", Context.MODE_PRIVATE)
    fun saveUserEmail(context: Context, email: String) { getPrefs(context).edit().putString("locked_user_email", email.trim().lowercase(Locale.ROOT)).apply() }
    fun getUserEmail(context: Context): String = getPrefs(context).getString("locked_user_email", "") ?: ""
    fun requestSync() { if (wake.availablePermits() == 0) wake.release() }

    @Synchronized fun acceptSession(context: Context, session: JSONObject) {
        if (session.optString("access_token").isBlank() || session.optString("refresh_token").isBlank()) return
        val previous = NativeSessionStore.read(context)
        // Do not replace a background-refreshed session with a stale WebView snapshot.
        if (previous?.optJSONObject("user")?.optString("id") == session.optJSONObject("user")?.optString("id") &&
            (previous?.optLong("expires_at") ?: 0) > session.optLong("expires_at")) return
        NativeSessionStore.save(context, session)
        requestSync()
    }
    @Synchronized private fun accessToken(context: Context): String {
        var session = NativeSessionStore.read(context) ?: throw IllegalStateException("Entre novamente no TradeLock.")
        if (session.optLong("expires_at") <= System.currentTimeMillis()/1000 + 60) {
            session = JSONObject(request("/auth/v1/token?grant_type=refresh_token", null, JSONObject().put("refresh_token",session.getString("refresh_token"))))
            if (!session.has("expires_at")) session.put("expires_at",System.currentTimeMillis()/1000+session.optLong("expires_in",3600))
            NativeSessionStore.save(context,session)
        }
        return session.getString("access_token")
    }
    fun restoreProtection(context: Context) {
        val prefs=getPrefs(context)
        TradeLockAccessibilityService.isAntiFuriaActive = prefs.getBoolean("native_lock_active",true) || prefs.getBoolean("KEY_PERMANENT_MOBILE_LOCK",false)
        TradeLockAccessibilityService.lockReason = prefs.getString("native_lock_reason","Aguardando sincronização autenticada.") ?: "Aguardando sincronização."
    }
    @Synchronized fun startNativeBackgroundSync(context: Context) {
        if(running)return
        val app=context.applicationContext
        restoreProtection(app); running=true
        thread=Thread {
            while(running) {
                try { sync(app) }
                catch(e: Exception) {
                    getPrefs(app).edit().putString("native_sync_error",e.message ?: "Falha de conexão").apply()
                    applyProtection(app,true,"Proteção mantida: sincronização indisponível. Abra o TradeLock.")
                }
                try { wake.tryAcquire(5,TimeUnit.SECONDS) } catch(_:InterruptedException){break}
            }
        }.apply {name="TradeLockAuthenticatedSync";isDaemon=true;start()}
    }
    @Synchronized fun stopNativeBackgroundSync(){running=false;thread?.interrupt();thread=null;socket?.cancel();socket=null}
    private fun encoded(value:String)=URLEncoder.encode(value,"UTF-8")
    private fun rows(path:String,token:String)=JSONArray(request("/rest/v1/$path",token))
    private fun sync(context: Context) {
        val token=accessToken(context)
        val user=JSONObject(request("/auth/v1/user",token)) // Server validates session and current app_metadata.
        val email=user.getString("email").lowercase(Locale.ROOT)
        saveUserEmail(context,email)
        connectRealtime(token)
        val id=encoded("settings_$email")
        val risk=rows("risk_settings?id=eq.$id&select=*",token).optJSONObject(0) ?: throw IllegalStateException("Gestão de risco não configurada.")
        val management=rows("management_settings?id=eq.$id&select=settings",token).optJSONObject(0)?.optJSONObject("settings") ?: throw IllegalStateException("Configurações não encontradas.")
        val today=SimpleDateFormat("yyyy-MM-dd",Locale.ROOT).format(Date())
        val trades=rows("trades?user_email=eq.${encoded(email)}&date=eq.$today&select=pnl,accountType,isReal",token)
        var real=0.0;var total=0.0
        for(i in 0 until trades.length()) {
            val trade=trades.getJSONObject(i);val pnl=trade.optDouble("pnl",0.0)
            total+=pnl
            if(trade.optString("accountType")!="DEMO" && (!trade.has("isReal") || trade.isNull("isReal") || trade.optBoolean("isReal",true)))real+=pnl
        }
        val limit=risk.optDouble("dailyLossLimit",0.0)
        val max=risk.optInt("maxTradesPerDay",0)
        val stop=limit>0 && ((real<0 && real<=-limit+.001)||(total<0 && total<=-limit+.001))
        val maxHit=max>0 && trades.length()>=max
        val permanent=management.optBoolean("permanentMobileBrokerLockEnabled",false)
        val meta=user.optJSONObject("app_metadata") ?: JSONObject()
        val suspended=!meta.optBoolean("active",true)||meta.optString("subscriptionStatus","ACTIVE")!="ACTIVE"
        val reason=when {suspended->"Conta ou assinatura inativa";permanent->"Bloqueio Perpétuo de Corretoras no Celular (Eterno Stop Loss)";stop->"Stop Loss Diário Atingido";maxHit->"Limite de Operações Diárias Atingido";else->""}
        if (NativeSessionStore.read(context)?.optString("access_token") != token) return
        getPrefs(context).edit().putBoolean("KEY_PERMANENT_MOBILE_LOCK",permanent).putString("native_sync_error","").putLong("native_last_sync",System.currentTimeMillis()).apply()
        applyProtection(context,suspended||permanent||stop||maxHit,reason)
    }
    fun applyProtection(context:Context,active:Boolean,reason:String) {
        getPrefs(context).edit().putBoolean("native_lock_active",active).putString("native_lock_reason",reason).apply()
        TradeLockAccessibilityService.isAntiFuriaActive=active
        TradeLockAccessibilityService.lockReason=reason
        TradeLockAccessibilityService.checkCurrentWindow()
        // The accessibility shield is the primary blocker. VPN is optional and only targets broker apps.
        if(android.net.VpnService.prepare(context)==null) {
            try {context.startService(Intent(context,TradeLockVpnService::class.java).apply {action=if(active)TradeLockVpnService.ACTION_CONNECT else TradeLockVpnService.ACTION_DISCONNECT})}
            catch(e:Exception){Log.w("TradeLockSync","VPN indisponível; proteção de acessibilidade mantida.")}
        }
    }
    private fun connectRealtime(token:String) {
        if(socket!=null && socketToken==token && System.currentTimeMillis()-lastReply<60000) {
            send(socket!!,"phoenix","heartbeat",JSONObject());return
        }
        socket?.cancel();socketToken=token;lastReply=System.currentTimeMillis()
        socket=http.newWebSocket(Request.Builder().url("${URL_BASE.replace("https:","wss:")}/realtime/v1/websocket?apikey=$PUBLIC_KEY&vsn=1.0.0").build(),object:WebSocketListener(){
            override fun onOpen(ws:WebSocket,response:Response) {
                val changes=JSONArray()
                for(table in listOf("trades","risk_settings","management_settings","system_users","deleted_records","journal_resets"))changes.put(JSONObject().put("event","*").put("schema","public").put("table",table))
                send(ws,"realtime:native-risk","phx_join",JSONObject().put("access_token",token).put("config",JSONObject().put("postgres_changes",changes).put("broadcast",JSONObject().put("ack",false).put("self",false)).put("presence",JSONObject().put("enabled",false))))
            }
            override fun onMessage(ws:WebSocket,text:String) {
                if(ws!==socket)return
                lastReply=System.currentTimeMillis()
                try {val event=JSONObject(text)
                    if(event.optString("event")=="postgres_changes")requestSync()
                    if(event.optString("event") in listOf("phx_error","phx_close") || (event.optString("event")=="phx_reply" && event.optJSONObject("payload")?.optString("status")=="error")){ws.cancel();socket=null}
                }catch(_:Exception){}
            }
            override fun onFailure(ws:WebSocket,t:Throwable,response:Response?){if(ws===socket)socket=null}
            override fun onClosed(ws:WebSocket,code:Int,reason:String){if(ws===socket)socket=null}
        })
    }
    @Synchronized private fun send(ws:WebSocket,topic:String,event:String,payload:JSONObject){ws.send(JSONObject().put("topic",topic).put("event",event).put("payload",payload).put("ref",(++sequence).toString()).toString())}
    private fun request(path:String,token:String?,body:JSONObject?=null):String {
        val connection=URL(URL_BASE+path).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout=8000;connection.readTimeout=8000
            connection.setRequestProperty("apikey",PUBLIC_KEY)
            if(token!=null)connection.setRequestProperty("Authorization","Bearer $token")
            if(body!=null){connection.requestMethod="POST";connection.doOutput=true;connection.setRequestProperty("Content-Type","application/json");connection.outputStream.use{it.write(body.toString().toByteArray())}}
            if(connection.responseCode !in 200..299)throw IllegalStateException("Falha na sincronização (HTTP ${connection.responseCode}).")
            return connection.inputStream.bufferedReader().use{it.readText()}
        } finally {connection.disconnect()}
    }
}
