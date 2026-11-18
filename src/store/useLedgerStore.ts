import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  db,
} from '../utils/supabaseCompat';
import { AuthUser, mapSupabaseUser, supabase } from '../supabase';
import { OperationType, handleDatabaseError } from '../utils/databaseErrors';
import {
  AuditRecord,
  PaymentStatus,
  ProductPreset,
  Transaction,
  TransactionType,
  Wallet,
  WalletKind,
} from '../types/ledger';
import {
  INITIAL_AUDITS,
  INITIAL_PRODUCTS,
  INITIAL_TRANSACTIONS,
  INITIAL_WALLETS,
} from '../data/seedData';

const STORAGE_KEY = 'kasirkonter_ledger_v1';

interface StoredState {
  wallets: Wallet[];
  transactions: Transaction[];
  products: ProductPreset[];
  audits: AuditRecord[];
  shopName: string;
}

function clampStr(val: string | undefined, maxLen: number): string | undefined {
  if (val === undefined) return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function makeSafeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function getCloudErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const messages: Record<string, string> = {
    '42501': 'Akses database ditolak oleh kebijakan keamanan Supabase (RLS).',
    '42P01': 'Tabel database belum ada. Jalankan supabase/schema.sql di SQL Editor proyek.',
    'PGRST205': 'Tabel belum tersedia di API Supabase. Jalankan schema.sql dan periksa Data API.',
    'PGRST204': 'Kolom database tidak cocok dengan aplikasi. Periksa supabase/schema.sql.',
    '401': 'Sesi login tidak dikenali oleh Supabase. Keluar lalu masuk kembali.',
  };
  return messages[code] || `Login berhasil, tetapi koneksi database gagal${code ? ` (${code})` : ''}. Periksa konfigurasi Supabase dan tabel database.`;
}

function loadLocalState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      if (Array.isArray(parsed.wallets) && Array.isArray(parsed.transactions)) {
        return {
          wallets: parsed.wallets,
          transactions: parsed.transactions,
          products: Array.isArray(parsed.products) ? parsed.products : INITIAL_PRODUCTS,
          audits: Array.isArray(parsed.audits) ? parsed.audits : [],
          shopName:
            typeof parsed.shopName === 'string' && parsed.shopName.trim()
              ? parsed.shopName
              : 'Konter Berkah Cell',
        };
      }
    }
  } catch {
    // Fallback cleanly
  }
  return {
    wallets: INITIAL_WALLETS,
    transactions: INITIAL_TRANSACTIONS,
    products: INITIAL_PRODUCTS,
    audits: INITIAL_AUDITS,
    shopName: 'Konter Berkah Cell',
  };
}

function computeWalletDeltas(
  wallets: Wallet[],
  tx: Transaction,
  direction: 1 | -1
): { wallet: Wallet; newBalance: number }[] {
  const updates: { wallet: Wallet; newBalance: number }[] = [];
  for (const w of wallets) {
    let delta = 0;
    if (tx.type === TransactionType.SALE) {
      if (w.id === tx.sourceWalletId) {
        delta -= tx.costPrice * direction;
      }
      if (
        tx.status === PaymentStatus.PAID &&
        tx.destinationWalletId &&
        w.id === tx.destinationWalletId
      ) {
        delta += tx.sellPrice * direction;
      }
    } else if (tx.type === TransactionType.EXPENSE) {
      if (w.id === tx.sourceWalletId) {
        delta -= tx.costPrice * direction;
      }
    } else if (tx.type === TransactionType.TOPUP) {
      if (w.id === tx.sourceWalletId) {
        delta -= (tx.costPrice + tx.adminFee) * direction;
      }
      if (tx.destinationWalletId && w.id === tx.destinationWalletId) {
        delta += tx.costPrice * direction;
      }
    } else if (tx.type === TransactionType.ADJUSTMENT) {
      if (w.id === tx.sourceWalletId) {
        delta += tx.profit * direction;
      }
    }
    if (delta !== 0) {
      updates.push({ wallet: w, newBalance: w.balance + delta });
    }
  }
  return updates;
}

function applyTransactionToLocalWallets(
  wallets: Wallet[],
  tx: Transaction,
  direction: 1 | -1
): Wallet[] {
  const deltaMap = new Map(
    computeWalletDeltas(wallets, tx, direction).map((u) => [u.wallet.id, u.newBalance])
  );
  return wallets.map((w) =>
    deltaMap.has(w.id) ? { ...w, balance: deltaMap.get(w.id)! } : w
  );
}

function buildTransactionPayload(
  uid: string,
  tx: Omit<Transaction, 'id' | 'createdAt' | 'profit'> & { profit: number },
  includePaidAt: boolean
) {
  const payload: Record<string, unknown> = {
    ownerId: uid,
    type: tx.type,
    category: (clampStr(tx.category, 60) || 'Lainnya'),
    productName: (clampStr(tx.productName, 120) || 'Transaksi'),
    costPrice: Math.max(0, Number(tx.costPrice) || 0),
    sellPrice: Math.max(0, Number(tx.sellPrice) || 0),
    adminFee: Math.max(0, Number(tx.adminFee) || 0),
    profit: Number(tx.profit) || 0,
    status: tx.status,
    sourceWalletId: tx.sourceWalletId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const targetNum = clampStr(tx.targetNumber, 40);
  if (targetNum) payload.targetNumber = targetNum;

  const custName = clampStr(tx.customerName, 80);
  if (custName) payload.customerName = custName;

  const custPhone = clampStr(tx.customerPhone, 30);
  if (custPhone) payload.customerPhone = custPhone;

  if (tx.destinationWalletId) payload.destinationWalletId = tx.destinationWalletId;

  const noteStr = clampStr(tx.notes, 240);
  if (noteStr) payload.notes = noteStr;

  if (includePaidAt) payload.paidAt = serverTimestamp();

  return payload;
}

export function useLedgerStore() {
  const [localState, setLocalState] = useState<StoredState>(loadLocalState);
  const [cloudState, setCloudState] = useState<StoredState | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const localStateRef = useRef(localState);
  localStateRef.current = localState;

  const isCloudActive = Boolean(user && user.emailVerified && cloudState);
  const activeState = isCloudActive ? cloudState! : localState;

  // Persist local mode to localStorage
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [localState, user]);

  // Listen to Supabase Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const nextUser = mapSupabaseUser(data.session?.user || null);
      setUser(nextUser);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = mapSupabaseUser(session?.user || null);
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setCloudState(null);
        setCloudLoading(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Bootstrap shop & attach real-time Supabase table listeners when authenticated
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    let cancelled = false;
    const unsubs: (() => void)[] = [];
    const uid = user.uid;

    async function initAndSubscribe() {
      setCloudLoading(true);
      setCloudError(null);
      const shopRef = doc(db, 'shops', uid);
      let shopSnap;
      try {
        shopSnap = await getDoc(shopRef);
      } catch (err) {
        if (!cancelled) {
          setCloudLoading(false);
          setCloudError(getCloudErrorMessage(err));
        }
        handleDatabaseError(err, OperationType.GET, `shops/${uid}`);
      }

      try {
        if (!shopSnap.exists()) {
          const seed = localStateRef.current;
          await setDoc(shopRef, {
            ownerId: uid,
            shopName: clampStr(seed.shopName, 60) || 'Konter Berkah Cell',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const batch = writeBatch(db);
          for (const w of seed.wallets) {
            batch.set(doc(db, 'shops', uid, 'wallets', w.id), {
              ownerId: uid,
              name: clampStr(w.name, 60) || 'Dompet',
              kind: w.kind,
              balance: Number(w.balance) || 0,
              lowThreshold: Math.max(0, Number(w.lowThreshold) || 0),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const p of seed.products) {
            batch.set(doc(db, 'shops', uid, 'products', p.id), {
              ownerId: uid,
              name: clampStr(p.name, 100) || 'Produk',
              category: clampStr(p.category, 60) || 'Lainnya',
              costPrice: Math.max(1, Number(p.costPrice) || 1),
              sellPrice: Math.max(1, Number(p.sellPrice) || 1),
              defaultServerId: p.defaultServerId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const t of seed.transactions) {
            const payload = buildTransactionPayload(
              uid,
              t,
              t.status === PaymentStatus.PAID
            );
            batch.set(doc(db, 'shops', uid, 'transactions', t.id), payload);
          }
          await batch.commit();
        }
      } catch (err) {
        if (!cancelled) {
          setCloudLoading(false);
          setCloudError(getCloudErrorMessage(err));
        }
        handleDatabaseError(err, OperationType.WRITE, `shops/${uid}`);
      }

      if (cancelled) return;

      const latest: StoredState = {
        shopName: 'Konter Berkah Cell',
        wallets: [],
        transactions: [],
        products: [],
        audits: [],
      };
      let loadedFlags = { shop: false, wallets: false, tx: false, products: false, audits: false };

      const syncSnapshot = () => {
        if (cancelled) return;
        setCloudState({ ...latest });
        if (
          loadedFlags.shop &&
          loadedFlags.wallets &&
          loadedFlags.tx &&
          loadedFlags.products &&
          loadedFlags.audits
        ) {
          setCloudLoading(false);
        }
      };

      unsubs.push(
        onSnapshot(
          shopRef,
          (snap) => {
            if (snap.exists()) {
              latest.shopName = String(snap.data().shopName || 'Konter Berkah Cell');
            }
            loadedFlags.shop = true;
            syncSnapshot();
          },
          (error) => { setCloudError(getCloudErrorMessage(error)); handleDatabaseError(error, OperationType.GET, `shops/${uid}`); }
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'wallets'), where('ownerId', '==', uid)),
          (snap) => {
            latest.wallets = snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  name: String(data.name || ''),
                  kind: (data.kind as WalletKind) || 'cash',
                  balance: Number(data.balance) || 0,
                  lowThreshold: Number(data.lowThreshold) || 0,
                };
              })
              .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
            loadedFlags.wallets = true;
            syncSnapshot();
          },
          (error) => { setCloudError(getCloudErrorMessage(error)); handleDatabaseError(error, OperationType.LIST, `shops/${uid}/wallets`); }
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'transactions'), where('ownerId', '==', uid)),
          (snap) => {
            latest.transactions = snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  createdAt: timestampToIso(data.createdAt),
                  type: data.type as TransactionType,
                  category: String(data.category || ''),
                  productName: String(data.productName || ''),
                  targetNumber: data.targetNumber ? String(data.targetNumber) : undefined,
                  customerName: data.customerName ? String(data.customerName) : undefined,
                  customerPhone: data.customerPhone ? String(data.customerPhone) : undefined,
                  costPrice: Number(data.costPrice) || 0,
                  sellPrice: Number(data.sellPrice) || 0,
                  adminFee: Number(data.adminFee) || 0,
                  profit: Number(data.profit) || 0,
                  status: data.status as PaymentStatus,
                  sourceWalletId: String(data.sourceWalletId || ''),
                  destinationWalletId: data.destinationWalletId
                    ? String(data.destinationWalletId)
                    : undefined,
                  paidAt: data.paidAt ? timestampToIso(data.paidAt) : undefined,
                  notes: data.notes ? String(data.notes) : undefined,
                };
              })
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            loadedFlags.tx = true;
            syncSnapshot();
          },
          (error) => { setCloudError(getCloudErrorMessage(error)); handleDatabaseError(error, OperationType.LIST, `shops/${uid}/transactions`); }
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'products'), where('ownerId', '==', uid)),
          (snap) => {
            latest.products = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                name: String(data.name || ''),
                category: data.category as ProductPreset['category'],
                costPrice: Number(data.costPrice) || 0,
                sellPrice: Number(data.sellPrice) || 0,
                defaultServerId: String(data.defaultServerId || ''),
              };
            });
            loadedFlags.products = true;
            syncSnapshot();
          },
          (error) => { setCloudError(getCloudErrorMessage(error)); handleDatabaseError(error, OperationType.LIST, `shops/${uid}/products`); }
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'audits'), where('ownerId', '==', uid)),
          (snap) => {
            latest.audits = snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  createdAt: timestampToIso(data.createdAt),
                  walletId: String(data.walletId || ''),
                  walletName: String(data.walletName || ''),
                  systemBalance: Number(data.systemBalance) || 0,
                  actualBalance: Number(data.actualBalance) || 0,
                  difference: Number(data.difference) || 0,
                  notes: data.notes ? String(data.notes) : undefined,
                };
              })
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            loadedFlags.audits = true;
            syncSnapshot();
          },
          (error) => { setCloudError(getCloudErrorMessage(error)); handleDatabaseError(error, OperationType.LIST, `shops/${uid}/audits`); }
        )
      );
    }

    initAndSubscribe().catch((err) => {
      console.error(err);
    });

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Login dibatalkan.');
      } else {
        const code = (err as { code?: string }).code;
        const messages: Record<string, string> = {
          'auth/unauthorized-domain': 'Domain aplikasi belum diizinkan di Supabase Authentication → Settings → Authorized domains.',
          'auth/operation-not-allowed': 'Login Google belum diaktifkan di Supabase Authentication → Sign-in method.',
          'auth/popup-blocked': 'Pop-up login diblokir browser. Izinkan pop-up lalu coba lagi.',
          'auth/network-request-failed': 'Koneksi ke Supabase gagal. Periksa internet dan URL/key Supabase.',
          'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'API key Supabase tidak valid. Periksa URL dan publishable key.',
        };
        setAuthError(messages[code || ''] || `Gagal masuk (${code || msg}). Periksa konfigurasi Supabase Authentication.`);
      }
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.user?.email_confirmed_at) {
        await supabase.auth.resend({ type: 'signup', email: email.trim() });
        await supabase.auth.signOut();
        throw new Error('email-not-verified');
      }
    } catch (err) {
      const code = (err as { code?: string }).code || (err as { status?: number }).status?.toString();
      const message = err instanceof Error ? err.message : '';
      const friendly: Record<string, string> = {
        'auth/invalid-email': 'Format email tidak valid.',
        'auth/invalid-credential': 'Email atau kata sandi salah.',
        'auth/user-not-found': 'Akun dengan email tersebut belum terdaftar.',
        'auth/wrong-password': 'Email atau kata sandi salah.',
        'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
        'auth/operation-not-allowed': 'Login email belum diaktifkan di Supabase Dashboard.',
        'auth/unauthorized-domain': 'Domain aplikasi belum ditambahkan ke Authorized domains di Supabase Dashboard.',
        'auth/invalid-api-key': 'API key Supabase tidak valid. Periksa URL dan publishable key Supabase.',
        'auth/network-request-failed': 'Koneksi gagal. Periksa internet lalu coba lagi.',
      };
      setAuthError(message === 'email-not-verified'
        ? 'Email belum diverifikasi. Kami mengirim tautan verifikasi; cek inbox atau folder spam.'
        : friendly[code || ''] || `Gagal masuk${code ? ` (${code})` : ''}. Periksa konfigurasi Supabase dan akun.`);
      throw err;
    }
  }, []);

  const createEmailAccount = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setAuthError('Akun dibuat. Buka tautan verifikasi yang kami kirim ke email, lalu masuk.');
    } catch (err) {
      const code = (err as { code?: string }).code || (err as { status?: number }).status?.toString();
      const friendly: Record<string, string> = {
        'auth/invalid-email': 'Format email tidak valid.',
        'auth/email-already-in-use': 'Email ini sudah terdaftar. Silakan masuk.',
        'auth/weak-password': 'Kata sandi minimal 6 karakter.',
        'auth/operation-not-allowed': 'Pendaftaran email belum diaktifkan di Supabase Dashboard.',
        'auth/unauthorized-domain': 'Domain aplikasi belum ditambahkan ke Authorized domains di Supabase Dashboard.',
        'auth/invalid-api-key': 'API key Supabase tidak valid. Periksa URL dan publishable key Supabase.',
        'auth/network-request-failed': 'Koneksi gagal. Periksa internet lalu coba lagi.',
      };
      setAuthError(friendly[code || ''] || `Gagal membuat akun${code ? ` (${code})` : ''}. Periksa konfigurasi Supabase.`);
      throw err;
    }
  }, []);

  const resetEmailPassword = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (error) throw error;
      setAuthError('Tautan atur ulang kata sandi sudah dikirim. Cek inbox atau folder spam.');
    } catch (err) {
      const code = (err as { code?: string }).code || (err as { status?: number }).status?.toString();
      setAuthError(code === 'auth/user-not-found'
        ? 'Email tersebut belum terdaftar.'
        : 'Gagal mengirim tautan. Periksa email dan koneksi internet.');
      throw err;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await supabase.auth.signOut();
  }, []);

  const setShopName = useCallback(
    async (shopName: string) => {
      const clean = clampStr(shopName, 60) || 'Konter Pulsa';
      if (user && user.emailVerified) {
        const path = `shops/${user.uid}`;
        try {
          await updateDoc(doc(db, 'shops', user.uid), {
            shopName: clean,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleDatabaseError(err, OperationType.UPDATE, path);
        }
        return;
      }
      setLocalState((prev) => ({ ...prev, shopName: clean }));
    },
    [user]
  );

  const addTransaction = useCallback(
    async (input: Omit<Transaction, 'id' | 'createdAt' | 'profit'> & { createdAt?: string }) => {
      const id = makeSafeId('tx');
      const createdAt = input.createdAt || new Date().toISOString();

      let profit = 0;
      if (input.type === TransactionType.SALE) {
        profit = input.sellPrice - input.costPrice - input.adminFee;
      } else if (input.type === TransactionType.EXPENSE) {
        profit = -input.costPrice;
      } else if (input.type === TransactionType.TOPUP) {
        profit = -input.adminFee;
      }

      const newTx: Transaction = {
        ...input,
        id,
        createdAt,
        profit,
        paidAt: input.status === PaymentStatus.PAID ? createdAt : undefined,
      };

      if (user && user.emailVerified && cloudState) {
        const uid = user.uid;
        const path = `shops/${uid}/transactions/${id}`;
        const originalCloudState = cloudState;
        const walletDeltas = computeWalletDeltas(cloudState.wallets, newTx, 1);
        // Update the screen immediately; the database write continues in the background.
        setCloudState((prev) => prev ? ({
          ...prev,
          transactions: [newTx, ...prev.transactions].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
          wallets: applyTransactionToLocalWallets(prev.wallets, newTx, 1),
        }) : prev);
        try {
          const batch = writeBatch(db);
          batch.set(
            doc(db, 'shops', uid, 'transactions', id),
            buildTransactionPayload(uid, newTx, newTx.status === PaymentStatus.PAID)
          );

          for (const u of walletDeltas) {
            batch.update(doc(db, 'shops', uid, 'wallets', u.wallet.id), {
              balance: u.newBalance,
              updatedAt: serverTimestamp(),
            });
          }

          await batch.commit();
        } catch (err) {
          setCloudState((prev) => prev ? ({
            ...prev,
            transactions: prev.transactions.filter((t) => t.id !== id),
            wallets: applyTransactionToLocalWallets(prev.wallets, newTx, -1),
          }) : originalCloudState);
          handleDatabaseError(err, OperationType.WRITE, path);
        }
        return;
      }

      setLocalState((prev) => ({
        ...prev,
        transactions: [newTx, ...prev.transactions].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
        wallets: applyTransactionToLocalWallets(prev.wallets, newTx, 1),
      }));
    },
    [user, cloudState]
  );

  const deleteTransaction = useCallback(
    async (txId: string) => {
      if (user && user.emailVerified && cloudState) {
        const uid = user.uid;
        const target = cloudState.transactions.find((t) => t.id === txId);
        if (!target) return;
        const path = `shops/${uid}/transactions/${txId}`;
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'shops', uid, 'transactions', txId));
          const walletUpdates = computeWalletDeltas(cloudState.wallets, target, -1);
          for (const u of walletUpdates) {
            batch.update(doc(db, 'shops', uid, 'wallets', u.wallet.id), {
              balance: u.newBalance,
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch (err) {
          handleDatabaseError(err, OperationType.DELETE, path);
        }
        return;
      }

      setLocalState((prev) => {
        const target = prev.transactions.find((t) => t.id === txId);
        if (!target) return prev;
        return {
          ...prev,
          transactions: prev.transactions.filter((t) => t.id !== txId),
          wallets: applyTransactionToLocalWallets(prev.wallets, target, -1),
        };
      });
    },
    [user, cloudState]
  );

  const settleKasbon = useCallback(
    async (txId: string, destinationWalletId: string) => {
      if (user && user.emailVerified && cloudState) {
        const uid = user.uid;
        const target = cloudState.transactions.find((t) => t.id === txId);
        const destWallet = cloudState.wallets.find((w) => w.id === destinationWalletId);
        if (!target || target.status === PaymentStatus.PAID || !destWallet) return;

        const path = `shops/${uid}/transactions/${txId}`;
        try {
          const batch = writeBatch(db);
          batch.update(doc(db, 'shops', uid, 'transactions', txId), {
            status: PaymentStatus.PAID,
            destinationWalletId,
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batch.update(doc(db, 'shops', uid, 'wallets', destWallet.id), {
            balance: destWallet.balance + target.sellPrice,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } catch (err) {
          handleDatabaseError(err, OperationType.UPDATE, path);
        }
        return;
      }

      setLocalState((prev) => {
        const target = prev.transactions.find((t) => t.id === txId);
        if (!target || target.status === PaymentStatus.PAID) return prev;
        const paidAt = new Date().toISOString();
        const updatedTx: Transaction = {
          ...target,
          status: PaymentStatus.PAID,
          destinationWalletId,
          paidAt,
        };
        return {
          ...prev,
          transactions: prev.transactions.map((t) => (t.id === txId ? updatedTx : t)),
          wallets: prev.wallets.map((w) =>
            w.id === destinationWalletId ? { ...w, balance: w.balance + target.sellPrice } : w
          ),
        };
      });
    },
    [user, cloudState]
  );

  const addWallet = useCallback(
    async (name: string, kind: WalletKind, balance: number, lowThreshold = 200000) => {
      const id = makeSafeId('w');
      const cleanName = clampStr(name, 60) || 'Dompet';
      if (user && user.emailVerified) {
        const uid = user.uid;
        const path = `shops/${uid}/wallets/${id}`;
        try {
          await setDoc(doc(db, 'shops', uid, 'wallets', id), {
            ownerId: uid,
            name: cleanName,
            kind,
            balance: Number(balance) || 0,
            lowThreshold: Math.max(0, Number(lowThreshold) || 0),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleDatabaseError(err, OperationType.CREATE, path);
        }
        return;
      }

      setLocalState((prev) => ({
        ...prev,
        wallets: [...prev.wallets, { id, name: cleanName, kind, balance, lowThreshold }],
      }));
    },
    [user]
  );

  const updateWalletBalance = useCallback(
    async (walletId: string, newBalance: number, newName?: string) => {
      const cleanName = newName ? clampStr(newName, 60) : undefined;
      if (user && user.emailVerified) {
        const uid = user.uid;
        const path = `shops/${uid}/wallets/${walletId}`;
        try {
          const updateData: Record<string, unknown> = {
            balance: Number(newBalance) || 0,
            updatedAt: serverTimestamp(),
          };
          if (cleanName) updateData.name = cleanName;
          await updateDoc(doc(db, 'shops', uid, 'wallets', walletId), updateData);
        } catch (err) {
          handleDatabaseError(err, OperationType.UPDATE, path);
        }
        return;
      }

      setLocalState((prev) => ({
        ...prev,
        wallets: prev.wallets.map((w) =>
          w.id === walletId
            ? { ...w, balance: newBalance, name: cleanName || w.name }
            : w
        ),
      }));
    },
    [user]
  );

  const recordAudit = useCallback(
    async (walletId: string, actualBalance: number, applyAdjustment: boolean, notes?: string) => {
      if (user && user.emailVerified && cloudState) {
        const uid = user.uid;
        const wallet = cloudState.wallets.find((w) => w.id === walletId);
        if (!wallet) return;

        const difference = actualBalance - wallet.balance;
        const audId = makeSafeId('aud');
        const path = `shops/${uid}/audits/${audId}`;
        try {
          const batch = writeBatch(db);
          const audPayload: Record<string, unknown> = {
            ownerId: uid,
            walletId: wallet.id,
            walletName: clampStr(wallet.name, 60) || 'Dompet',
            systemBalance: wallet.balance,
            actualBalance,
            difference,
            createdAt: serverTimestamp(),
          };
          const cleanNote = clampStr(notes, 240);
          if (cleanNote) audPayload.notes = cleanNote;
          batch.set(doc(db, 'shops', uid, 'audits', audId), audPayload);

          if (applyAdjustment && difference !== 0) {
            const adjId = makeSafeId('tx-adj');
            batch.set(
              doc(db, 'shops', uid, 'transactions', adjId),
              buildTransactionPayload(
                uid,
                {
                  type: TransactionType.ADJUSTMENT,
                  category: 'Audit Tutup Buku',
                  productName:
                    difference < 0
                      ? `Selisih Minus (${wallet.name})`
                      : `Selisih Lebih (${wallet.name})`,
                  costPrice: difference < 0 ? Math.abs(difference) : 0,
                  sellPrice: difference > 0 ? difference : 0,
                  adminFee: 0,
                  profit: difference,
                  status: PaymentStatus.PAID,
                  sourceWalletId: wallet.id,
                  notes:
                    cleanNote ||
                    `Penyesuaian saldo dari ${wallet.balance} ke ${actualBalance}`,
                },
                true
              )
            );
            batch.update(doc(db, 'shops', uid, 'wallets', wallet.id), {
              balance: actualBalance,
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch (err) {
          handleDatabaseError(err, OperationType.WRITE, path);
        }
        return;
      }

      setLocalState((prev) => {
        const wallet = prev.wallets.find((w) => w.id === walletId);
        if (!wallet) return prev;

        const difference = actualBalance - wallet.balance;
        const now = new Date().toISOString();
        const audit: AuditRecord = {
          id: makeSafeId('aud'),
          createdAt: now,
          walletId: wallet.id,
          walletName: wallet.name,
          systemBalance: wallet.balance,
          actualBalance,
          difference,
          notes,
        };

        let nextTransactions = prev.transactions;
        let nextWallets = prev.wallets;

        if (applyAdjustment && difference !== 0) {
          const adjTx: Transaction = {
            id: makeSafeId('tx-adj'),
            createdAt: now,
            type: TransactionType.ADJUSTMENT,
            category: 'Audit Tutup Buku',
            productName:
              difference < 0
                ? `Selisih Minus (${wallet.name})`
                : `Selisih Lebih (${wallet.name})`,
            costPrice: difference < 0 ? Math.abs(difference) : 0,
            sellPrice: difference > 0 ? difference : 0,
            adminFee: 0,
            profit: difference,
            status: PaymentStatus.PAID,
            sourceWalletId: wallet.id,
            paidAt: now,
            notes: notes || `Penyesuaian saldo dari ${wallet.balance} ke ${actualBalance}`,
          };
          nextTransactions = [adjTx, ...prev.transactions];
          nextWallets = prev.wallets.map((w) =>
            w.id === walletId ? { ...w, balance: actualBalance } : w
          );
        }

        return {
          ...prev,
          audits: [audit, ...prev.audits].slice(0, 30),
          transactions: nextTransactions,
          wallets: nextWallets,
        };
      });
    },
    [user, cloudState]
  );

  const addProductPreset = useCallback(
    async (preset: Omit<ProductPreset, 'id'>) => {
      const id = makeSafeId('p');
      if (user && user.emailVerified) {
        const uid = user.uid;
        const path = `shops/${uid}/products/${id}`;
        try {
          await setDoc(doc(db, 'shops', uid, 'products', id), {
            ownerId: uid,
            name: clampStr(preset.name, 100) || 'Produk',
            category: clampStr(preset.category, 60) || 'Lainnya',
            costPrice: Math.max(1, Number(preset.costPrice) || 1),
            sellPrice: Math.max(1, Number(preset.sellPrice) || 1),
            defaultServerId: preset.defaultServerId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleDatabaseError(err, OperationType.CREATE, path);
        }
        return;
      }

      setLocalState((prev) => ({
        ...prev,
        products: [{ ...preset, id }, ...prev.products],
      }));
    },
    [user]
  );

  const updateProductPreset = useCallback(
    async (id: string, patch: Partial<Omit<ProductPreset, 'id'>>) => {
      if (user && user.emailVerified && cloudState) {
        const uid = user.uid;
        const existingItem = cloudState.products.find((p) => p.id === id);
        if (!existingItem) return;
        const merged = { ...existingItem, ...patch };
        const path = `shops/${uid}/products/${id}`;
        try {
          await updateDoc(doc(db, 'shops', uid, 'products', id), {
            name: clampStr(merged.name, 100) || 'Produk',
            category: clampStr(merged.category, 60) || 'Lainnya',
            costPrice: Math.max(1, Number(merged.costPrice) || 1),
            sellPrice: Math.max(1, Number(merged.sellPrice) || 1),
            defaultServerId: merged.defaultServerId,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleDatabaseError(err, OperationType.UPDATE, path);
        }
        return;
      }

      setLocalState((prev) => ({
        ...prev,
        products: prev.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
    },
    [user, cloudState]
  );

  const deleteProductPreset = useCallback(
    async (id: string) => {
      if (user && user.emailVerified) {
        const uid = user.uid;
        const path = `shops/${uid}/products/${id}`;
        try {
          await deleteDoc(doc(db, 'shops', uid, 'products', id));
        } catch (err) {
          handleDatabaseError(err, OperationType.DELETE, path);
        }
        return;
      }

      setLocalState((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== id),
      }));
    },
    [user]
  );

  const startFresh = useCallback(
    async (initialCash: number, initialBank: number, initialServer: number) => {
      const freshWallets: Wallet[] = [
        { id: 'w-cash', name: 'Cash Laci Konter', kind: 'cash', balance: initialCash, lowThreshold: 200000 },
        { id: 'w-bank', name: 'Rekening / QRIS', kind: 'bank', balance: initialBank, lowThreshold: 300000 },
        { id: 'w-server-1', name: 'Saldo Server Pulsa', kind: 'server', balance: initialServer, lowThreshold: 300000 },
      ];

      if (user && user.emailVerified && cloudState) {
        const uid = user.uid;
        const path = `shops/${uid}`;
        try {
          const batch = writeBatch(db);
          for (const w of cloudState.wallets) {
            batch.delete(doc(db, 'shops', uid, 'wallets', w.id));
          }
          for (const t of cloudState.transactions) {
            batch.delete(doc(db, 'shops', uid, 'transactions', t.id));
          }
          for (const a of cloudState.audits) {
            batch.delete(doc(db, 'shops', uid, 'audits', a.id));
          }
          for (const w of freshWallets) {
            batch.set(doc(db, 'shops', uid, 'wallets', w.id), {
              ownerId: uid,
              name: w.name,
              kind: w.kind,
              balance: w.balance,
              lowThreshold: w.lowThreshold,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch (err) {
          handleDatabaseError(err, OperationType.WRITE, path);
        }
        return;
      }

      setLocalState((prev) => ({
        ...prev,
        wallets: freshWallets,
        transactions: [],
        audits: [],
      }));
    },
    [user, cloudState]
  );

  const resetDemoData = useCallback(async () => {
    if (user && user.emailVerified && cloudState) {
      const uid = user.uid;
      const path = `shops/${uid}`;
      try {
        const batch = writeBatch(db);
        for (const w of cloudState.wallets) batch.delete(doc(db, 'shops', uid, 'wallets', w.id));
        for (const t of cloudState.transactions) batch.delete(doc(db, 'shops', uid, 'transactions', t.id));
        for (const p of cloudState.products) batch.delete(doc(db, 'shops', uid, 'products', p.id));
        for (const a of cloudState.audits) batch.delete(doc(db, 'shops', uid, 'audits', a.id));

        for (const w of INITIAL_WALLETS) {
          batch.set(doc(db, 'shops', uid, 'wallets', w.id), {
            ownerId: uid,
            name: w.name,
            kind: w.kind,
            balance: w.balance,
            lowThreshold: w.lowThreshold,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        for (const p of INITIAL_PRODUCTS) {
          batch.set(doc(db, 'shops', uid, 'products', p.id), {
            ownerId: uid,
            name: p.name,
            category: p.category,
            costPrice: p.costPrice,
            sellPrice: p.sellPrice,
            defaultServerId: p.defaultServerId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        for (const t of INITIAL_TRANSACTIONS) {
          batch.set(
            doc(db, 'shops', uid, 'transactions', t.id),
            buildTransactionPayload(uid, t, t.status === PaymentStatus.PAID)
          );
        }
        await batch.commit();
      } catch (err) {
        handleDatabaseError(err, OperationType.WRITE, path);
      }
      return;
    }

    setLocalState({
      wallets: INITIAL_WALLETS,
      transactions: INITIAL_TRANSACTIONS,
      products: INITIAL_PRODUCTS,
      audits: INITIAL_AUDITS,
      shopName: 'Konter Berkah Cell',
    });
  }, [user, cloudState]);

  const exportBackupJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(activeState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `backup-kasirkonter-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [activeState]);

  const importBackupJSON = useCallback(
    (jsonText: string): boolean => {
      try {
        const parsed = JSON.parse(jsonText) as Partial<StoredState>;
        if (!Array.isArray(parsed.wallets) || !Array.isArray(parsed.transactions)) {
          return false;
        }
        const next: StoredState = {
          wallets: parsed.wallets,
          transactions: parsed.transactions,
          products: Array.isArray(parsed.products) ? parsed.products : INITIAL_PRODUCTS,
          audits: Array.isArray(parsed.audits) ? parsed.audits : [],
          shopName:
            typeof parsed.shopName === 'string' ? parsed.shopName : 'Konter Berkah Cell',
        };
        if (user && user.emailVerified && cloudState) {
          const uid = user.uid;
          const batch = writeBatch(db);
          batch.update(doc(db, 'shops', uid), {
            shopName: clampStr(next.shopName, 60) || 'Konter Berkah Cell',
            updatedAt: serverTimestamp(),
          });
          for (const w of cloudState.wallets) batch.delete(doc(db, 'shops', uid, 'wallets', w.id));
          for (const t of cloudState.transactions) batch.delete(doc(db, 'shops', uid, 'transactions', t.id));
          for (const p of cloudState.products) batch.delete(doc(db, 'shops', uid, 'products', p.id));

          for (const w of next.wallets) {
            batch.set(doc(db, 'shops', uid, 'wallets', w.id), {
              ownerId: uid,
              name: clampStr(w.name, 60) || 'Dompet',
              kind: w.kind,
              balance: Number(w.balance) || 0,
              lowThreshold: Math.max(0, Number(w.lowThreshold) || 0),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const p of next.products) {
            batch.set(doc(db, 'shops', uid, 'products', p.id), {
              ownerId: uid,
              name: clampStr(p.name, 100) || 'Produk',
              category: clampStr(p.category, 60) || 'Lainnya',
              costPrice: Math.max(1, Number(p.costPrice) || 1),
              sellPrice: Math.max(1, Number(p.sellPrice) || 1),
              defaultServerId: p.defaultServerId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const t of next.transactions) {
            batch.set(
              doc(db, 'shops', uid, 'transactions', t.id),
              buildTransactionPayload(uid, t, t.status === PaymentStatus.PAID)
            );
          }
          batch.commit().catch((err) =>
            handleDatabaseError(err, OperationType.WRITE, `shops/${uid}`)
          );
          return true;
        }

        setLocalState(next);
        return true;
      } catch {
        return false;
      }
    },
    [user, cloudState]
  );

  return {
    wallets: activeState.wallets,
    transactions: activeState.transactions,
    products: activeState.products,
    audits: activeState.audits,
    shopName: activeState.shopName,
    user,
    authReady,
    isCloudActive,
    cloudLoading,
    cloudError,
    authError,
    signInWithGoogle,
    signInWithEmail,
    createEmailAccount,
    resetEmailPassword,
    signOutUser,
    setShopName,
    addTransaction,
    deleteTransaction,
    settleKasbon,
    addWallet,
    updateWalletBalance,
    recordAudit,
    addProductPreset,
    updateProductPreset,
    deleteProductPreset,
    startFresh,
    resetDemoData,
    exportBackupJSON,
    importBackupJSON,
  };
}
