import React from 'react';
import { AuthUser } from '../supabase';
import { LogIn, Plus } from 'lucide-react';
import { ActiveTab } from '../types/ledger';

interface TopBarProps {
  activeTab: ActiveTab;
  shopName: string;
  user: AuthUser | null;
  onSignInGoogle: () => void;
  onOpenNewTransaction: () => void;
}

const TAB_TITLES: Record<ActiveTab, string> = {
  dashboard: 'Ringkasan Kesehatan Kas',
  ledger: 'Buku Kas & Transaksi',
  kasbon: 'Piutang & Tagihan Kasbon',
  wallets: 'Dompet, Saldo Server & Tutup Buku',
  catalog: 'Katalog Produk & Cek Margin',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  shopName,
  user,
  onSignInGoogle,
  onOpenNewTransaction,
}) => {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="font-bold text-slate-900 lg:hidden whitespace-nowrap shrink-0">
          KasirKonter
        </span>
        <span className="hidden lg:inline text-slate-500 whitespace-nowrap shrink-0">
          {shopName}
        </span>
        <span className="text-slate-300" aria-hidden="true">
          /
        </span>
        <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
          {TAB_TITLES[activeTab]}
        </h1>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {!user && (
          <button
            type="button"
            onClick={onSignInGoogle}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Masuk</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenNewTransaction}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Catat Transaksi</span>
        </button>
      </div>
    </header>
  );
};
