import ManagedSettings
import ManagedSettingsUI
import UIKit

/**
 * ShieldConfigurationExtension - Customização da Interface de Bloqueio Nativa do iOS
 * Exibe o tema escuro #000000 com avisos crimson do TradeLock quando o aplicativo da corretora é tocado no iPhone.
 */
class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        return ShieldConfiguration(
            backgroundColor: UIColor(red: 0/255, green: 0/255, blue: 0/255, alpha: 1.0),
            icon: UIImage(named: "TradeLockShieldIcon"),
            title: ShieldConfiguration.Label(
                text: "ACESSO BLOQUEADO PELO TRADELOCK 🛡️",
                color: UIColor(red: 244/255, green: 63/255, blue: 94/255, alpha: 1.0)
            ),
            subtitle: ShieldConfiguration.Label(
                text: "Seu limite diário de operações foi atingido. A trava anti-fúria está protegendo sua banca contra perdas emocionais.",
                color: UIColor(red: 203/255, green: 213/255, blue: 225/255, alpha: 1.0)
            ),
            primaryButtonLabel: ShieldConfiguration.Label(
                text: "Entendido - Voltar",
                color: .white
            ),
            primaryButtonBackgroundColor: UIColor(red: 225/255, green: 29/255, blue: 72/255, alpha: 1.0),
            secondaryButtonLabel: nil
        )
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        return configuration(shielding: Application(bundleIdentifier: "com.apple.mobilesafari"))
    }
}
