export enum TransactionType {
  SALE = 'sale',
  EXPENSE = 'expense',
  TOPUP = 'topup',
  ADJUSTMENT = 'adjustment',
}

export enum PaymentStatus {
  PAID = 'paid',
  KASBON = 'kasbon',
}

export enum ProductCategory {
  PULSA = 'Pulsa Reguler',
  DATA = 'Paket Data',
  PLN = 'Token & Tagihan PLN',
  EWALLET = 'Top Up E-Wallet',
  PPOB = 'Tagihan PPOB',
  TRANSFER = 'Transfer Bank',
  OTHER = 'Lainnya',
}

export enum ExpenseCategory {
  OPERASIONAL = 'Operasional Konter',
  ADMIN_BANK = 'Biaya Admin Transfer',
  PRIVE = 'Ambil Pribadi (Prive)',
  LISTRIK_WIFI = 'Listrik & Kuota WiFi',
  ATK_STRUK = 'Kertas Struk & ATK',
  LAINNYA = 'Pengeluaran Lainnya',
}

export type WalletKind = 'cash' | 'bank' | 'server';

export interface Wallet {
  id: string;
  name: string;
  kind: WalletKind;
  balance: number;
  lowThreshold: number;
}

export interface ProductPreset {
  id: string;
  name: string;
  category: ProductCategory;
  costPrice: number; // Harga Modal (potong saldo server)
  sellPrice: number; // Harga Jual ke pelanggan
  defaultServerId: string;
}

export interface Transaction {
  id: string;
  createdAt: string; // ISO string
  type: TransactionType;
  category: string;
  productName: string;
  targetNumber?: string; // No HP / ID Pelanggan PLN / No Rekening
  customerName?: string;
  customerPhone?: string;
  costPrice: number; // Modal / HPP (for SALE) or Nominal TopUp/Expense
  sellPrice: number; // Harga Jual (for SALE)
  adminFee: number; // Biaya admin transfer saat kulakan atau PPOB tambahan
  profit: number; // Laba bersih (for SALE = sellPrice - costPrice, for EXPENSE = -costPrice, for TOPUP = -adminFee)
  status: PaymentStatus;
  sourceWalletId: string; // Dompet terpotong (Saldo Server untuk Jual, Cash/Bank untuk Pengeluaran & TopUp)
  destinationWalletId?: string; // Dompet penerima uang (Cash/Bank saat Jual Lunas, Saldo Server saat TopUp)
  paidAt?: string;
  notes?: string;
}

export interface AuditRecord {
  id: string;
  createdAt: string;
  walletId: string;
  walletName: string;
  systemBalance: number;
  actualBalance: number;
  difference: number; // actual - system (negative = boncos/selisih kurang)
  notes?: string;
}

export type ActiveTab = 'dashboard' | 'ledger' | 'kasbon' | 'wallets' | 'catalog';
