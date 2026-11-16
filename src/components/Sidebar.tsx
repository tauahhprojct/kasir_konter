import React, { useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Wallet as WalletIcon,
  Tag,
  Download,
  Upload,
  RotateCcw,
  LogIn,
  LogOut,
  Cloud,
} from 'lucide-react';
import { ActiveTab } from '../types/ledger';
import { formatCompactRupiah } from '../utils/format';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  shopName: string;
  onRenameShop: (name: string) => void;
  kasbonCount: number;
  kasbonTotal: number;
  user: User | null;
  isCloudActive: boolean;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onExportBackup: () => void;
  onImportBackup: (json: string) => boolean;
  onOpenStartFresh: () => void;
  onResetDemo: () => void;
}

const NAV_ITEMS: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'ledger', label: 'Buku Kas', icon: BookOpen },
  { id: 'kasbon', label: 'Piutang & Kasbon', icon: Users },
  { id: 'wallets', label: 'Dompet & Tutup Buku', icon: WalletIcon },
  { id: 'catalog', label: 'Katalog Harga', icon: Tag },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  shopName,
  onRenameShop,
  kasbonCount,
  kasbonTotal,
  user,
  isCloudActive,
  onSignInGoogle,
  onSignOut,
  onExportBackup,
  onImportBackup,
  onOpenStartFresh,
  onResetDemo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(shopName);
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);

  const handleSaveName = () => {
    onRenameShop(draftName);
    setEditingName(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = onImportBackup(String(reader.result || ''));
      setBackupFeedback(ok ? 'Data berhasil dipulihkan.' : 'File backup tidak valid.');
      setTimeout(() => setBackupFeedback(null), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:shrink-0 bg-white border-r border-slate-200/90 min-h-screen justify-between">
        <div>
          <div className="px-5 py-5 border-b border-slate-100">
            <div className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              KasirKonter
            </div>
            {editingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveName();
                }}
                className="mt-1.5 flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={handleSaveName}
                  autoFocus
                  maxLength={60}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-teal-600"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraftName(shopName);
                  setEditingName(true);
                }}
                title="Klik untuk ubah nama konter"
                className="mt-0.5 text-xs text-slate-500 hover:text-slate-900 transition-colors truncate max-w-full text-left block"
              >
                {shopName}
              </button>
            )}
          </div>

          <nav aria-label="Menu utama" className="px-3 py-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'kasbon' && kasbonCount > 0 && (
                    <span
                      className={`text-xs font-mono tabular-nums ml-2 shrink-0 ${
                        isActive ? 'text-amber-300' : 'text-amber-700'
                      }`}
                    >
                      {kasbonCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {kasbonCount > 0 && (
            <div className="mx-3 mt-2 p-4 rounded-xl border border-amber-200/80 bg-amber-50/60">
              <div className="text-xs font-medium text-amber-900">Kasbon Belum Lunas</div>
              <div className="mt-1 text-base font-bold font-mono tabular-nums text-amber-950">
                {formatCompactRupiah(kasbonTotal)}
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('kasbon')}
                className="mt-2 text-xs font-semibold text-amber-800 hover:text-amber-950 underline underline-offset-2"
              >
                Tagih {kasbonCount} transaksi
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 space-y-3">
          {/* Cloud Database Sync Status & Auth */}
          {user ? (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Akun Google'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-teal-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {user.displayName || 'Akun Terhubung'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                    <Cloud className="w-3 h-3 text-teal-700 shrink-0" />
                    <span>{isCloudActive ? 'Firestore Aktif' : 'Menghubungkan...'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar Akun
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignInGoogle}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              Masuk Google (Cloud DB)
            </button>
          )}

          {backupFeedback && (
            <div className="text-xs text-teal-700 font-medium">{backupFeedback}</div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onExportBackup}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Backup
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              Pulihkan
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="pt-0.5 flex items-center justify-between text-xs text-slate-500">
            <button
              type="button"
              onClick={onOpenStartFresh}
              className="hover:text-slate-900 underline underline-offset-2 transition-colors"
            >
              Mulai dari nol
            </button>
            <button
              type="button"
              onClick={onResetDemo}
              className="flex items-center gap-1 hover:text-slate-900 transition-colors"
              title="Kembalikan data contoh"
            >
              <RotateCcw className="w-3 h-3" />
              Contoh
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile compact bottom navigation (56px height) */}
      <nav
        aria-label="Navigasi seluler"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 h-14 px-2 flex items-center justify-around"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] h-11 px-1 rounded-md text-[11px] font-medium transition-colors ${
                isActive ? 'text-teal-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate max-w-[64px]">
                {item.id === 'wallets'
                  ? 'Dompet'
                  : item.id === 'kasbon'
                  ? 'Kasbon'
                  : item.id === 'catalog'
                  ? 'Harga'
                  : item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
