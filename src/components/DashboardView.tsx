import React, { useMemo, useState } from 'react';
import { AuthUser } from '../supabase';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  Cloud,
  Landmark,
  LogIn,
  Smartphone,
  Wallet as WalletIcon,
} from 'lucide-react';
import {
  ActiveTab,
  PaymentStatus,
  Transaction,
  TransactionType,
  Wallet,
} from '../types/ledger';
import { formatDateID, formatRupiah, toLocalDateKey } from '../utils/format';
import { CashflowChart } from './CashflowChart';
import { ModalMode } from './TransactionModal';

interface DashboardViewProps {
  wallets: Wallet[];
  transactions: Transaction[];
  user: AuthUser | null;
  cloudLoading: boolean;
  authError: string | null;
  onSignInGoogle: () => void;
  onNavigate: (tab: ActiveTab) => void;
  onOpenModal: (mode: ModalMode) => void;
  onSelectSettleKasbon: (tx: Transaction) => void;
}

type PeriodFilter = 'today' | '7days' | 'month';

export const DashboardView: React.FC<DashboardViewProps> = ({
  wallets,
  transactions,
  user,
  cloudLoading,
  authError,
  onSignInGoogle,
  onNavigate,
  onOpenModal,
  onSelectSettleKasbon,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('today');

  const todayKey = toLocalDateKey(new Date());

  const filteredTx = useMemo(() => {
    const now = new Date();
    const startOf7Days = new Date();
    startOf7Days.setDate(now.getDate() - 6);
    startOf7Days.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return transactions.filter((tx) => {
      const txDate = new Date(tx.createdAt);
      if (period === 'today') {
        return toLocalDateKey(txDate) === todayKey;
      }
      if (period === '7days') {
        return txDate >= startOf7Days;
      }
      return txDate >= startOfMonth;
    });
  }, [transactions, period, todayKey]);

  const metrics = useMemo(() => {
    let omzet = 0;
    let totalCost = 0;
    let grossProfit = 0;
    let expensesAndFees = 0;
    let saleCount = 0;

    for (const tx of filteredTx) {
      if (tx.type === TransactionType.SALE) {
        omzet += tx.sellPrice;
        totalCost += tx.costPrice;
        grossProfit += tx.profit;
        saleCount += 1;
      } else if (tx.type === TransactionType.EXPENSE) {
        expensesAndFees += tx.costPrice;
      } else if (tx.type === TransactionType.TOPUP) {
        expensesAndFees += tx.adminFee;
      } else if (tx.type === TransactionType.ADJUSTMENT && tx.profit < 0) {
        expensesAndFees += Math.abs(tx.profit);
      }
    }

    const netProfit = grossProfit - expensesAndFees;
    return {
      omzet,
      totalCost,
      grossProfit,
      expensesAndFees,
      netProfit,
      saleCount,
    };
  }, [filteredTx]);

  const unpaidKasbons = useMemo(
    () =>
      transactions.filter(
        (t) => t.type === TransactionType.SALE && t.status === PaymentStatus.KASBON
      ),
    [transactions]
  );

  const totalKasbonAmount = useMemo(
    () => unpaidKasbons.reduce((sum, t) => sum + t.sellPrice, 0),
    [unpaidKasbons]
  );

  const totalWalletsBalance = useMemo(
    () => wallets.reduce((sum, w) => sum + w.balance, 0),
    [wallets]
  );

  const totalAsetUsaha = totalWalletsBalance + totalKasbonAmount;

  const lowBalanceServers = useMemo(
    () => wallets.filter((w) => w.kind === 'server' && w.balance <= w.lowThreshold),
    [wallets]
  );

  const isNegativeProfit = metrics.netProfit < 0;
  const periodLabel =
    period === 'today' ? 'Hari Ini' : period === '7days' ? '7 Hari Terakhir' : 'Bulan Ini';

  const walletMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const w of wallets) map[w.id] = w.name;
    return map;
  }, [wallets]);

  if (cloudLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="h-36 rounded-2xl bg-slate-200" />
          <div className="h-36 rounded-2xl bg-slate-200" />
          <div className="h-36 rounded-2xl bg-slate-200" />
          <div className="h-36 rounded-2xl bg-slate-200" />
        </div>
        <div className="h-32 rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 h-80 rounded-2xl bg-slate-200" />
          <div className="xl:col-span-5 h-80 rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cloud Database Sync Callout when browsing locally */}
      {!user && (
        <div className="bg-white border border-slate-200/90 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4 text-teal-700" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Aktifkan Sinkronisasi Database Cloud (Supabase)
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {authError ||
                  'Masuk dengan akun Google agar data transaksi, saldo server, dan kasbon tersimpan aman lintas perangkat.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignInGoogle}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            <LogIn className="w-3.5 h-3.5" />
            Masuk dengan Google
          </button>
        </div>
      )}

      {/* Workspace Toolbar: Period Switch + Quick Shortcuts */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-xl self-start">
          {(
            [
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari' },
              { id: 'month', label: 'Bulan Ini' },
            ] as { id: PeriodFilter; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                period === item.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenModal('expense')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
          >
            Catat Pengeluaran / Prive
          </button>
          <button
            type="button"
            onClick={() => onOpenModal('topup')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
          >
            Top Up Saldo Server
          </button>
        </div>
      </div>

      {/* Anti-Boncos Health Alert (Conditional on real accounting state) */}
      {(isNegativeProfit || lowBalanceServers.length > 0 || unpaidKasbons.length > 0) && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isNegativeProfit
              ? 'bg-rose-50/70 border-rose-200 text-rose-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                isNegativeProfit ? 'text-rose-600' : 'text-amber-600'
              }`}
            />
            <div className="text-xs sm:text-sm space-y-1">
              <div className="font-semibold">
                {isNegativeProfit
                  ? `Peringatan Boncos (${periodLabel}): Pengeluaran melebihi laba jualan!`
                  : 'Perhatian Arus Modal Konter'}
              </div>
              <div className="text-xs opacity-90 flex flex-wrap gap-x-3 gap-y-1">
                {isNegativeProfit && (
                  <span>
                    Laba kotor jualan {formatRupiah(metrics.grossProfit)}, namun pengeluaran &amp;
                    prive mencapai {formatRupiah(metrics.expensesAndFees)}.
                  </span>
                )}
                {unpaidKasbons.length > 0 && (
                  <span>
                    {unpaidKasbons.length} transaksi kasbon senilai{' '}
                    <strong className="font-mono tabular-nums">
                      {formatRupiah(totalKasbonAmount)}
                    </strong>{' '}
                    belum tertagih.
                  </span>
                )}
                {lowBalanceServers.length > 0 && (
                  <span>
                    Saldo menipis di {lowBalanceServers.map((s) => s.name).join(', ')}.
                  </span>
                )}
              </div>
            </div>
          </div>

          {unpaidKasbons.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('kasbon')}
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-amber-300 text-amber-950 hover:bg-amber-100/60 rounded-xl whitespace-nowrap shrink-0 self-start sm:self-center"
            >
              Cek Tagihan Kasbon
            </button>
          )}
        </div>
      )}

      {/* 4-Column Core KPI Strip with Dark Focal Anchor Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-300">
            Laba Bersih Riil ({periodLabel})
          </div>
          <div
            className={`mt-2.5 text-2xl sm:text-[26px] font-bold font-mono tabular-nums tracking-tight ${
              metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatRupiah(metrics.netProfit, true)}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-300 font-mono tabular-nums flex items-center justify-between gap-2">
            <span>Kotor {formatRupiah(metrics.grossProfit)}</span>
            <span>Keluar {formatRupiah(metrics.expensesAndFees)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500">
            Omzet Penjualan ({periodLabel})
          </div>
          <div className="mt-2.5 text-2xl sm:text-[26px] font-bold font-mono tabular-nums tracking-tight text-slate-900">
            {formatRupiah(metrics.omzet)}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span className="font-mono tabular-nums">{metrics.saleCount} transaksi</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Modal {formatRupiah(metrics.totalCost)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500">
            Pengeluaran &amp; Prive ({periodLabel})
          </div>
          <div className="mt-2.5 text-2xl sm:text-[26px] font-bold font-mono tabular-nums tracking-tight text-rose-700">
            {formatRupiah(metrics.expensesAndFees)}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Termasuk biaya admin &amp; ambil pribadi
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500">
            Total Kasbon Belum Lunas
          </div>
          <div className="mt-2.5 text-2xl sm:text-[26px] font-bold font-mono tabular-nums tracking-tight text-amber-700">
            {formatRupiah(totalKasbonAmount)}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            {unpaidKasbons.length === 0
              ? 'Semua pelanggan sudah lunas'
              : `${unpaidKasbons.length} nota menunggu pembayaran`}
          </div>
        </div>
      </div>

      {/* Wallets & Total Aset Modal Strip */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <WalletIcon className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Posisi Saldo Dompet &amp; Modal Usaha
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-600">
              Total Aset + Piutang:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatRupiah(totalAsetUsaha)}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('wallets')}
              className="font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              Cek Selisih / Tutup Buku →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {wallets.map((wallet) => {
            const isLow = wallet.balance <= wallet.lowThreshold;
            const ratio =
              wallet.lowThreshold > 0
                ? Math.min(100, Math.max(8, Math.round((wallet.balance / (wallet.lowThreshold * 4)) * 100)))
                : 100;
            const KindIcon =
              wallet.kind === 'cash'
                ? Banknote
                : wallet.kind === 'bank'
                ? Landmark
                : Smartphone;

            return (
              <div key={wallet.id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-600 truncate flex items-center gap-1.5">
                      <KindIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{wallet.name}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {wallet.kind === 'cash'
                        ? 'Tunai'
                        : wallet.kind === 'bank'
                        ? 'Bank/QRIS'
                        : 'Server'}
                    </span>
                  </div>
                  <div
                    className={`mt-2 text-lg font-bold font-mono tabular-nums ${
                      wallet.balance < 0
                        ? 'text-rose-700'
                        : isLow
                        ? 'text-amber-700'
                        : 'text-slate-900'
                    }`}
                  >
                    {formatRupiah(wallet.balance)}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(0, ratio)}%` }}
                      className={`h-full rounded-full ${
                        wallet.balance < 0
                          ? 'bg-rose-600'
                          : isLow
                          ? 'bg-amber-500'
                          : 'bg-teal-600'
                      }`}
                    />
                  </div>
                  {isLow && (
                    <div className="text-[11px] font-medium text-amber-700">
                      Saldo menipis, segera isi ulang
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Split: 7-Day Cashflow Chart + Actionable Kasbon & Recent Ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7">
          <CashflowChart transactions={transactions} />
        </div>

        <div className="xl:col-span-5 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Kasbon &amp; Transaksi Terbaru
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Prioritas penagihan dan aktivitas terakhir
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('ledger')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              Lihat Semua
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600">Belum ada catatan transaksi.</p>
              <button
                type="button"
                onClick={() => onOpenModal('sale')}
                className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl"
              >
                Catat Transaksi Pertama
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {unpaidKasbons.slice(0, 3).map((tx) => (
                <div
                  key={tx.id}
                  className="px-6 py-3.5 bg-amber-50/40 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 truncate">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">
                        {tx.customerName || 'Pelanggan'} — {tx.productName}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Kasbon · {formatDateID(tx.createdAt)}
                      {tx.notes ? ` · ${tx.notes}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2.5">
                    <div className="font-mono tabular-nums text-sm font-bold text-amber-800">
                      {formatRupiah(tx.sellPrice)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectSettleKasbon(tx)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-50 rounded-lg whitespace-nowrap"
                    >
                      Lunasi
                    </button>
                  </div>
                </div>
              ))}

              {transactions
                .filter((t) => t.status !== PaymentStatus.KASBON)
                .slice(0, Math.max(3, 6 - Math.min(3, unpaidKasbons.length)))
                .map((tx) => {
                  const isSale = tx.type === TransactionType.SALE;
                  const isExpense = tx.type === TransactionType.EXPENSE;
                  return (
                    <div
                      key={tx.id}
                      className="px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900 truncate">
                          {isSale ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : isExpense ? (
                            <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )}
                          <span className="truncate">{tx.productName}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 truncate">
                          {tx.category} · {walletMap[tx.sourceWalletId] || 'Dompet'} ·{' '}
                          {formatDateID(tx.createdAt)}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <div className="text-sm font-semibold text-slate-900">
                          {isSale
                            ? formatRupiah(tx.sellPrice)
                            : formatRupiah(tx.costPrice)}
                        </div>
                        <div
                          className={`text-[11px] ${
                            tx.profit > 0
                              ? 'text-emerald-700'
                              : tx.profit < 0
                              ? 'text-rose-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {tx.profit !== 0
                            ? `${tx.profit > 0 ? 'Untung' : 'Beban'} ${formatRupiah(tx.profit, true)}`
                            : 'Mutasi Saldo'}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
