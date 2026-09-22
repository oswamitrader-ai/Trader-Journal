import React, { useState, useEffect } from 'react';
import {
  Users,
  ArrowLeft,
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
  DollarSign,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  TrendingUp,
  CreditCard,
  Phone,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { SystemUser, UserRole, SubscriptionPlan, SubscriptionStatus } from '../types';
import {
  getSavedUsers,
  createNewUserByAdmin,
  toggleUserStatus,
  resetUserPassword,
  deleteUserByAdmin,
  updateUserSubscriptionByAdmin,
  INITIAL_ADMIN_USER,
  syncUsersWithSupabase,
} from '../utils/auth';
import { formatCurrency } from '../utils/calculations';

interface AdminUserManagementPageProps {
  currentUser: SystemUser;
  onBackToDashboard: () => void;
}

export const AdminUserManagementPage: React.FC<AdminUserManagementPageProps> = ({
  currentUser,
  onBackToDashboard,
}) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'OVERDUE' | 'TRIAL'>('ALL');
  const [planFilter, setPlanFilter] = useState<'ALL' | SubscriptionPlan>('ALL');

  // Form states para cadastro de novo cliente
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [whatsappInput, setWhatsappInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('cliente123');
  const [roleInput, setRoleInput] = useState<UserRole>('CLIENT');
  const [planInput, setPlanInput] = useState<SubscriptionPlan>('MENSAL');
  const [monthlyPriceInput, setMonthlyPriceInput] = useState<number>(97);
  const [expiresAtInput, setExpiresAtInput] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal interno de Edição de Assinatura
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editPlan, setEditPlan] = useState<SubscriptionPlan>('MENSAL');
  const [editPrice, setEditPrice] = useState<number>(97);
  const [editExpiresAt, setEditExpiresAt] = useState<string>('');
  const [editWhatsapp, setEditWhatsapp] = useState<string>('');

  // Modal interno de Redefinição de Senha
  const [resetModalUserId, setResetModalUserId] = useState<string | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('123456');

  // Carregar lista de usuários
  const loadUsers = async () => {
    const list = await syncUsersWithSupabase();
    setUsers(list);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Recalcula valor sugerido ao mudar plano no formulário de cadastro
  const handlePlanChange = (plan: SubscriptionPlan) => {
    setPlanInput(plan);
    if (plan === 'MENSAL') setMonthlyPriceInput(97);
    else if (plan === 'TRIMESTRAL') setMonthlyPriceInput(247);
    else if (plan === 'ANUAL') setMonthlyPriceInput(797);
    else if (plan === 'TRIAL') setMonthlyPriceInput(0);
  };

  // Garanta de permissão: se não for ADMIN, bloqueia visualização
  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 text-slate-100">
        <div className="rounded-3xl border border-rose-500/40 bg-black p-8 text-center max-w-md shadow-2xl">
          <Shield className="h-12 w-12 text-rose-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">Acesso Restrito ao Administrador</h3>
          <p className="text-xs text-slate-400 mt-2 mb-6">
            Apenas administradores do TradeLock possuem autorização para acessar a Central de Gestão de Clientes e Assinaturas.
          </p>
          <button
            onClick={onBackToDashboard}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
          >
            ← Voltar ao Diário de Trade
          </button>
        </div>
      </div>
    );
  }

  // Cadastro de Novo Cliente
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    const res = await createNewUserByAdmin({
      name: nameInput,
      email: emailInput,
      whatsapp: whatsappInput,
      password: passwordInput,
      role: roleInput,
      subscriptionPlan: planInput,
      subscriptionExpiresAt: expiresAtInput,
      monthlyPrice: monthlyPriceInput,
    });

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: res.message || 'Cliente e assinatura cadastrados com sucesso!' });
      setNameInput('');
      setEmailInput('');
      setWhatsappInput('');
      setPasswordInput('cliente123');
      setRoleInput('CLIENT');
      setPlanInput('MENSAL');
      setMonthlyPriceInput(97);
      await loadUsers();
    } else {
      setFeedbackMsg({ type: 'error', text: res.message || 'Erro ao cadastrar cliente.' });
    }
  };

  // Toggle de Status (Ativar / Inativar por falta de pagamento)
  const handleToggleStatus = async (targetUser: SystemUser) => {
    if (targetUser.email.toLowerCase() === INITIAL_ADMIN_USER.email.toLowerCase()) {
      alert('Não é possível desativar a conta do Administrador Principal.');
      return;
    }
    const updated = await toggleUserStatus(targetUser.id);
    setUsers(updated);
  };

  // Renovação Rápida (+30 dias)
  const handleRenew30Days = async (targetUser: SystemUser) => {
    const curDate = targetUser.subscriptionExpiresAt ? new Date(targetUser.subscriptionExpiresAt) : new Date();
    const baseDate = isNaN(curDate.getTime()) || curDate < new Date() ? new Date() : curDate;
    baseDate.setDate(baseDate.getDate() + 30);
    const newExpiresAt = baseDate.toISOString().split('T')[0];

    const updated = await updateUserSubscriptionByAdmin(targetUser.id, {
      active: true,
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: newExpiresAt,
    });
    setUsers(updated);
    alert(`Assinatura do cliente ${targetUser.name} renovada com sucesso até ${newExpiresAt.split('-').reverse().join('/')}!`);
  };

  // Abrir Modal de Edição de Assinatura
  const handleOpenEditModal = (u: SystemUser) => {
    setEditingUser(u);
    setEditPlan(u.subscriptionPlan || 'MENSAL');
    setEditPrice(u.monthlyPrice ?? 97);
    setEditExpiresAt(u.subscriptionExpiresAt || new Date().toISOString().split('T')[0]);
    setEditWhatsapp(u.whatsapp || '');
  };

  // Salvar Edição de Assinatura
  const handleSaveEditSubscription = async () => {
    if (!editingUser) return;
    const updated = await updateUserSubscriptionByAdmin(editingUser.id, {
      subscriptionPlan: editPlan,
      monthlyPrice: editPrice,
      subscriptionExpiresAt: editExpiresAt,
      whatsapp: editWhatsapp.replace(/\D/g, ''),
    });
    setUsers(updated);
    setEditingUser(null);
  };

  // Enviar Lembrete / Cobrança via WhatsApp
  const handleSendWhatsappBilling = (u: SystemUser) => {
    const phone = u.whatsapp?.replace(/\D/g, '');
    if (!phone) {
      alert(`O cliente ${u.name} não possui número de WhatsApp cadastrado. Clique no botão de editar para adicionar o telefone.`);
      return;
    }
    const cleanPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const expDateStr = u.subscriptionExpiresAt ? u.subscriptionExpiresAt.split('-').reverse().join('/') : 'em breve';
    const msg = encodeURIComponent(
      `Olá ${u.name}, tudo bem?\n\nPassando para lembrar que sua assinatura da plataforma *TradeLock - Gestão & Capital* vence em *${expDateStr}*.\n\nPara manter seu acesso e a Trava Anti-Fúria ativos, efetue a renovação do seu plano. Qualquer dúvida, conte conosco!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  // Exclusão de Cliente
  const handleDeleteUser = async (targetUser: SystemUser) => {
    if (targetUser.email.toLowerCase() === INITIAL_ADMIN_USER.email.toLowerCase()) {
      alert('Não é possível excluir a conta do Administrador Principal.');
      return;
    }
    if (window.confirm(`Deseja realmente remover permanentemente o acesso do cliente ${targetUser.name} (${targetUser.email})?`)) {
      const updated = await deleteUserByAdmin(targetUser.id);
      setUsers(updated);
    }
  };

  // Confirmar Reset de Senha
  const handleConfirmResetPassword = async () => {
    if (!resetModalUserId || !newPasswordVal.trim()) return;
    const updated = await resetUserPassword(resetModalUserId, newPasswordVal.trim());
    setUsers(updated);
    setResetModalUserId(null);
    setNewPasswordVal('123456');
    alert('Nova senha redefinida com sucesso no banco de dados!');
  };

  // Cálculos de Métricas SaaS
  const clientsList = users.filter((u) => u.role === 'CLIENT');
  const activeClients = clientsList.filter((u) => u.active);
  const inactiveClients = clientsList.filter((u) => !u.active);
  const estimatedMRR = activeClients.reduce((acc, u) => acc + (u.monthlyPrice ?? 97), 0);

  // Filtro Avançado da Tabela
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.whatsapp && u.whatsapp.includes(searchTerm));

    let matchesStatus = true;
    if (statusFilter === 'ACTIVE') matchesStatus = u.active;
    else if (statusFilter === 'INACTIVE') matchesStatus = !u.active;
    else if (statusFilter === 'TRIAL') matchesStatus = u.subscriptionPlan === 'TRIAL';

    let matchesPlan = true;
    if (planFilter !== 'ALL') matchesPlan = u.subscriptionPlan === planFilter;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 sm:p-6 md:p-8 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition shadow-md shrink-0"
            title="Voltar para a tela principal de operações"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-400" />
            <span>Voltar ao Diário de Trade</span>
          </button>
          <div className="h-6 w-px bg-slate-800 hidden sm:block" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                TradeLock SaaS — Central de Assinaturas
              </h1>
              <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white uppercase shadow-md shadow-violet-900/40">
                PAINEL ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Gerencie clientes, controle adimplência, monitore mensalidades e envie cobranças.
            </p>
          </div>
        </div>

        <button
          onClick={loadUsers}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-black text-xs text-slate-300 hover:bg-slate-900 hover:text-white transition shrink-0 self-start sm:self-auto"
        >
          <RefreshCcw className="h-3.5 w-3.5 text-emerald-400" />
          <span>Sincronizar Banco</span>
        </button>
      </div>

      {/* 4 CARDS DE MÉTRICAS SAAS & RECEITA (MRR) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Clientes */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total de Clientes
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {clientsList.length}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              {users.length - clientsList.length} administrador(es) cadastrado(s)
            </p>
          </div>
        </div>

        {/* Card 2: Assinaturas Ativas (Adimplentes) */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Assinaturas Ativas
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
              {activeClients.length}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Clientes com acesso liberado na plataforma
            </p>
          </div>
        </div>

        {/* Card 3: Inadimplentes / Vencidos */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Inadimplentes / Suspensos
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black font-mono text-rose-400 tracking-tight">
              {inactiveClients.length}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Acesso bloqueado por falta de pagamento
            </p>
          </div>
        </div>

        {/* Card 4: MRR (Receita Mensal Recorrente Estimada) */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              MRR Recorrente (Mês)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black font-mono text-purple-300 tracking-tight">
              {formatCurrency(estimatedMRR)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Faturamento mensal das assinaturas ativas
            </p>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO COMPLETO DE CADASTRO DE CLIENTE / NOVA ASSINATURA */}
      <div className="rounded-3xl border border-slate-800 bg-black p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-emerald-400" />
            <span>Cadastrar Novo Cliente &amp; Ativar Assinatura</span>
          </h3>
          <span className="text-xs text-slate-500">Concede acesso imediato à plataforma e extensões</span>
        </div>

        {feedbackMsg && (
          <div
            className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
              feedbackMsg.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Nome */}
          <div>
            <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
              Nome do Cliente
            </label>
            <div className="relative">
              <User className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                required
                placeholder="Ex: Carlos Santos"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-3 py-2.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
              E-mail do Cliente (Login)
            </label>
            <div className="relative">
              <Mail className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                placeholder="cliente@exemplo.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-3 py-2.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
              WhatsApp (Com DDD)
            </label>
            <div className="relative">
              <Phone className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="11999998888"
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-3 py-2.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
              Senha Inicial
            </label>
            <div className="relative">
              <Lock className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                required
                placeholder="cliente123"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-3 py-2.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Plano */}
          <div>
            <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
              Plano da Assinatura
            </label>
            <select
              value={planInput}
              onChange={(e) => handlePlanChange(e.target.value as SubscriptionPlan)}
              className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2.5 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="MENSAL">MENSAL (R$ 97,00/mês)</option>
              <option value="TRIMESTRAL">TRIMESTRAL (R$ 247,00/3 meses)</option>
              <option value="ANUAL">ANUAL (R$ 797,00/ano)</option>
              <option value="TRIAL">TRIAL / TESTE GRÁTIS</option>
            </select>
          </div>

          {/* Valor da Mensalidade (R$) */}
          <div>
            <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
              Valor da Mensalidade (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-400 font-mono">R$</span>
              <input
                type="number"
                min={0}
                value={monthlyPriceInput}
                onChange={(e) => setMonthlyPriceInput(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-3 py-2.5 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Vencimento */}
          <div>
            <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
              Data de Vencimento
            </label>
            <input
              type="date"
              required
              value={expiresAtInput}
              onChange={(e) => setExpiresAtInput(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2.5 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none font-mono"
            />
          </div>

          {/* Perfil & Submit */}
          <div>
            <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
              Perfil &amp; Ação
            </label>
            <div className="flex items-center gap-2">
              <select
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value as UserRole)}
                className="w-1/2 rounded-xl border border-slate-800 bg-black px-2 py-2.5 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="CLIENT">CLIENTE</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button
                type="submit"
                className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-900/40"
              >
                + Criar Conta
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* TABELA PRINCIPAL DE CLIENTES & GESTÃO DE COBRANÇA */}
      <div className="rounded-3xl border border-slate-800 bg-black p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Controles de Busca e Filtros de Assinatura */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-400" />
              <span>Clientes &amp; Status de Assinatura ({filteredUsers.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ative ou desative acessos de inadimplentes, renove vencimentos e envie cobranças por WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Filtro Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-slate-800 bg-black px-3 py-2 text-xs font-bold text-slate-200 focus:border-purple-500 focus:outline-none"
            >
              <option value="ALL">Status: Todos</option>
              <option value="ACTIVE">Status: Ativos (Em dia)</option>
              <option value="INACTIVE">Status: Inadimplentes (Sem pagamento)</option>
              <option value="TRIAL">Status: Trial / Teste</option>
            </select>

            {/* Filtro Plano */}
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as any)}
              className="rounded-xl border border-slate-800 bg-black px-3 py-2 text-xs font-bold text-slate-200 focus:border-purple-500 focus:outline-none"
            >
              <option value="ALL">Plano: Todos</option>
              <option value="MENSAL">Plano: Mensal</option>
              <option value="TRIMESTRAL">Plano: Trimestral</option>
              <option value="ANUAL">Plano: Anual</option>
              <option value="TRIAL">Plano: Trial</option>
            </select>

            {/* Busca */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar cliente por nome, e-mail ou WhatsApp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black pl-9 pr-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Tabela de Assinantes */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-black">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-black text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="p-3.5">Cliente / Contato</th>
                <th className="p-3.5">Plano &amp; Valor</th>
                <th className="p-3.5">Vencimento</th>
                <th className="p-3.5">Status de Acesso</th>
                <th className="p-3.5 text-center">Ações de Controle (Admin)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-sans">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                    Nenhum cliente encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isAdmin = u.role === 'ADMIN';
                  const isPrimaryAdmin = u.email.toLowerCase() === INITIAL_ADMIN_USER.email.toLowerCase();

                  // Cálculo de dias para o vencimento
                  let expDaysText = 'Sem data';
                  let isExpired = false;
                  if (u.subscriptionExpiresAt) {
                    const exp = new Date(u.subscriptionExpiresAt);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    exp.setHours(0, 0, 0, 0);
                    const diffTime = exp.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) {
                      isExpired = true;
                      expDaysText = `Vencido há ${Math.abs(diffDays)} dia(s)`;
                    } else if (diffDays === 0) {
                      expDaysText = 'Vence Hoje! ⚠️';
                    } else {
                      expDaysText = `Vence em ${diffDays} dia(s)`;
                    }
                  }

                  return (
                    <tr key={u.id} className="hover:bg-slate-900/60 transition">
                      {/* Cliente / Contato */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold font-mono text-sm text-white shrink-0 ${
                              isAdmin
                                ? 'bg-purple-600'
                                : u.active
                                ? 'bg-emerald-600'
                                : 'bg-rose-600'
                            }`}
                          >
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white">{u.name}</span>
                              {isAdmin && (
                                <span className="rounded bg-violet-500/20 px-1.5 py-0.2 text-[9px] font-extrabold text-violet-300 border border-violet-500/30">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono block">{u.email}</span>
                            {u.whatsapp && (
                              <button
                                type="button"
                                onClick={() => handleSendWhatsappBilling(u)}
                                className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:underline mt-0.5 font-mono"
                                title="Enviar mensagem via WhatsApp"
                              >
                                <Phone className="h-3 w-3 text-emerald-400" />
                                <span>{u.whatsapp}</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Plano & Valor */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="inline-block rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-200 border border-slate-700">
                          {u.subscriptionPlan || 'MENSAL'}
                        </span>
                        <div className="text-xs font-mono font-bold text-emerald-400 mt-1">
                          {formatCurrency(u.monthlyPrice ?? 97)}
                          <span className="text-[10px] text-slate-500 font-normal"> /período</span>
                        </div>
                      </td>

                      {/* Vencimento */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-mono text-xs font-bold text-slate-200">
                          {u.subscriptionExpiresAt
                            ? u.subscriptionExpiresAt.split('-').reverse().join('/')
                            : 'Não configurado'}
                        </div>
                        <span
                          className={`inline-block mt-0.5 text-[10px] font-bold ${
                            isExpired
                              ? 'text-rose-400'
                              : expDaysText.includes('Hoje')
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {expDaysText}
                        </span>
                      </td>

                      {/* Status de Acesso */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-sm ${
                            u.active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {u.active ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              <span>ATIVO (Adimplente)</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 text-rose-400" />
                              <span>INADIMPLENTE (Sem Pagamento)</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Ações de Controle */}
                      <td className="p-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Toggle Ativar / Desativar por falta de pagamento */}
                          <button
                            type="button"
                            disabled={isPrimaryAdmin}
                            onClick={() => handleToggleStatus(u)}
                            title={
                              u.active
                                ? 'Bloquear acesso do cliente por inadimplência'
                                : 'Reativar acesso do cliente após confirmação de pagamento'
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-30 disabled:cursor-not-allowed ${
                              u.active
                                ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80 hover:bg-rose-900 hover:text-white'
                                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900 hover:text-white'
                            }`}
                          >
                            {u.active ? 'Bloquear Inadimplente' : 'Ativar Acesso'}
                          </button>

                          {/* Renovação Rápida (+30 dias) */}
                          <button
                            type="button"
                            onClick={() => handleRenew30Days(u)}
                            title="Adicionar +30 dias de acesso à assinatura"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
                          >
                            <Clock className="h-3.5 w-3.5 text-emerald-400" />
                            <span>+30 dias</span>
                          </button>

                          {/* Cobrança via WhatsApp */}
                          <button
                            type="button"
                            onClick={() => handleSendWhatsappBilling(u)}
                            title="Enviar cobrança / lembrete de renovação pelo WhatsApp"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 text-xs font-bold transition"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Cobrar</span>
                          </button>

                          {/* Editar Assinatura */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            title="Editar plano, mensalidade e vencimento"
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 transition"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                          </button>

                          {/* Redefinir Senha */}
                          <button
                            type="button"
                            onClick={() => {
                              setResetModalUserId(u.id);
                              setNewPasswordVal('123456');
                            }}
                            title="Redefinir senha"
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </button>

                          {/* Excluir Cliente */}
                          <button
                            type="button"
                            disabled={isPrimaryAdmin}
                            onClick={() => handleDeleteUser(u)}
                            title="Excluir cadastro"
                            className="p-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900 text-rose-400 border border-rose-800/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL INTERNO: EDIÇÃO DE ASSINATURA */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-black p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-400" />
                <span>Editar Assinatura — {editingUser.name}</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                  Plano Contratado
                </label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value as SubscriptionPlan)}
                  className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2.5 text-xs font-bold text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="MENSAL">MENSAL</option>
                  <option value="TRIMESTRAL">TRIMESTRAL</option>
                  <option value="ANUAL">ANUAL</option>
                  <option value="TRIAL">TRIAL</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                  Valor da Mensalidade (R$)
                </label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2.5 text-xs font-mono font-bold text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                  Data de Vencimento
                </label>
                <input
                  type="date"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2.5 text-xs font-mono font-bold text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                  WhatsApp do Cliente
                </label>
                <input
                  type="text"
                  placeholder="11999998888"
                  value={editWhatsapp}
                  onChange={(e) => setEditWhatsapp(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-black px-3 py-2.5 text-xs font-mono font-bold text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditSubscription}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTERNO: REDEFINIÇÃO DE SENHA */}
      {resetModalUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-xs rounded-2xl border border-slate-800 bg-black p-5 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400" /> Redefinir Senha do Cliente
            </h4>
            <p className="text-xs text-slate-400">
              Digite a nova senha de acesso:
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
    </div>
  );
};
