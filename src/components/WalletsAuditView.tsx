import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Plus,
  Scale,
} from 'lucide-react';
import { AuditRecord, Wallet, WalletKind } from '../types/ledger';
import { formatDateTimeID, formatRupiah } from '../utils/format';
import { ModalMode } from './TransactionModal';

interface WalletsAuditViewProps {
  wallets: Wallet[];
  audits: AuditRecord[];
  onAddWallet: (name: string, kind: WalletKind, balance: number) => void;
  onUpdateWallet: (id: string, newBalance: number, newName?: string) => void;
  onRecordAudit: (
    walletId: string,
    actualBalance: number,
    applyAdjustment: boolean,
    notes?: string
  ) => void;
  onOpenModal: (mode: ModalMode) => void;
}

export const WalletsAuditView: React.FC<WalletsAuditViewProps> = ({
  wallets,
  audits,
  onAddWallet,
  onUpdateWallet,
  onRecordAudit,
  onOpenModal,
}) => {
  // Add Wallet inline form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<WalletKind>('server');
  const [newBalance, setNewBalance] = useState('0');

  // Edit wallet inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');

  // Audit / Tutup Buku state
  const [auditWalletId, setAuditWalletId] = useState(wallets[0]?.id || '');
  const [actualBalanceInput, setActualBalanceInput] = useState('');
  const [applyAdjustment, setApplyAdjustment] = useState(true);
  const [auditNotes, setAuditNotes] = useState('');
  const [auditSavedMsg, setAuditSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!wallets.some((w) => w.id === auditWalletId) && wallets[0]) {
      setAuditWalletId(wallets[0].id);
    }
  }, [wallets, auditWalletId]);

  const selectedAuditWallet = wallets.find((w) => w.id === auditWalletId) || wallets[0];
  const hasActualInput = actualBalanceInput.trim() !== '';
  const actualNum = Number(actualBalanceInput) || 0;
  const auditDiff = selectedAuditWallet ? actualNum - selectedAuditWallet.balance : 0;

  const handleAddWalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAddWallet(newName, newKind, Number(newBalance) || 0);
    setNewName('');
    setNewBalance('0');
    setShowAddForm(false);
  };

  const handleStartEdit = (w: Wallet) => {
    setEditingId(w.id);
    setEditName(w.name);
    setEditBalance(String(w.balance));
  };

  const handleSaveEdit = (id: string) => {
    onUpdateWallet(id, Number(editBalance) || 0, editName);
    setEditingId(null);
  };

  const handleSubmitAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuditWallet || !hasActualInput) return;
    onRecordAudit(selectedAuditWallet.id, actualNum, applyAdjustment, auditNotes.trim() || undefined);
    setActualBalanceInput('');
    setAuditNotes('');
    setAuditSavedMsg('Hasil cek selisih tutup buku berhasil dicatat.');
    setTimeout(() => setAuditSavedMsg(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Wallet Management Section */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Dompet &amp; Saldo Server
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pisahkan uang tunai laci, rekening bank/QRIS, dan deposit server pulsa agar modal tidak tercampur
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenModal('topup')}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              Transfer / Top Up Saldo
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Dompet
            </button>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddWalletSubmit}
            className="p-4 sm:px-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Dompet / Server
              </label>
              <input
                type="text"
                required
                placeholder="cth: Server Digipos / BRI"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Jenis</label>
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as WalletKind)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              >
                <option value="server">Saldo Server Pulsa / PPOB</option>
                <option value="bank">Rekening Bank / QRIS</option>
                <option value="cash">Uang Tunai (Cash)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Saldo Saat Ini (Rp)
              </label>
              <input
                type="number"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {wallets.map((w) => (
            <div
              key={w.id}
              className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {editingId === w.id ? (
                <div className="flex flex-wrap items-center gap-3 w-full">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="number"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className="px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg w-44"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(w.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{w.name}</div>
                    <div className="text-xs text-slate-500">
                      {w.kind === 'cash'
                        ? 'Uang Tunai Laci'
                        : w.kind === 'bank'
                        ? 'Rekening Bank / QRIS'
                        : 'Saldo Deposit Server'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                      {formatRupiah(w.balance)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(w)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Ubah
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tutup Buku / Rekonsiliasi Anti-Boncos */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-6 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Scale className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Cek Selisih &amp; Tutup Buku Harian (Anti-Boncos)
            </h2>
          </div>

          <p className="mt-3 text-xs text-slate-600 leading-relaxed">
            Cocokkan catatan pembukuan dengan uang fisik di laci atau saldo asli di aplikasi server Anda. Jika minus, berarti ada transaksi lupa catat, kasbon terlewat, atau uang terpakai.
          </p>

          {auditSavedMsg && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
              {auditSavedMsg}
            </div>
          )}

          <form onSubmit={handleSubmitAudit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pilih Dompet yang Diperiksa
              </label>
              <select
                value={auditWalletId}
                onChange={(e) => setAuditWalletId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} (Sistem: {formatRupiah(w.balance)})
                  </option>
                ))}
              </select>
            </div>

            {selectedAuditWallet && (
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <div className="text-[11px] text-slate-500">Catatan Sistem</div>
                  <div className="mt-0.5 text-base font-bold font-mono tabular-nums text-slate-900">
                    {formatRupiah(selectedAuditWallet.balance)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Hitung Fisik / App Aktual</div>
                  <input
                    type="number"
                    required
                    placeholder="Masukkan angka nyata"
                    value={actualBalanceInput}
                    onChange={(e) => setActualBalanceInput(e.target.value)}
                    className="mt-0.5 w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            )}

            {hasActualInput && selectedAuditWallet && (
              <div
                className={`p-3.5 rounded-lg border flex items-center justify-between text-xs ${
                  auditDiff === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : auditDiff < 0
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  {auditDiff === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  {auditDiff === 0
                    ? 'Cocok! Saldo fisik/server pas dengan pembukuan.'
                    : auditDiff < 0
                    ? 'Selisih Minus (Indikasi kebocoran / lupa catat pengeluaran atau kasbon)'
                    : 'Selisih Lebih (Ada uang masuk yang belum tercatat)'}
                </span>
                <span className="font-mono tabular-nums font-bold text-sm">
                  {formatRupiah(auditDiff, true)}
                </span>
              </div>
            )}

            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={applyAdjustment}
                onChange={(e) => setApplyAdjustment(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>
                Otomatis sesuaikan saldo sistem ke angka aktual dan catat selisihnya di Buku Kas
              </span>
            </label>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Catatan Audit (Opsional)
              </label>
              <input
                type="text"
                placeholder="cth: Tutup buku shift malam"
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <button
              type="submit"
              disabled={!hasActualInput}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-lg transition-colors"
            >
              Simpan Hasil Cek Selisih
            </button>
          </form>
        </div>

        {/* Audit History */}
        <div className="xl:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Riwayat Cek Selisih &amp; Tutup Buku
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Jejak pemeriksaan fisik laci dan saldo server
            </p>
          </div>

          {audits.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Belum ada riwayat tutup buku. Lakukan cek selisih setiap malam sebelum menutup konter agar kebocoran langsung ketahuan.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {audits.map((aud) => (
                <div
                  key={aud.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {aud.walletName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTimeID(aud.createdAt)}
                      {aud.notes ? ` · ${aud.notes}` : ''}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                      Sistem {formatRupiah(aud.systemBalance)} → Aktual{' '}
                      {formatRupiah(aud.actualBalance)}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-bold font-mono tabular-nums shrink-0 ${
                      aud.difference === 0
                        ? 'text-emerald-700'
                        : aud.difference < 0
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {aud.difference === 0 ? 'Pas (Rp 0)' : formatRupiah(aud.difference, true)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
