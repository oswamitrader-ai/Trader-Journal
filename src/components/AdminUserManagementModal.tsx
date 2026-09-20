import React, { useState, useEffect } from 'react';
import {
  Users,
  X,
  UserPlus,
  Shield,
  Key,
  Trash2,
  CheckCircle2,
  XCircle,
  Mail,
  User,
  Lock,
  Search,
  RefreshCcw,
} from 'lucide-react';
import { SystemUser, UserRole } from '../types';
import {
  getSavedUsers,
  createNewUserByAdmin,
  toggleUserStatus,
  resetUserPassword,
  deleteUserByAdmin,
  INITIAL_ADMIN_USER,
} from '../utils/auth';

interface AdminUserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SystemUser;
}

export const AdminUserManagementModal: React.FC<AdminUserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form states for adding new user
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('cliente123');
  const [roleInput, setRoleInput] = useState<UserRole>('CLIENT');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // States for Reset Password Modal inside Admin
  const [resetModalUserId, setResetModalUserId] = useState<string | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('123456');

  // Load users list
  const loadUsers = () => {
    const list = getSavedUsers();
    setUsers(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setFeedbackMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Garantia de permissão: se não for ADMIN, não renderiza o painel
  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="rounded-2xl border border-rose-500/40 bg-black p-6 text-center max-w-sm">
          <Shield className="h-10 w-10 text-rose-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white">Acesso Negado</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Apenas administradores podem acessar a tela de gestão de clientes.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    const res = createNewUserByAdmin({
      name: nameInput,
      email: emailInput,
      password: passwordInput,
      role: roleInput,
    });

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: res.message || 'Cliente cadastrado com sucesso!' });
      setNameInput('');
      setEmailInput('');
      setPasswordInput('cliente123');
      setRoleInput('CLIENT');
      loadUsers();
    } else {
      setFeedbackMsg({ type: 'error', text: res.message || 'Erro ao cadastrar cliente.' });
    }
  };

  const handleToggleStatus = (targetUser: SystemUser) => {
    if (targetUser.email.toLowerCase() === INITIAL_ADMIN_USER.email.toLowerCase()) {
      alert('Não é possível desativar a conta do Administrador Principal.');
      return;
    }
    const updated = toggleUserStatus(targetUser.id);
    setUsers(updated);
  };

  const handleDeleteUser = (targetUser: SystemUser) => {
    if (targetUser.email.toLowerCase() === INITIAL_ADMIN_USER.email.toLowerCase()) {
      alert('Não é possível excluir a conta do Administrador Principal.');
      return;
    }
    if (window.confirm(`Deseja realmente remover o acesso do cliente ${targetUser.name} (${targetUser.email})?`)) {
      const updated = deleteUserByAdmin(targetUser.id);
      setUsers(updated);
    }
  };

  const handleConfirmResetPassword = () => {
    if (!resetModalUserId || !newPasswordVal.trim()) return;
    const updated = resetUserPassword(resetModalUserId, newPasswordVal.trim());
    setUsers(updated);
    setResetModalUserId(null);
    setNewPasswordVal('123456');
    alert('Senha redefinida com sucesso!');
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md pt-safe pb-safe overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-800 bg-black shadow-2xl my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5 sm:p-6 shrink-0 bg-black">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 shadow-lg shadow-violet-900/40 text-white">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Painel Administrativo — Gestão de Clientes
                </h2>
                <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-violet-300 border border-violet-500/30">
                  ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cadastre novos clientes pré-autorizados e gerencie os acessos do Trader Journal.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-800/50 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1 min-h-0">
          {/* Section 1: Form de Cadastro de Novo Cliente */}
          <div className="rounded-2xl border border-slate-800 bg-black/60 p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
              <UserPlus className="h-4 w-4 text-emerald-400" />
              <span>Cadastrar Novo Cliente</span>
            </h3>

            {feedbackMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  feedbackMsg.type === 'success'
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                    : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
                }`}
              >
                {feedbackMsg.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                  Nome do Cliente
                </label>
                <div className="relative">
                  <User className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Silva"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-3 py-2 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                  E-mail do Cliente
                </label>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="cliente@exemplo.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-3 py-2 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                  Senha Inicial
                </label>
                <div className="relative">
                  <Lock className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="cliente123"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-3 py-2 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                  Perfil de Acesso
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value as UserRole)}
                    className="flex-1 rounded-xl border border-slate-800 bg-black px-3 py-2 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="CLIENT">CLIENTE (Padrão)</option>
                    <option value="ADMIN">ADMINISTRADOR</option>
                  </select>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shrink-0 shadow-md shadow-emerald-900/30"
                  >
                    + Cadastrar
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section 2: Tabela de Clientes Cadastrados */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Usuários Autorizados ({users.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Gerencie permissões, redefina senhas ou remova o acesso de clientes.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-3 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-black/40">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-black text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="p-3">Usuário / Nome</th>
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Perfil</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  ) :
                    filteredUsers.map((u) => {
                      const isAdmin = u.role === 'ADMIN';
                      const isPrimaryAdmin = u.email.toLowerCase() === INITIAL_ADMIN_USER.email.toLowerCase();

                      return (
                        <tr key={u.id} className="hover:bg-slate-900/50 transition">
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-bold text-white block">{u.name}</span>
                            <span className="text-[10px] text-slate-500">ID: {u.id}</span>
                          </td>
                          <td className="p-3 whitespace-nowrap font-mono text-slate-300">
                            {u.email}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                isAdmin
                                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              <Shield className="h-3 w-3" />
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                u.active
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {u.active ? 'ATIVO ✓' : 'INATIVO ✗'}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* Toggle Active Button */}
                              <button
                                type="button"
                                disabled={isPrimaryAdmin}
                                onClick={() => handleToggleStatus(u)}
                                title={u.active ? 'Desativar acesso do cliente' : 'Ativar acesso do cliente'}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition disabled:opacity-30 disabled:cursor-not-allowed ${
                                  u.active
                                    ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30 hover:bg-amber-900'
                                    : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900'
                                }`}
                              >
                                {u.active ? 'Desativar' : 'Ativar'}
                              </button>

                              {/* Reset Password Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setResetModalUserId(u.id);
                                  setNewPasswordVal('123456');
                                }}
                                title="Redefinir senha do usuário"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 transition"
                              >
                                <Key className="h-3 w-3 text-amber-400" />
                                <span>Nova Senha</span>
                              </button>

                              {/* Delete User Button */}
                              <button
                                type="button"
                                disabled={isPrimaryAdmin}
                                onClick={() => handleDeleteUser(u)}
                                title="Excluir cadastro do cliente"
                                className="p-1 rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-400 border border-rose-500/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Inner Modal: Reset Password Prompt */}
        {resetModalUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
            <div className="w-full max-w-xs rounded-2xl border border-slate-800 bg-black p-5 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-400" /> Redefinir Senha
              </h4>
              <p className="text-xs text-slate-400">
                Digite a nova senha para este usuário:
              </p>
              <input
                type="text"
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2 text-xs font-mono font-bold text-white focus:border-amber-500 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUserId(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetPassword}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md"
                >
                  Salvar Senha
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 bg-black p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
