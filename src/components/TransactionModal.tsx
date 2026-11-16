import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  ExpenseCategory,
  PaymentStatus,
  ProductCategory,
  ProductPreset,
  TransactionType,
  Wallet,
} from '../types/ledger';
import { formatRupiah } from '../utils/format';

export type ModalMode = 'sale' | 'expense' | 'topup';

interface TransactionModalProps {
  isOpen: boolean;
  initialMode?: ModalMode;
  prefilledPreset?: ProductPreset | null;
  wallets: Wallet[];
  products: ProductPreset[];
  onClose: () => void;
  onSubmit: (payload: {
    type: TransactionType;
    category: string;
    productName: string;
    targetNumber?: string;
    customerName?: string;
    customerPhone?: string;
    costPrice: number;
    sellPrice: number;
    adminFee: number;
    status: PaymentStatus;
    sourceWalletId: string;
    destinationWalletId?: string;
    notes?: string;
  }) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  initialMode = 'sale',
  prefilledPreset,
  wallets,
  products,
  onClose,
  onSubmit,
}) => {
  const [mode, setMode] = useState<ModalMode>(initialMode);

  const serverWallets = useMemo(
    () => wallets.filter((w) => w.kind === 'server' || w.kind === 'bank'),
    [wallets]
  );
  const cashAndBankWallets = useMemo(
    () => wallets.filter((w) => w.kind === 'cash' || w.kind === 'bank'),
    [wallets]
  );
  const onlyServerWallets = useMemo(
    () => wallets.filter((w) => w.kind === 'server'),
    [wallets]
  );

  // Sale fields
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [saleCategory, setSaleCategory] = useState<string>(ProductCategory.PULSA);
  const [productName, setProductName] = useState('');
  const [targetNumber, setTargetNumber] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [saleSourceWalletId, setSaleSourceWalletId] = useState('');
  const [saleStatus, setSaleStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  const [saleDestWalletId, setSaleDestWalletId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Expense fields
  const [expenseCategory, setExpenseCategory] = useState<string>(ExpenseCategory.OPERASIONAL);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseWalletId, setExpenseWalletId] = useState('');

  // Topup fields
  const [topupSourceId, setTopupSourceId] = useState('');
  const [topupDestId, setTopupDestId] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupAdminFee, setTopupAdminFee] = useState('0');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setMode(initialMode);

    const defaultServer =
      onlyServerWallets[0]?.id || serverWallets[0]?.id || wallets[0]?.id || '';
    const defaultCash =
      cashAndBankWallets.find((w) => w.kind === 'cash')?.id ||
      cashAndBankWallets[0]?.id ||
      wallets[0]?.id ||
      '';
    const defaultBank =
      cashAndBankWallets.find((w) => w.kind === 'bank')?.id || defaultCash;

    if (prefilledPreset) {
      setSelectedPresetId(prefilledPreset.id);
      setSaleCategory(prefilledPreset.category);
      setProductName(prefilledPreset.name);
      setCostPrice(String(prefilledPreset.costPrice));
      setSellPrice(String(prefilledPreset.sellPrice));
      setSaleSourceWalletId(prefilledPreset.defaultServerId || defaultServer);
    } else {
      setSelectedPresetId('');
      setSaleCategory(ProductCategory.PULSA);
      setProductName('');
      setCostPrice('');
      setSellPrice('');
      setSaleSourceWalletId(defaultServer);
    }

    setTargetNumber('');
    setSaleStatus(PaymentStatus.PAID);
    setSaleDestWalletId(defaultCash);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');

    setExpenseCategory(ExpenseCategory.OPERASIONAL);
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseWalletId(defaultCash);

    setTopupSourceId(defaultBank);
    setTopupDestId(defaultServer);
    setTopupAmount('');
    setTopupAdminFee('0');
  }, [isOpen, initialMode, prefilledPreset, wallets, onlyServerWallets, serverWallets, cashAndBankWallets]);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = products.find((p) => p.id === presetId);
    if (!preset) return;
    setSaleCategory(preset.category);
    setProductName(preset.name);
    setCostPrice(String(preset.costPrice));
    setSellPrice(String(preset.sellPrice));
    if (wallets.some((w) => w.id === preset.defaultServerId)) {
      setSaleSourceWalletId(preset.defaultServerId);
    }
  };

  const numCost = Number(costPrice) || 0;
  const numSell = Number(sellPrice) || 0;
  const saleProfit = numSell - numCost;
  const marginPct = numCost > 0 ? ((saleProfit / numCost) * 100).toFixed(1) : '0.0';
  const isLoss = numSell > 0 && numCost > 0 && saleProfit <= 0;
  const isThinMargin = numSell > 0 && numCost > 0 && saleProfit > 0 && saleProfit < 1000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (mode === 'sale') {
      if (!productName.trim()) {
        setErrorMsg('Nama produk atau tagihan wajib diisi.');
        return;
      }
      if (numCost <= 0 || numSell <= 0) {
        setErrorMsg('Harga modal dan harga jual harus lebih besar dari Rp 0.');
        return;
      }
      if (!saleSourceWalletId) {
        setErrorMsg('Pilih sumber saldo yang terpotong.');
        return;
      }
      if (saleStatus === PaymentStatus.KASBON && !customerName.trim()) {
        setErrorMsg('Nama pelanggan wajib diisi untuk transaksi Kasbon agar mudah ditagih.');
        return;
      }

      onSubmit({
        type: TransactionType.SALE,
        category: saleCategory,
        productName: productName.trim(),
        targetNumber: targetNumber.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        costPrice: numCost,
        sellPrice: numSell,
        adminFee: 0,
        status: saleStatus,
        sourceWalletId: saleSourceWalletId,
        destinationWalletId: saleStatus === PaymentStatus.PAID ? saleDestWalletId : undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
      return;
    }

    if (mode === 'expense') {
      const amount = Number(expenseAmount) || 0;
      if (!expenseTitle.trim()) {
        setErrorMsg('Keterangan pengeluaran wajib diisi.');
        return;
      }
      if (amount <= 0) {
        setErrorMsg('Nominal pengeluaran harus lebih dari Rp 0.');
        return;
      }
      onSubmit({
        type: TransactionType.EXPENSE,
        category: expenseCategory,
        productName: expenseTitle.trim(),
        costPrice: amount,
        sellPrice: 0,
        adminFee: 0,
        status: PaymentStatus.PAID,
        sourceWalletId: expenseWalletId,
        notes: notes.trim() || undefined,
      });
      onClose();
      return;
    }

    if (mode === 'topup') {
      const amount = Number(topupAmount) || 0;
      const fee = Number(topupAdminFee) || 0;
      if (amount <= 0) {
        setErrorMsg('Nominal top up saldo server harus lebih dari Rp 0.');
        return;
      }
      if (topupSourceId === topupDestId) {
        setErrorMsg('Dompet sumber dan dompet tujuan tidak boleh sama.');
        return;
      }
      const destWallet = wallets.find((w) => w.id === topupDestId);
      onSubmit({
        type: TransactionType.TOPUP,
        category: 'Deposit Server',
        productName: `Top Up Saldo ${destWallet?.name || 'Server'}`,
        costPrice: amount,
        sellPrice: amount,
        adminFee: fee,
        status: PaymentStatus.PAID,
        sourceWalletId: topupSourceId,
        destinationWalletId: topupDestId,
        notes: notes.trim() || undefined,
      });
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-tx-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 id="modal-tx-title" className="text-base font-bold text-slate-900">
            Catat Transaksi Baru
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Mode Switch */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('sale');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                mode === 'sale'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jual Pulsa / PPOB
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('expense');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                mode === 'expense'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pengeluaran / Prive
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('topup');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                mode === 'topup'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Top Up Server
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
              {errorMsg}
            </div>
          )}

          {mode === 'sale' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Isi Cepat dari Katalog (Opsional)
                </label>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                >
                  <option value="">-- Ketik manual atau pilih produk --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Modal {formatRupiah(p.costPrice)} → Jual {formatRupiah(p.sellPrice)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={saleCategory}
                    onChange={(e) => setSaleCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    {Object.values(ProductCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Produk / Tagihan
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="cth: Token PLN 50rb"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Harga Modal / Potong Saldo (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="50200"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Harga Jual ke Pelanggan (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="53000"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              {/* Margin Live Check (Anti-Boncos Guard) */}
              {numCost > 0 && numSell > 0 && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                    isLoss
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : isThinMargin
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    {(isLoss || isThinMargin) && <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {isLoss
                      ? 'Awas Boncos! Harga jual tidak menutup harga modal.'
                      : isThinMargin
                      ? 'Margin tipis (< Rp 1.000). Pastikan harga sudah sesuai.'
                      : 'Margin sehat'}
                  </span>
                  <span className="font-mono tabular-nums font-bold">
                    {formatRupiah(saleProfit, true)} ({marginPct}%)
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Potong Saldo Dari
                  </label>
                  <select
                    value={saleSourceWalletId}
                    onChange={(e) => setSaleSourceWalletId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatRupiah(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    No. HP / ID Pelanggan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="0812xxxx / ID PLN"
                    value={targetNumber}
                    onChange={(e) => setTargetNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Status Pembayaran Pelanggan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSaleStatus(PaymentStatus.PAID)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                      saleStatus === PaymentStatus.PAID
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Lunas (Langsung Bayar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleStatus(PaymentStatus.KASBON)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                      saleStatus === PaymentStatus.KASBON
                        ? 'bg-amber-50 border-amber-600 text-amber-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Kasbon / Belum Bayar
                  </button>
                </div>
              </div>

              {saleStatus === PaymentStatus.PAID ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Uang Masuk Ke
                    </label>
                    <select
                      value={saleDestWalletId}
                      onChange={(e) => setSaleDestWalletId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                    >
                      {cashAndBankWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nama Pelanggan (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="cth: Ibu Sari"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/60 border border-amber-200 rounded-lg">
                  <div>
                    <label className="block text-xs font-medium text-amber-950 mb-1">
                      Nama Pelanggan (Wajib)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="cth: Mas Dani"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-950 mb-1">
                      No. WhatsApp (untuk Tagih)
                    </label>
                    <input
                      type="text"
                      placeholder="0812xxxxxxxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'expense' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kategori Pengeluaran
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    {Object.values(ExpenseCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nominal Keluar (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="25000"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Keterangan Pengeluaran
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth: Beli kertas struk / Ambil uang makan siang"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ambil Uang Dari Dompet
                </label>
                <select
                  value={expenseWalletId}
                  onChange={(e) => setExpenseWalletId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRupiah(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {expenseCategory === ExpenseCategory.PRIVE && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  Bagus! Mencatat pengambilan uang pribadi (Prive) mencegah modal usaha tergerus diam-diam.
                </div>
              )}
            </>
          )}

          {mode === 'topup' && (
            <>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Memindahkan modal dari Cash/Rekening ke Saldo Server tidak dihitung sebagai pengeluaran, kecuali biaya admin transfernya.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Sumber Dana (Dari)
                  </label>
                  <select
                    value={topupSourceId}
                    onChange={(e) => setTopupSourceId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatRupiah(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tujuan Deposit (Ke)
                  </label>
                  <select
                    value={topupDestId}
                    onChange={(e) => setTopupDestId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatRupiah(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nominal Deposit (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="1000000"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Biaya Admin Transfer (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={topupAdminFee}
                    onChange={(e) => setTopupAdminFee(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan Tambahan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Catatan singkat jika diperlukan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
            >
              Simpan Transaksi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
