import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Transaction, Wallet } from '../types/ledger';
import { formatDateID, formatRupiah } from '../utils/format';

interface SettleKasbonModalProps {
  transaction: Transaction | null;
  wallets: Wallet[];
  onClose: () => void;
  onConfirm: (txId: string, destinationWalletId: string) => void;
}

export const SettleKasbonModal: React.FC<SettleKasbonModalProps> = ({
  transaction,
  wallets,
  onClose,
  onConfirm,
}) => {
  const receivingWallets = wallets.filter((w) => w.kind === 'cash' || w.kind === 'bank');
  const [destId, setDestId] = useState(receivingWallets[0]?.id || wallets[0]?.id || '');

  useEffect(() => {
    if (transaction && receivingWallets.length > 0) {
      setDestId(receivingWallets[0].id);
    }
  }, [transaction, wallets]);

  if (!transaction) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settle-kasbon-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 id="settle-kasbon-title" className="text-base font-bold text-slate-900">
            Lunasi Tagihan Kasbon
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

        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              {transaction.customerName || 'Pelanggan'}
            </div>
            <div className="text-xs text-slate-600">
              {transaction.productName} · {formatDateID(transaction.createdAt)}
            </div>
            <div className="pt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
              {formatRupiah(transaction.sellPrice)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Pembayaran Diterima Masuk Ke Dompet
            </label>
            <select
              value={destId}
              onChange={(e) => setDestId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            >
              {receivingWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (Saat ini: {formatRupiah(w.balance)})
                </option>
              ))}
            </select>
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
              type="button"
              onClick={() => {
                onConfirm(transaction.id, destId);
                onClose();
              }}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              Tandai Lunas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
