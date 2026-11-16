import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType } from '../types/ledger';
import {
  formatCompactRupiah,
  formatRupiah,
  formatShortDayID,
  toLocalDateKey,
} from '../utils/format';

interface CashflowChartProps {
  transactions: Transaction[];
}

interface DayBucket {
  dateKey: string;
  label: string;
  omzet: number;
  expense: number;
  netProfit: number;
}

export const CashflowChart: React.FC<CashflowChartProps> = ({ transactions }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const buckets = useMemo<DayBucket[]>(() => {
    const days: DayBucket[] = [];
    const map = new Map<string, DayBucket>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toLocalDateKey(d);
      const bucket: DayBucket = {
        dateKey: key,
        label: formatShortDayID(d.toISOString()),
        omzet: 0,
        expense: 0,
        netProfit: 0,
      };
      days.push(bucket);
      map.set(key, bucket);
    }

    for (const tx of transactions) {
      const key = toLocalDateKey(tx.createdAt);
      const bucket = map.get(key);
      if (!bucket) continue;

      if (tx.type === TransactionType.SALE) {
        bucket.omzet += tx.sellPrice;
        bucket.netProfit += tx.profit;
      } else if (tx.type === TransactionType.EXPENSE) {
        bucket.expense += tx.costPrice;
        bucket.netProfit += tx.profit;
      } else if (tx.type === TransactionType.TOPUP) {
        bucket.expense += tx.adminFee;
        bucket.netProfit += tx.profit;
      } else if (tx.type === TransactionType.ADJUSTMENT) {
        bucket.netProfit += tx.profit;
      }
    }

    return days;
  }, [transactions]);

  const maxOmzetOrExpense = useMemo(() => {
    let maxVal = 50000;
    for (const b of buckets) {
      if (b.omzet > maxVal) maxVal = b.omzet;
      if (b.expense > maxVal) maxVal = b.expense;
    }
    return maxVal;
  }, [buckets]);

  const activeBucket = hoveredIdx !== null ? buckets[hoveredIdx] : buckets[buckets.length - 1];

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Arus Kas &amp; Laba 7 Hari Terakhir
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Perbandingan omzet penjualan, pengeluaran, dan laba bersih harian
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block" />
            Omzet
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
            Keluar / Prive
          </span>
        </div>
      </div>

      {/* Selected Day Summary Strip */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-50/80 border border-slate-200/70 rounded-xl text-xs">
        <span className="font-semibold text-slate-800">{activeBucket.label}</span>
        <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
          <span className="text-slate-600">
            Omzet: <strong className="text-slate-900">{formatRupiah(activeBucket.omzet)}</strong>
          </span>
          <span className="text-slate-600">
            Keluar: <strong className="text-rose-700">{formatRupiah(activeBucket.expense)}</strong>
          </span>
          <span className="text-slate-600">
            Laba Bersih:{' '}
            <strong className={activeBucket.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
              {formatRupiah(activeBucket.netProfit, true)}
            </strong>
          </span>
        </div>
      </div>

      {/* Chart Area with Subtle Horizontal Gridlines */}
      <div className="relative mt-6 pt-2">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-2 h-[128px] flex flex-col justify-between pointer-events-none"
        >
          <div className="border-t border-dashed border-slate-200/80 w-full flex justify-end">
            <span className="text-[10px] font-mono tabular-nums text-slate-400 -mt-2 bg-white pl-1">
              {formatCompactRupiah(maxOmzetOrExpense)}
            </span>
          </div>
          <div className="border-t border-dashed border-slate-200/80 w-full flex justify-end">
            <span className="text-[10px] font-mono tabular-nums text-slate-400 -mt-2 bg-white pl-1">
              {formatCompactRupiah(Math.round(maxOmzetOrExpense / 2))}
            </span>
          </div>
          <div className="border-t border-slate-200 w-full" />
        </div>

        <div className="relative z-10 grid grid-cols-7 gap-2 sm:gap-3 items-end h-44 pr-10 sm:pr-12">
          {buckets.map((bucket, idx) => {
            const omzetHeight = Math.max(
              bucket.omzet > 0 ? 6 : 2,
              Math.round((bucket.omzet / maxOmzetOrExpense) * 124)
            );
            const expenseHeight = Math.max(
              bucket.expense > 0 ? 6 : 2,
              Math.round((bucket.expense / maxOmzetOrExpense) * 124)
            );
            const isSelected = hoveredIdx === idx;
            const isBoncosDay = bucket.netProfit < 0;

            return (
              <button
                key={bucket.dateKey}
                type="button"
                onMouseEnter={() => setHoveredIdx(idx)}
                onFocus={() => setHoveredIdx(idx)}
                onClick={() => setHoveredIdx(idx)}
                className={`group flex flex-col items-center justify-end h-full rounded-xl p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50/90'
                }`}
              >
                <div className="w-full flex items-end justify-center gap-1.5 h-[128px]">
                  <div
                    style={{ height: `${omzetHeight}px` }}
                    className="w-3 sm:w-4 bg-gradient-to-t from-teal-700 to-teal-500 rounded-t-md transition-opacity group-hover:opacity-90"
                    title={`Omzet: ${formatRupiah(bucket.omzet)}`}
                  />
                  <div
                    style={{ height: `${expenseHeight}px` }}
                    className="w-3 sm:w-4 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-md transition-opacity group-hover:opacity-90"
                    title={`Pengeluaran: ${formatRupiah(bucket.expense)}`}
                  />
                </div>

                <div className="mt-2 text-[11px] font-medium text-slate-600 whitespace-nowrap">
                  {bucket.label}
                </div>
                <div
                  className={`text-[10px] font-mono tabular-nums whitespace-nowrap ${
                    isBoncosDay
                      ? 'text-rose-700 font-semibold'
                      : bucket.netProfit > 0
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                  }`}
                >
                  {bucket.netProfit === 0 ? 'Rp 0' : formatCompactRupiah(bucket.netProfit)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
