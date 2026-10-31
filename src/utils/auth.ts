import { SystemUser } from '../types';
import { supabase, fetchUsersFromSupabase, upsertUserToSupabase, deleteUserFromSupabase } from '../lib/supabase';

export const INITIAL_ADMIN_USER: SystemUser = { id: '', email: 'oswamitrader@gmail.com', name: '', role: 'ADMIN', active: true, createdAt: '' };
let savedUsers: SystemUser[] = [];
export function getSavedUsers(): SystemUser[] { return savedUsers; }
export function saveUsersList(users: SystemUser[]): void { savedUsers = users.map(({password, ...u}) => u); }
export function getCurrentSession(): SystemUser | null { return null; }
export function setCurrentSession(_user: SystemUser | null): void { localStorage.removeItem('trader_journal_session_v1'); }
export async function logoutUser(): Promise<void> { savedUsers=[]; await supabase.auth.signOut(); }
export async function syncUsersWithSupabase(): Promise<SystemUser[]> {
  const {data:{session}} = await supabase.auth.getSession();
  if (!session) return [];
  const users = await fetchUsersFromSupabase() || [];
  saveUsersList(users);
  return users;
}
export async function applyJournalReset(email: string): Promise<boolean> {
  const {data, error} = await supabase.from('journal_resets').select('epoch').eq('user_email',email).maybeSingle();
  if(error) throw error;
  if(!data || localStorage.getItem('journal_epoch_'+email)===data.epoch) return false;
  localStorage.setItem('trader_journal_trades_'+email,'[]');
  localStorage.setItem('trader_journal_capital_txs_'+email,'[]');
  if(email==='oswamitrader@gmail.com') {
    for (const key of Object.keys(localStorage)) {
      if (/^trader_journal_trades_v[12]$/.test(key) || (key.includes('capital') && !key.includes('@'))) localStorage.removeItem(key);
    }
  }
  localStorage.setItem('journal_epoch_'+email,data.epoch);
  return true;
}
export async function restoreAuthenticatedUser(): Promise<SystemUser | null> {
  localStorage.removeItem('trader_journal_users_v1');
  localStorage.removeItem('trader_journal_session_v1');
  const {data:{session}} = await supabase.auth.getSession();
  if(!session) return null;
  const {data:{user},error} = await supabase.auth.getUser();
  if(error || !user?.email) { await supabase.auth.signOut(); return null; }
  const {data:profile,error:profileError} = await supabase.from('system_users').select('*').eq('id',user.id).single();
  if(profileError) throw profileError;
  if(!profile.active) { await supabase.auth.signOut(); throw new Error('Conta inativa.'); }
  await applyJournalReset(user.email.toLowerCase());
  return profile as SystemUser;
}
export async function authenticateUser(email:string,password:string):Promise<{success:boolean;user?:SystemUser;message?:string}> {
  const {error} = await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
  if(error) return {success:false,message:'Não foi possível entrar. Verifique seu e-mail e a senha da conta.'};
  const user=await restoreAuthenticatedUser();
  return user ? {success:true,user} : {success:false,message:'Sessão inválida.'};
}
export async function createNewUserByAdmin(input: any): Promise<{success:boolean;user?:SystemUser;message?:string}> {
  const result = await upsertUserToSupabase({...input, active:true, role:input.role || 'CLIENT',createdAt:new Date().toISOString()});
  if(!result.success) return {success:false,message:result.error || 'Falha no cadastro'};
  await syncUsersWithSupabase();
  return {success:true,message:'Usuário cadastrado.',user:savedUsers.find(u=>u.email===input.email)};
}
export async function updateUserSubscriptionByAdmin(id:string,updates:Partial<SystemUser>): Promise<SystemUser[]> {
  const user=savedUsers.find(u=>u.id===id);
  if(!user) throw new Error('Usuário não encontrado.');
  const result=await upsertUserToSupabase({...user,...updates});
  if(!result.success) throw new Error(result.error || 'Falha na atualização');
  return syncUsersWithSupabase();
}
export async function toggleUserStatus(id:string):Promise<SystemUser[]> {
  const user=savedUsers.find(u=>u.id===id);
  return updateUserSubscriptionByAdmin(id,{active:!user?.active});
}
export async function resetUserPassword(id:string,password:string):Promise<SystemUser[]> {
  return updateUserSubscriptionByAdmin(id,{password});
}
export async function deleteUserByAdmin(id:string):Promise<SystemUser[]> {
  const result=await deleteUserFromSupabase(id);
  if(!result.success) throw new Error(result.error || 'Falha ao excluir usuário');
  return syncUsersWithSupabase();
}
