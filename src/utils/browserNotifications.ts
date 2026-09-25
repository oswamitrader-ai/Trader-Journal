// Helper module for Browser Local Push Notifications (Notification API)

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (e) {
    console.warn('Erro ao solicitar permissão de notificação:', e);
    return false;
  }
}

export function sendBrowserNotification(title: string, options?: NotificationOptions): boolean {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch (e) {
    console.warn('Erro ao disparar notificação local do browser:', e);
    return false;
  }
}

export function checkAndTrigger80PercentPush(
  todayPnl: number,
  dailyProfitTarget: number,
  dailyLossLimit: number
) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const target80Key = `trader_push_80_target_${todayStr}`;
  const loss80Key = `trader_push_80_loss_${todayStr}`;

  // 1. Meta Diária (Gain >= 80%)
  if (dailyProfitTarget > 0 && todayPnl >= dailyProfitTarget * 0.8) {
    const alreadySent = localStorage.getItem(target80Key);
    if (!alreadySent) {
      const pct = Math.round((todayPnl / dailyProfitTarget) * 100);
      const isFull = todayPnl >= dailyProfitTarget;

      const title = isFull
        ? '🎉 Meta Diária Batida!'
        : '🎯 Lembrete: 80% da Meta Atingida!';
      const body = isFull
        ? `Parabéns! Você alcançou R$ ${todayPnl.toFixed(2)} e superou a meta diária!`
        : `Você atingiu ${pct}% da sua Meta Diária (R$ ${todayPnl.toFixed(2)} de R$ ${dailyProfitTarget.toFixed(2)}). Proteja seus ganhos!`;

      const sent = sendBrowserNotification(title, {
        body,
        tag: 'target-80-alert',
      });

      if (sent) {
        localStorage.setItem(target80Key, 'true');
      }
    }
  }

  // 2. Limite de Perda (Loss <= -80%)
  if (dailyLossLimit > 0 && todayPnl <= -dailyLossLimit * 0.8) {
    const alreadySent = localStorage.getItem(loss80Key);
    if (!alreadySent) {
      const pct = Math.round((Math.abs(todayPnl) / dailyLossLimit) * 100);
      const isFullStop = todayPnl <= -dailyLossLimit;

      const title = isFullStop
        ? '🛑 Stop Loss Diário Atingido!'
        : '⚠️ Lembrete: 80% do Limite de Perda!';
      const body = isFullStop
        ? `Seu limite de perda diário de R$ ${dailyLossLimit.toFixed(2)} foi atingido. Encerre o dia!`
        : `Você atingiu ${pct}% do seu Limite de Perda Diário (-R$ ${Math.abs(todayPnl).toFixed(2)} de R$ ${dailyLossLimit.toFixed(2)}). Mantenha o autocontrole!`;

      const sent = sendBrowserNotification(title, {
        body,
        tag: 'loss-80-alert',
      });

      if (sent) {
        localStorage.setItem(loss80Key, 'true');
      }
    }
  }
}
