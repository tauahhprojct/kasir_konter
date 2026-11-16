import { Transaction, TransactionType, PaymentStatus } from '../types/ledger';

export function formatRupiah(amount: number, showSign = false): string {
  const absVal = Math.abs(Math.round(amount));
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absVal);

  if (amount < 0) {
    return `-${formatted}`;
  }
  if (showSign && amount > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

export function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')}jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${Math.round(abs / 1_000)}rb`;
  }
  return formatRupiah(amount);
}

export function formatDateTimeID(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateID(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatShortDayID(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: '2-digit',
  }).format(date);
}

export function toLocalDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function cleanPhoneForWA(phone?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  return digits;
}

export function buildKasbonReminderText(tx: Transaction): string {
  const customer = tx.customerName ? `Kak ${tx.customerName}` : 'Kak';
  const target = tx.targetNumber ? ` (${tx.targetNumber})` : '';
  return `Halo ${customer}, izin mengingatkan tagihan ${tx.productName}${target} tanggal ${formatDateID(tx.createdAt)} sebesar ${formatRupiah(tx.sellPrice)} masih tercatat belum lunas. Bisa dibayar tunai di konter atau transfer ya. Terima kasih!`;
}

export function exportTransactionsCSV(transactions: Transaction[], walletNames: Record<string, string>): void {
  const headers = [
    'Tanggal',
    'Tipe',
    'Kategori',
    'Produk / Keterangan',
    'Nomor Tujuan',
    'Pelanggan',
    'No WA',
    'Harga Modal',
    'Harga Jual',
    'Biaya Admin',
    'Laba / Dampak Kas',
    'Status',
    'Dompet Sumber',
    'Dompet Tujuan',
    'Catatan',
  ];

  const typeLabel = (t: TransactionType) => {
    switch (t) {
      case TransactionType.SALE:
        return 'Penjualan';
      case TransactionType.EXPENSE:
        return 'Pengeluaran';
      case TransactionType.TOPUP:
        return 'Top Up Server';
      case TransactionType.ADJUSTMENT:
        return 'Penyesuaian Audit';
    }
  };

  const escapeCsv = (val: string | number | undefined) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = transactions.map((tx) => [
    formatDateTimeID(tx.createdAt),
    typeLabel(tx.type),
    tx.category,
    tx.productName,
    tx.targetNumber || '',
    tx.customerName || '',
    tx.customerPhone || '',
    tx.costPrice,
    tx.sellPrice,
    tx.adminFee,
    tx.profit,
    tx.status === PaymentStatus.PAID ? 'Lunas' : 'Kasbon',
    walletNames[tx.sourceWalletId] || tx.sourceWalletId,
    tx.destinationWalletId ? walletNames[tx.destinationWalletId] || tx.destinationWalletId : '',
    tx.notes || '',
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `pembukuan-konter-${toLocalDateKey(new Date())}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
