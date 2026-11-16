# Security Specification — KasirKonter Firestore Rules

## 1. Data Invariants
1. A Shop document `/shops/{shopId}` can only be created, read, updated, or deleted by the verified Firebase user whose `request.auth.uid == shopId` and `ownerId == request.auth.uid`.
2. Subcollections (`/wallets/{walletId}`, `/transactions/{transactionId}`, `/products/{productId}`, `/audits/{auditId}`) enforce the Master Gate: parent `/shops/{shopId}` must exist, `parent.data.ownerId == request.auth.uid`, and `incoming().ownerId == request.auth.uid`.
3. Terminal state lock on transactions: once `status == 'paid'` on an existing transaction, it cannot be reverted to `'kasbon'`, nor can its financial amounts or `createdAt`/`ownerId` be altered. Only `'kasbon' -> 'paid'` settlement is permitted via the `settleKasbon` action branch.
4. All `createdAt` and `updatedAt` timestamps must equal `request.time`.
5. All document IDs and owner IDs must match `^[a-zA-Z0-9_\\-]+$` and stay within `<= 128` characters.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /shops/uid1/transactions/tx1` with `auth = null`.
2. **Unverified Email Write**: `CREATE /shops/uid1` with `auth = { uid: 'uid1', token: { email_verified: false } }`.
3. **Cross-Tenant Read**: `GET /shops/uid1/transactions/tx1` with `auth = { uid: 'attacker', token: { email_verified: true } }`.
4. **Cross-Tenant List**: `LIST /shops/uid1/transactions` with `auth = { uid: 'attacker', token: { email_verified: true } }`.
5. **Identity Spoofing on Create**: `CREATE /shops/uid1/wallets/w1` with `ownerId: 'uid2'` while signed in as `uid1`.
6. **Shadow Ghost Field Injection**: `CREATE /shops/uid1/wallets/w1` including extra field `isAdmin: true`.
7. **Resource Exhaustion / ID Poisoning**: `CREATE /shops/uid1/transactions/{200-char-invalid-id!}` with oversized or non-regex ID.
8. **Oversized String Payload**: `CREATE /shops/uid1/products/p1` with `name` > 100 chars.
9. **Client Timestamp Forgery**: `CREATE /shops/uid1/transactions/tx1` with `createdAt: '2020-01-01T00:00:00Z'` instead of `request.time`.
10. **Immutable Owner Tampering on Update**: `UPDATE /shops/uid1/wallets/w1` changing `ownerId` from `'uid1'` to `'uid2'`.
11. **Terminal Status Reversal**: `UPDATE /shops/uid1/transactions/tx1` changing `status` from `'paid'` back to `'kasbon'`.
12. **Value Poisoning on Settle**: `UPDATE /shops/uid1/transactions/tx1` changing `status` to `'paid'` while tampering with `sellPrice` or `profit`.
