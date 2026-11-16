import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Search,
  Trash2,
} from 'lucide-react';
import {
  PaymentStatus,
  Transaction,
  TransactionType,
  Wallet,
} from '../types/ledger';
import {
  exportTransactionsCSV,
  formatDateTimeID,
  formatRupiah,
  toLocalDateKey,
} from '../utils/format';
import { ModalMode } from './TransactionModal';

interface LedgerViewProps {
  transactions: Transaction[];
  wallets: Wallet[];
  onDeleteTransaction: (id: string) => void;
  onSelectSettleKasbon: (tx: Transaction) => void;
  onOpenModal: (mode: ModalMode) => void;
}

type TypeFilter = 'all' | TransactionType;
type StatusFilter = 'all' | PaymentStatus;
type DateFilter = 'all' | 'today' | '7days' | 'month';

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  wallets,
  onDeleteTransaction,
  onSelectSettleKasbon,
  onOpenModal,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const walletMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const w of wallets) map[w.id] = w.name;
    return map;
  }, [wallets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const todayKey = toLocalDateKey(new Date());
    const now = new Date();
    const start7Days = new Date();
    start7Days.setDate(now.getDate() - 6);
    start7Days.setHours(0, 0, 0, 0);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;

      if (dateFilter !== 'all') {
        const d = new Date(tx.createdAt);
        if (dateFilter === 'today' && toLocalDateKey(d) !== todayKey) return false;
        if (dateFilter === '7days' && d < start7Days) return false;
        if (dateFilter === 'month' && d < startMonth) return false;
      }

      if (q) {
        const hay = [
          tx.productName,
          tx.category,
          tx.customerName,
          tx.targetNumber,
          tx.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [transactions, search, typeFilter, statusFilter, dateFilter]);

  const totals = useMemo(() => {
    let totalOmzet = 0;
    let totalCost = 0;
    let totalNetProfit = 0;

    for (const tx of filtered) {
      if (tx.type === TransactionType.SALE) {
        totalOmzet += tx.sellPrice;
        totalCost += tx.costPrice;
      } else if (tx.type === TransactionType.EXPENSE) {
        totalCost += tx.costPrice;
      }
      totalNetProfit += tx.profit;
    }

    return { totalOmzet, totalCost, totalNetProfit };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk, nama pelanggan, atau nomor HP/PLN..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter rentang waktu"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            >
              <option value="all">Semua Waktu</option>
              <option value="today">Hari Ini</option>
              <option value="7days">7 Hari Terakhir</option>
              <option value="month">Bulan Ini</option>
            </select>

            <select
              aria-label="Filter status pembayaran"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            >
              <option value="all">Semua Status</option>
              <option value={PaymentStatus.PAID}>Lunas</option>
              <option value={PaymentStatus.KASBON}>Kasbon</option>
            </select>

            <button
              type="button"
              onClick={() => exportTransactionsCSV(filtered, walletMap)}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh CSV
            </button>
          </div>
        </div>

        {/* Type Segmented Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
            {(
              [
                { id: 'all', label: 'Semua' },
                { id: TransactionType.SALE, label: 'Penjualan' },
                { id: TransactionType.EXPENSE, label: 'Pengeluaran' },
                { id: TransactionType.TOPUP, label: 'Top Up Server' },
              ] as { id: TypeFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  typeFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-600 font-mono tabular-nums flex flex-wrap items-center gap-4">
            <span>{filtered.length} baris</span>
            <span>
              Omzet: <strong className="text-slate-900">{formatRupiah(totals.totalOmzet)}</strong>
            </span>
            <span>
              Net Laba:{' '}
              <strong
                className={totals.totalNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}
              >
                {formatRupiah(totals.totalNetProfit, true)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* High-Density Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              Tidak ada transaksi yang cocok
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Ubah filter pencarian di atas atau catat transaksi baru untuk mengisi buku kas konter Anda.
            </p>
            <button
              type="button"
              onClick={() => onOpenModal('sale')}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
            >
              Catat Transaksi Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Waktu</th>
                  <th className="py-2.5 px-4">Transaksi &amp; Tujuan</th>
                  <th className="py-2.5 px-4">Pelanggan / Alur Saldo</th>
                  <th className="py-2.5 px-4 text-right">Modal / Keluar</th>
                  <th className="py-2.5 px-4 text-right">Harga Jual</th>
                  <th className="py-2.5 px-4 text-right">Laba / Dampak</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((tx) => {
                  const isSale = tx.type === TransactionType.SALE;
                  const isExpense = tx.type === TransactionType.EXPENSE;
                  const isTopup = tx.type === TransactionType.TOPUP;
                  const isKasbon = tx.status === PaymentStatus.KASBON;

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
                        {formatDateTimeID(tx.createdAt)}
                      </td>

                      <td className="py-2.5 px-4 max-w-[240px]">
                        <div className="font-medium text-slate-900 truncate">
                          {tx.productName}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {tx.category}
                          {tx.targetNumber ? (
                            <span className="font-mono"> · {tx.targetNumber}</span>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 max-w-[220px]">
                        <div className="text-xs font-medium text-slate-800 truncate">
                          {tx.customerName || (isTopup ? 'Mutasi Deposit Server' : isExpense ? 'Biaya Konter' : 'Pembeli Umum')}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {walletMap[tx.sourceWalletId] || tx.sourceWalletId}
                          {tx.destinationWalletId
                            ? ` → ${walletMap[tx.destinationWalletId] || tx.destinationWalletId}`
                            : ''}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {isTopup
                          ? formatRupiah(tx.costPrice + tx.adminFee)
                          : formatRupiah(tx.costPrice)}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs font-medium text-slate-900 whitespace-nowrap">
                        {isSale ? formatRupiah(tx.sellPrice) : '—'}
                      </td>

                      <td
                        className={`py-2.5 px-4 text-right font-mono tabular-nums text-xs font-semibold whitespace-nowrap ${
                          tx.profit > 0
                            ? 'text-emerald-700'
                            : tx.profit < 0
                            ? 'text-rose-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {tx.profit === 0 ? 'Rp 0' : formatRupiah(tx.profit, true)}
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {isKasbon ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                            <Clock className="w-3.5 h-3.5" />
                            Kasbon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Lunas
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {isKasbon && (
                            <button
                              type="button"
                              onClick={() => onSelectSettleKasbon(tx)}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
                            >
                              Lunasi
                            </button>
                          )}

                          {confirmDeleteId === tx.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteTransaction(tx.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(tx.id)}
                              aria-label={`Hapus transaksi ${tx.productName}`}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
