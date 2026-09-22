import React from 'react';
import { X, Smartphone, Monitor } from 'lucide-react';
import { TradeLockMobileApp } from '../../mobile/src/App';

interface TradeLockMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TradeLockMobileModal: React.FC<TradeLockMobileModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative flex flex-col items-center max-w-full">
        {/* Header Controls */}
        <div className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 rounded-t-2xl px-5 py-3 text-white mb-2 shadow-lg">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold font-mono">SIMULADOR TRADELOCK MOBILE</h2>
              <p className="text-[10px] text-slate-400">Ambiente de Teste no Computador (Android &amp; iOS)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Smartphone Shell Frame (iPhone 15 Pro Style) */}
        <div className="relative w-[380px] h-[740px] bg-slate-950 rounded-[48px] border-[10px] border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col">
          {/* Dynamic Island / Speaker Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-50 flex items-center justify-center border border-slate-800/50">
            <div className="w-2 h-2 rounded-full bg-slate-900 mr-2" />
            <div className="w-3 h-3 rounded-full bg-slate-900" />
          </div>

          {/* Mobile Screen Content Wrapper */}
          <div className="flex-1 overflow-y-auto bg-black pt-6">
            <TradeLockMobileApp />
          </div>

          {/* Mobile Navigation Bar Line */}
          <div className="h-4 bg-black flex items-center justify-center shrink-0 border-t border-slate-900">
            <div className="w-32 h-1 bg-slate-700 rounded-full" />
          </div>
        </div>

        {/* Instructional Footer */}
        <p className="mt-3 text-xs text-slate-400 font-mono text-center max-w-md">
          💡 Dica: Este simulador roda a mesma aplicação móvel nativa que responderá aos eventos do Supabase Realtime no celular.
        </p>
      </div>
    </div>
  );
};
