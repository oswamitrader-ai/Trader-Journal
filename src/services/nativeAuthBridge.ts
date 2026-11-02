import { supabase } from '../lib/supabase';

// A single shared user session follows token rotation between the WebView and Android service.
export async function restoreNativeSession(): Promise<void> {
  const bridge = (window as any).TradeLockAndroidBridge;
  if (!bridge?.getAuthSession) return;
  const native = JSON.parse(bridge.getAuthSession() || 'null');
  const {data:{session}} = await supabase.auth.getSession();
  if (native?.access_token && native?.refresh_token && (!session ||
      (native.user?.id === session.user.id && native.expires_at > (session.expires_at || 0)))) {
    const {error} = await supabase.auth.setSession({access_token:native.access_token,refresh_token:native.refresh_token});
    if (error) throw error;
  }
}

export function subscribeNativeSession(): () => void {
  const bridge = (window as any).TradeLockAndroidBridge;
  if (!bridge) return () => {};
  const {data:{subscription}} = supabase.auth.onAuthStateChange((event,session) => {
    if (event === 'SIGNED_OUT') bridge.clearAuthSession?.();
    else if (session) bridge.setAuthSession?.(JSON.stringify({access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at,user:session.user}));
  });
  const resume = () => { if (document.visibilityState === 'visible') void restoreNativeSession().catch(()=>{}); };
  document.addEventListener('visibilitychange',resume);
  return () => { subscription.unsubscribe(); document.removeEventListener('visibilitychange',resume); };
}
