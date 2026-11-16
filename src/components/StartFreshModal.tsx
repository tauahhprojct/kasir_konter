import React, { useState } from 'react';
import { X } from 'lucide-react';

interface StartFreshModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cash: number, bank: number, server: number) => void;
}

export const StartFreshModal: React.FC<StartFreshModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [cash, setCash] = useState('500000');
  const [bank, setBank] = useState('1000000');
  const [server, setServer] = useState('1000000');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(Number(cash) || 0, Number(bank) || 0, Number(server) || 0);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-fresh-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 id="start-fresh-title" className="text-base font-bold text-slate-900">
            Mulai Pembukuan Baru dari Nol
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Semua transaksi contoh akan dihapus dan Anda bisa langsung memasukkan saldo awal konter Anda saat ini. Katalog harga produk tetap dipertahankan.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Saldo Awal Cash Laci Konter (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Saldo Awal Rekening / QRIS (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Saldo Awal Server Pulsa / PPOB (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={server}
              onChange={(e) => setServer(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Kosongkan &amp; Mulai Baru
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
