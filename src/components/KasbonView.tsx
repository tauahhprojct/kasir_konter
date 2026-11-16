import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  MessageCircle,
  Search,
} from 'lucide-react';
import { PaymentStatus, Transaction, TransactionType, Wallet } from '../types/ledger';
import {
  buildKasbonReminderText,
  cleanPhoneForWA,
  formatDateID,
  formatRupiah,
} from '../utils/format';

interface KasbonViewProps {
  transactions: Transaction[];
  wallets: Wallet[];
  onSelectSettleKasbon: (tx: Transaction) => void;
  onOpenNewKasbon: () => void;
}

export const KasbonView: React.FC<KasbonViewProps> = ({
  transactions,
  wallets,
  onSelectSettleKasbon,
  onOpenNewKasbon,
}) => {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const walletMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const w of wallets) map[w.id] = w.name;
    return map;
  }, [wallets]);

  const unpaidKasbons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((t) => t.type === TransactionType.SALE && t.status === PaymentStatus.KASBON)
      .filter((t) => {
        if (!q) return true;
        return [t.customerName, t.customerPhone, t.productName, t.targetNumber, t.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      });
  }, [transactions, search]);

  const settledKasbons = useMemo(
    () =>
      transactions
        .filter(
          (t) =>
            t.type === TransactionType.SALE &&
            t.status === PaymentStatus.PAID &&
            t.paidAt &&
            t.paidAt !== t.createdAt
        )
        .slice(0, 10),
    [transactions]
  );

  const totalPiutang = useMemo(
    () => unpaidKasbons.reduce((sum, t) => sum + t.sellPrice, 0),
    [unpaidKasbons]
  );

  const totalModalNyangkut = useMemo(
    () => unpaidKasbons.reduce((sum, t) => sum + t.costPrice, 0),
    [unpaidKasbons]
  );

  const uniqueCustomers = useMemo(() => {
    const set = new Set(
      unpaidKasbons.map((t) => (t.customerName || 'Tanpa Nama').trim().toLowerCase())
    );
    return set.size;
  }, [unpaidKasbons]);

  const handleCopyReminder = async (tx: Transaction) => {
    const text = buildKasbonReminderText(tx);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(tx.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Clipboard might be restricted in some environments
    }
  };

  return (
    <div className="space-y-6">
      {/* Top 3-column summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5">
          <div className="text-xs font-medium text-slate-500">Total Tagihan Kasbon</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
            {formatRupiah(totalPiutang)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Dari {unpaidKasbons.length} nota belum dibayar
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5">
          <div className="text-xs font-medium text-slate-500">Modal Saldo Tertahan</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatRupiah(totalModalNyangkut)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Modal server yang sudah keluar untuk kasbon ini
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5">
          <div className="text-xs font-medium text-slate-500">Jumlah Pelanggan Berutang</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {uniqueCustomers} orang
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Segera tagih agar perputaran modal tetap lancar
          </div>
        </div>
      </div>

      {/* Unpaid Kasbon Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Kasbon Belum Lunas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kirim pengingat WhatsApp atau tandai lunas saat pelanggan sudah membayar
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pelanggan / nomor..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        {unpaidKasbons.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              Tidak ada kasbon yang menunggak
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Semua penjualan pulsa dan PPOB Anda sudah dibayar lunas. Jika ada pelanggan yang berutang, catat dengan status Kasbon agar tidak lupa ditagih.
            </p>
            <button
              type="button"
              onClick={onOpenNewKasbon}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
            >
              Catat Transaksi Baru
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {unpaidKasbons.map((tx) => {
              const waDigits = cleanPhoneForWA(tx.customerPhone);
              const waUrl = waDigits
                ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
                    buildKasbonReminderText(tx)
                  )}`
                : null;
              const isCopied = copiedId === tx.id;

              return (
                <div
                  key={tx.id}
                  className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-sm font-bold text-slate-900">
                        {tx.customerName || 'Pelanggan Tanpa Nama'}
                      </span>
                      {tx.customerPhone && (
                        <span className="text-xs font-mono text-slate-500">
                          · {tx.customerPhone}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-700">
                      {tx.productName}
                      {tx.targetNumber ? (
                        <span className="font-mono text-slate-500"> ({tx.targetNumber})</span>
                      ) : null}
                      <span className="text-slate-400"> · </span>
                      <span className="text-slate-500">Tanggal {formatDateID(tx.createdAt)}</span>
                      {tx.notes ? (
                        <>
                          <span className="text-slate-400"> · </span>
                          <span className="text-slate-500 italic">{tx.notes}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0">
                    <div className="text-left lg:text-right mr-2">
                      <div className="text-base font-bold font-mono tabular-nums text-amber-800">
                        {formatRupiah(tx.sellPrice)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500">
                        Modal {formatRupiah(tx.costPrice)} · Untung {formatRupiah(tx.profit)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyReminder(tx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Tersalin
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Salin Tagihan
                          </>
                        )}
                      </button>

                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Kirim WA
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectSettleKasbon(tx)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Lunasi
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recently Settled Kasbons */}
      {settledKasbons.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Riwayat Kasbon yang Sudah Dilunasi
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {settledKasbons.map((tx) => (
              <div
                key={tx.id}
                className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-900 truncate">
                    {tx.customerName || 'Pelanggan'}
                  </span>
                  <span className="text-slate-500 truncate">
                    · {tx.productName} · Masuk ke{' '}
                    {tx.destinationWalletId ? walletMap[tx.destinationWalletId] : 'Kas'}
                  </span>
                </div>
                <div className="font-mono tabular-nums font-semibold text-emerald-700 shrink-0">
                  {formatRupiah(tx.sellPrice)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
