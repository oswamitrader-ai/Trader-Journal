import { SystemUser, SubscriptionStatus } from '../types';
import {
  fetchUsersFromSupabase,
  upsertUserToSupabase,
  deleteUserFromSupabase,
  syncAllUsersToSupabase,
  clearAllTradesFromSupabase,
} from '../lib/supabase';

const USERS_STORAGE_KEY = 'trader_journal_users_v1';
const SESSION_STORAGE_KEY = 'trader_journal_session_v1';

// Admin padrão pré-cadastrado no sistema
export const INITIAL_ADMIN_USER: SystemUser = {
  id: 'usr-admin-001',
  email: 'oswamitrader@gmail.com',
  name: 'Swami Trader (Admin)',
  role: 'ADMIN',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  password: 'admin123',
};

// Limpar dados e operações de um cliente específico (local e Supabase)
export function cleanClientData(email: string): void {
  const cleanEmail = email.toLowerCase().trim();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`trader_journal_trades_${cleanEmail}`);
      localStorage.removeItem(`trader_journal_settings_${cleanEmail}`);
      localStorage.removeItem(`trader_journal_capital_txs_${cleanEmail}`);
    } catch (e) {
      console.error(e);
    }
  }
  clearAllTradesFromSupabase(cleanEmail).catch(() => {});
}

// Obter todos os usuários pré-cadastrados (com fallback para o Admin padrão)
export function getSavedUsers(): SystemUser[] {
  if (typeof window === 'undefined') return [INITIAL_ADMIN_USER];

  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Garantir que o email do admin principal sempre exista e tenha role ADMIN
        const hasAdmin = parsed.some(
          (u: SystemUser) => u.email.toLowerCase() === INITIAL_ADMIN_USER.email.toLowerCase()
        );
        if (!hasAdmin) {
          const updated = [INITIAL_ADMIN_USER, ...parsed];
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
          return updated;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar lista de usuários:', e);
  }

  // Lista padrão inicial com o Admin
  const defaultList = [INITIAL_ADMIN_USER];
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultList));
  } catch (e) {
    console.error(e);
  }
  return defaultList;
}

// Sincronizar usuários com o Supabase em segundo plano
export async function syncUsersWithSupabase(): Promise<SystemUser[]> {
  // Limpeza preventiva de dados legados dos clientes
  cleanClientData('ariereproinuj@trader.com');
  cleanClientData('imawssevlacnog@trader.com');

  const localUsers = getSavedUsers();
  try {
    const remoteUsers = await fetchUsersFromSupabase();

    if (remoteUsers && remoteUsers.length > 0) {
      // Mescla remotos com locais mantendo alterações de senha remotas
      const mergedMap = new Map<string, SystemUser>();
      
      // Insere locais primeiro
      for (const u of localUsers) {
        mergedMap.set(u.email.toLowerCase().trim(), u);
      }

      // Sobrescreve com remotos (já que Supabase é a fonte da verdade!)
      for (const u of remoteUsers) {
        mergedMap.set(u.email.toLowerCase().trim(), u);
      }

      // Garante admin principal
      if (!mergedMap.has(INITIAL_ADMIN_USER.email.toLowerCase())) {
        mergedMap.set(INITIAL_ADMIN_USER.email.toLowerCase(), INITIAL_ADMIN_USER);
        upsertUserToSupabase(INITIAL_ADMIN_USER);
      }

      const mergedList = Array.from(mergedMap.values());
      saveUsersList(mergedList);
      return mergedList;
    } else if (localUsers.length > 0) {
      // Faz o upload dos usuários locais para o Supabase
      syncAllUsersToSupabase(localUsers);
    }
  } catch (e) {
    console.warn('Erro na sincronização remota de usuários:', e);
  }
  return localUsers;
}

// Salvar a lista atualizada de usuários no localStorage
export function saveUsersList(users: SystemUser[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Erro ao salvar lista de usuários:', e);
  }
}

// Obter usuário da sessão atual
export function getCurrentSession(): SystemUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored && stored !== 'null' && stored !== 'undefined') {
      const user = JSON.parse(stored) as SystemUser;
      // Valida se o usuário ainda existe e está ativo na lista oficial
      const allUsers = getSavedUsers();
      const validUser = allUsers.find(
        (u) => u.email.toLowerCase() === user.email.toLowerCase() && u.active
      );
      if (validUser) {
        return Object.freeze({ ...validUser });
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar sessão:', e);
  }

  return null;
}

// Salvar sessão do usuário logado
export function setCurrentSession(user: SystemUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Erro ao atualizar sessão:', e);
  }
}

// Encerrar a sessão do usuário
export function logoutUser(): void {
  setCurrentSession(null);
}

// Autenticar usuário por e-mail e senha (assíncrono com busca em tempo real no Supabase)
export async function authenticateUser(
  emailInput: string,
  passwordInput: string
): Promise<{ success: boolean; user?: SystemUser; message?: string }> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  if (!cleanEmail || !cleanPass) {
    return { success: false, message: 'Por favor, preencha o e-mail e a senha.' };
  }

  // Sincroniza obrigatoriamente com o Supabase ANTES de validar as credenciais
  // Isso garante que se o cache foi limpo, a nova senha é buscada do banco em tempo real!
  const allUsers = await syncUsersWithSupabase();
  const foundUser = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!foundUser) {
    return {
      success: false,
      message: 'E-mail não cadastrado. O acesso é exclusivo para usuários autorizados pelo Administrador.',
    };
  }

  if (!foundUser.active) {
    return {
      success: false,
      message: 'Sua conta está inativa. Entre em contato com o Administrador para reativar seu acesso.',
    };
  }

  // Verifica senha
  const expectedPass = foundUser.password || 'admin123';
  if (cleanPass !== expectedPass) {
    return {
      success: false,
      message: 'Senha incorreta. Verifique os dados digitados e tente novamente.',
    };
  }

  // Sucesso - atualiza o último login
  const updatedUser: SystemUser = {
    ...foundUser,
    lastLoginAt: new Date().toISOString(),
  };

  const updatedList = allUsers.map((u) => (u.id === foundUser.id ? updatedUser : u));
  saveUsersList(updatedList);
  await upsertUserToSupabase(updatedUser);
  setCurrentSession(updatedUser);

  return {
    success: true,
    user: updatedUser,
  };
}

// Cadastrar novo cliente pelo Admin com dados de Assinatura SaaS
export async function createNewUserByAdmin(newUser: {
  name: string;
  email: string;
  password?: string;
  role?: 'ADMIN' | 'CLIENT';
  subscriptionPlan?: 'MENSAL' | 'TRIMESTRAL' | 'ANUAL' | 'TRIAL';
  subscriptionExpiresAt?: string;
  monthlyPrice?: number;
  whatsapp?: string;
}): Promise<{ success: boolean; user?: SystemUser; message?: string }> {
  const cleanEmail = newUser.email.trim().toLowerCase();
  const cleanName = newUser.name.trim();

  if (!cleanEmail || !cleanName) {
    return { success: false, message: 'Preencha o nome e o e-mail do cliente.' };
  }

  const allUsers = await syncUsersWithSupabase();
  const exists = allUsers.some((u) => u.email.toLowerCase() === cleanEmail);

  if (exists) {
    return { success: false, message: `O e-mail ${cleanEmail} já está cadastrado no sistema.` };
  }

  // Define data padrão de vencimento se não informada (+30 dias)
  const defaultExp = new Date();
  defaultExp.setDate(defaultExp.getDate() + 30);
  const expiresAtStr = newUser.subscriptionExpiresAt || defaultExp.toISOString().split('T')[0];

  const userObj: SystemUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    email: cleanEmail,
    name: cleanName,
    role: newUser.role || 'CLIENT',
    active: true,
    createdAt: new Date().toISOString(),
    password: newUser.password?.trim() || 'cliente123',
    subscriptionStatus: 'ACTIVE',
    subscriptionPlan: newUser.subscriptionPlan || 'MENSAL',
    subscriptionExpiresAt: expiresAtStr,
    monthlyPrice: newUser.monthlyPrice ?? 97,
    whatsapp: newUser.whatsapp?.replace(/\D/g, '') || '',
  };

  const updatedList = [userObj, ...allUsers];
  saveUsersList(updatedList);
  await upsertUserToSupabase(userObj);

  return {
    success: true,
    user: userObj,
    message: `Cliente ${cleanName} (${cleanEmail}) cadastrado com sucesso!`,
  };
}

// Atualizar parâmetros de assinatura do cliente pelo Admin
export async function updateUserSubscriptionByAdmin(
  userId: string,
  updates: Partial<SystemUser>
): Promise<SystemUser[]> {
  const allUsers = getSavedUsers();
  const updated = allUsers.map((u) => {
    if (u.id === userId) {
      return {
        ...u,
        ...updates,
      };
    }
    return u;
  });
  saveUsersList(updated);
  const target = updated.find((u) => u.id === userId);
  if (target) await upsertUserToSupabase(target);
  return updated;
}

// Alternar status ativo/inativo do usuário por inadimplência ou decisão administrativa
export async function toggleUserStatus(userId: string): Promise<SystemUser[]> {
  const allUsers = getSavedUsers();
  const updated = allUsers.map((u) => {
    if (u.id === userId && u.email.toLowerCase() !== INITIAL_ADMIN_USER.email.toLowerCase()) {
      const nextActive = !u.active;
      return {
        ...u,
        active: nextActive,
        subscriptionStatus: (nextActive ? 'ACTIVE' : 'INACTIVE') as SubscriptionStatus,
      };
    }
    return u;
  });
  saveUsersList(updated);
  const target = updated.find((u) => u.id === userId);
  if (target) await upsertUserToSupabase(target);
  return updated;
}

// Redefinir senha de um usuário
export async function resetUserPassword(userId: string, newPassword: string): Promise<SystemUser[]> {
  const allUsers = getSavedUsers();
  const updated = allUsers.map((u) => {
    if (u.id === userId) {
      return { ...u, password: newPassword.trim() };
    }
    return u;
  });
  saveUsersList(updated);
  const target = updated.find((u) => u.id === userId);
  if (target) await upsertUserToSupabase(target);
  return updated;
}

// Excluir um cliente pelo Admin
export async function deleteUserByAdmin(userId: string): Promise<SystemUser[]> {
  const allUsers = getSavedUsers();
  const targetUser = allUsers.find((u) => u.id === userId);
  // Não permite apagar o admin principal
  const updated = allUsers.filter(
    (u) => !(u.id === userId && u.email.toLowerCase() === INITIAL_ADMIN_USER.email.toLowerCase())
  );
  saveUsersList(updated);
  await deleteUserFromSupabase(userId, targetUser?.email);
  return updated;
}
