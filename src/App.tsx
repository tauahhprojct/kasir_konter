import { useMemo, useState } from 'react';
import { ActiveTab, PaymentStatus, ProductPreset, Transaction, TransactionType } from './types/ledger';
import { useLedgerStore } from './store/useLedgerStore';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { LedgerView } from './components/LedgerView';
import { KasbonView } from './components/KasbonView';
import { WalletsAuditView } from './components/WalletsAuditView';
import { CatalogView } from './components/CatalogView';
import { ModalMode, TransactionModal } from './components/TransactionModal';
import { SettleKasbonModal } from './components/SettleKasbonModal';
import { StartFreshModal } from './components/StartFreshModal';

export default function App() {
  const {
    wallets,
    transactions,
    products,
    audits,
    shopName,
    user,
    isCloudActive,
    cloudLoading,
    authError,
    signInWithGoogle,
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
  } = useLedgerStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalMode, setTxModalMode] = useState<ModalMode>('sale');
  const [prefilledPreset, setPrefilledPreset] = useState<ProductPreset | null>(null);
  const [kasbonToSettle, setKasbonToSettle] = useState<Transaction | null>(null);
  const [startFreshOpen, setStartFreshOpen] = useState(false);

  const unpaidKasbons = useMemo(
    () =>
      transactions.filter(
        (t) => t.type === TransactionType.SALE && t.status === PaymentStatus.KASBON
      ),
    [transactions]
  );

  const kasbonTotal = useMemo(
    () => unpaidKasbons.reduce((sum, t) => sum + t.sellPrice, 0),
    [unpaidKasbons]
  );

  const handleOpenModal = (mode: ModalMode = 'sale', preset: ProductPreset | null = null) => {
    setTxModalMode(mode);
    setPrefilledPreset(preset);
    setTxModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 flex">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        shopName={shopName}
        onRenameShop={setShopName}
        kasbonCount={unpaidKasbons.length}
        kasbonTotal={kasbonTotal}
        user={user}
        isCloudActive={isCloudActive}
        onSignInGoogle={signInWithGoogle}
        onSignOut={signOutUser}
        onExportBackup={exportBackupJSON}
        onImportBackup={importBackupJSON}
        onOpenStartFresh={() => setStartFreshOpen(true)}
        onResetDemo={resetDemoData}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeTab={activeTab}
          shopName={shopName}
          user={user}
          onSignInGoogle={signInWithGoogle}
          onOpenNewTransaction={() => handleOpenModal('sale', null)}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              wallets={wallets}
              transactions={transactions}
              user={user}
              cloudLoading={cloudLoading}
              authError={authError}
              onSignInGoogle={signInWithGoogle}
              onNavigate={setActiveTab}
              onOpenModal={(mode) => handleOpenModal(mode, null)}
              onSelectSettleKasbon={setKasbonToSettle}
            />
          )}

          {activeTab === 'ledger' && (
            <LedgerView
              transactions={transactions}
              wallets={wallets}
              onDeleteTransaction={deleteTransaction}
              onSelectSettleKasbon={setKasbonToSettle}
              onOpenModal={(mode) => handleOpenModal(mode, null)}
            />
          )}

          {activeTab === 'kasbon' && (
            <KasbonView
              transactions={transactions}
              wallets={wallets}
              onSelectSettleKasbon={setKasbonToSettle}
              onOpenNewKasbon={() => handleOpenModal('sale', null)}
            />
          )}

          {activeTab === 'wallets' && (
            <WalletsAuditView
              wallets={wallets}
              audits={audits}
              onAddWallet={addWallet}
              onUpdateWallet={updateWalletBalance}
              onRecordAudit={recordAudit}
              onOpenModal={(mode) => handleOpenModal(mode, null)}
            />
          )}

          {activeTab === 'catalog' && (
            <CatalogView
              products={products}
              wallets={wallets}
              onAddProduct={addProductPreset}
              onUpdateProduct={updateProductPreset}
              onDeleteProduct={deleteProductPreset}
              onQuickSell={(preset) => handleOpenModal('sale', preset)}
            />
          )}
        </main>
      </div>

      <TransactionModal
        isOpen={txModalOpen}
        initialMode={txModalMode}
        prefilledPreset={prefilledPreset}
        wallets={wallets}
        products={products}
        onClose={() => setTxModalOpen(false)}
        onSubmit={addTransaction}
      />

      <SettleKasbonModal
        transaction={kasbonToSettle}
        wallets={wallets}
        onClose={() => setKasbonToSettle(null)}
        onConfirm={settleKasbon}
      />

      <StartFreshModal
        isOpen={startFreshOpen}
        onClose={() => setStartFreshOpen(false)}
        onConfirm={startFresh}
      />
    </div>
  );
}
