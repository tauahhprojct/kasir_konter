import React, { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { ProductCategory, ProductPreset, Wallet } from '../types/ledger';
import { formatRupiah } from '../utils/format';

interface CatalogViewProps {
  products: ProductPreset[];
  wallets: Wallet[];
  onAddProduct: (preset: Omit<ProductPreset, 'id'>) => void;
  onUpdateProduct: (id: string, patch: Partial<Omit<ProductPreset, 'id'>>) => void;
  onDeleteProduct: (id: string) => void;
  onQuickSell: (preset: ProductPreset) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  wallets,
  onAddProduct,
  onDeleteProduct,
  onQuickSell,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>(ProductCategory.PULSA);
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [defaultServerId, setDefaultServerId] = useState(
    wallets.find((w) => w.kind === 'server')?.id || wallets[0]?.id || ''
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [products, search, categoryFilter]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = Number(costPrice) || 0;
    const sell = Number(sellPrice) || 0;
    if (!name.trim() || cost <= 0 || sell <= 0) return;

    onAddProduct({
      name: name.trim(),
      category,
      costPrice: cost,
      sellPrice: sell,
      defaultServerId,
    });
    setName('');
    setCostPrice('');
    setSellPrice('');
    setShowAdd(false);
  };

  const draftMargin = (Number(sellPrice) || 0) - (Number(costPrice) || 0);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk pulsa, kuota, PLN..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
          >
            <option value="all">Semua Kategori</option>
            {Object.values(ProductCategory).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap self-start lg:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Produk
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAddSubmit}
          className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Tambah Preset Produk &amp; Cek Margin
            </h2>
            {Number(costPrice) > 0 && Number(sellPrice) > 0 && (
              <span
                className={`text-xs font-mono tabular-nums font-semibold ${
                  draftMargin <= 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                Estimasi Margin: {formatRupiah(draftMargin, true)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Produk
              </label>
              <input
                type="text"
                required
                placeholder="cth: Pulsa Tri 20.000"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              >
                {Object.values(ProductCategory).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Harga Modal (Rp)
              </label>
              <input
                type="number"
                required
                min={1}
                placeholder="19800"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Harga Jual (Rp)
              </label>
              <input
                type="number"
                required
                min={1}
                placeholder="22000"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-700 whitespace-nowrap">
                Potong Saldo Dari:
              </label>
              <select
                value={defaultServerId}
                onChange={(e) => setDefaultServerId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                Simpan Produk
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Produk</th>
                <th className="py-2.5 px-4">Kategori</th>
                <th className="py-2.5 px-4 text-right">Harga Modal</th>
                <th className="py-2.5 px-4 text-right">Harga Jual</th>
                <th className="py-2.5 px-4 text-right">Untung / Transaksi</th>
                <th className="py-2.5 px-4 text-right">Margin</th>
                <th className="py-2.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((p) => {
                const margin = p.sellPrice - p.costPrice;
                const pct = p.costPrice > 0 ? ((margin / p.costPrice) * 100).toFixed(1) : '0.0';
                const isLoss = margin <= 0;
                const isThin = margin > 0 && margin < 1000;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{p.name}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">{p.category}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                      {formatRupiah(p.costPrice)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900">
                      {formatRupiah(p.sellPrice)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums text-xs font-semibold ${
                        isLoss
                          ? 'text-rose-700'
                          : isThin
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        {(isLoss || isThin) && <AlertTriangle className="w-3.5 h-3.5" />}
                        {formatRupiah(margin, true)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                      {pct}%
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onQuickSell(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded transition-colors"
                        >
                          <ShoppingBag className="w-3 h-3" />
                          Jual
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProduct(p.id)}
                          aria-label={`Hapus produk ${p.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
