import React, { useState } from 'react';
import { Lock, Mail, ShieldAlert, ArrowRight, Activity, Eye, EyeOff } from 'lucide-react';
import { authenticateUser } from '../utils/auth';
import { SystemUser } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: SystemUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const res = authenticateUser(email, password);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.message || 'Erro ao realizar login.');
        setIsSubmitting(false);
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-slate-100 selection:bg-emerald-500 selection:text-white p-4 overflow-y-auto">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-black to-black pointer-events-none" />

      {/* Main Container */}
      <div className="relative w-full max-w-md my-auto">
        {/* Header Logo */}
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white mb-4 border border-emerald-400/30">
            <Activity className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            TRADER JOURNAL
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistema de Diário Operacional & Gestão de Risco Anti-Fúria
          </p>
        </div>

        {/* Card Box */}
        <div className="rounded-3xl border border-slate-800 bg-black/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-400" />
              <span>Acesso ao Sistema</span>
            </h2>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 text-xs text-rose-200 animate-fadeIn">
              <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-semibold">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Field: Email */}
            <div>
              <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-1.5">
                E-mail de Acesso
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-3 text-slate-400 pointer-events-none">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-black pl-10 pr-4 py-3 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition font-mono"
                />
              </div>
            </div>

            {/* Field: Password */}
            <div>
              <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-1.5">
                Senha
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-3 text-slate-400 pointer-events-none">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-black pl-10 pr-10 py-3 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-sm font-black text-white transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isSubmitting ? 'Acessando...' : 'Entrar no Diário'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
