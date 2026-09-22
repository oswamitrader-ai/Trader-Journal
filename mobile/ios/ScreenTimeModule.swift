import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity

/**
 * TradeLockScreenTimeModule - Módulo Nativo para iOS (Swift)
 * Utiliza as APIs oficiais da Apple (FamilyControls & ManagedSettings) para bloquear e ocultar
 * os aplicativos das corretoras (Exnova, IQ Option, etc.) e domínios no Safari do iPhone quando o Stop Loss é atingido.
 */
@objc(TradeLockScreenTimeModule)
public class TradeLockScreenTimeModule: NSObject {

    private let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("TradeLockShieldStore"))

    // Bundle IDs dos apps de corretoras no iOS App Store
    private val brokerBundleIdentifiers: Set<String> = [
        "com.exnova.ios",
        "com.iqoption.ios",
        "com.quotex.ios",
        "com.pocketoption.mobile",
        "com.binomo.mobile"
    ]

    // Domínios Web bloqueados no Safari / WebViews do iOS
    private val brokerWebDomains: Set<String> = [
        "exnova.com", "trade.exnova.com", "ws.exnova.com",
        "iqoption.com", "trade.iqoption.com", "ws.iqoption.com",
        "quotex.com", "qxbroker.com", "pocketoption.com", "binomo.com"
    ]

    /**
     * Solicita autorização ao usuário do iPhone para controle de Screen Time
     */
    @objc public func requestAuthorization(_ resolve: @escaping (Bool) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        if #available(iOS 15.0, *) {
            Task {
                do {
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                    print("[TradeLock iOS] Autorizacao de Screen Time concedida pelo usuario.")
                    resolve(true)
                } catch {
                    print("[TradeLock iOS] Falha ao solicitar autorizacao de Screen Time:", error)
                    reject("AUTH_FAILED", "Permissao de Screen Time recusada", error)
                }
            }
        } else {
            reject("UNSUPPORTED", "Screen Time API requer iOS 15.0 ou superior", nil)
        }
    }

    /**
     * Ativa o escudo de bloqueio para apps de corretoras e domínios web no iPhone
     */
    @objc public func enableShield(_ reason: String) {
        if #available(iOS 15.0, *) {
            print("[TradeLock iOS] Ativando Escudo de Bloqueio Screen Time no iPhone. Razao:", reason)

            // 1. Aplica o bloqueio nos aplicativos de corretoras instalados
            let appTokens = brokerBundleIdentifiers.compactMap { Application(bundleIdentifier: $0).token }
            store.shield.applications = Set(appTokens)

            // 2. Aplica o bloqueio nos domínios web das corretoras no Safari
            let webTokenSet = Set(brokerWebDomains.map { WebDomain(domain: $0) })
            store.shield.webDomains = webTokenSet
        }
    }

    /**
     * Desativa o escudo e libera os aplicativos no iPhone quando o dia vira ou o admin autoriza
     */
    @objc public func disableShield() {
        if #available(iOS 15.0, *) {
            print("[TradeLock iOS] Desativando Escudo de Bloqueio. Acesso liberado aos apps.")
            store.shield.applications = nil
            store.shield.webDomains = nil
        }
    }
}
