import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  error: string | null;
  onClose: () => void;
  onGoogle: () => Promise<void>;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailRegister: (email: string, password: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen, error, onClose, onGoogle, onEmailSignIn, onEmailRegister, onPasswordReset,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signin') {
        await onEmailSignIn(email, password);
        onClose();
      }
      else await onEmailRegister(email, password);
    } catch { /* Error is shown from the auth store. */ }
    finally { setBusy(false); }
  };

  const resetPassword = async () => {
    setBusy(true);
    try { await onPasswordReset(email); } catch { /* Error is shown from the auth store. */ }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="auth-title" className="text-lg font-bold text-slate-900">{mode === 'signin' ? 'Masuk ke akun' : 'Buat akun baru'}</h2>
            <p className="mt-1 text-sm text-slate-500">Sinkronkan data konter dengan aman.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Email
            <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" placeholder="nama@email.com" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Kata sandi
            <input required minLength={6} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" placeholder="Minimal 6 karakter" />
          </label>
          {error && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
          <button disabled={busy} type="submit" className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">{busy ? 'Memproses…' : mode === 'signin' ? 'Masuk dengan Email' : 'Buat Akun'}</button>
        </form>
        {mode === 'signin' && <button type="button" disabled={busy || !email} onClick={resetPassword} className="mt-3 w-full text-sm font-medium text-teal-800 hover:underline disabled:text-slate-400">Lupa kata sandi?</button>}
        <div className="my-4 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />atau<span className="h-px flex-1 bg-slate-200" /></div>
        <button type="button" disabled={busy} onClick={() => { setBusy(true); void onGoogle().finally(() => setBusy(false)); }} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Lanjutkan dengan Google</button>
        <p className="mt-4 text-center text-sm text-slate-600">{mode === 'signin' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
          <button type="button" onClick={() => setMode(mode === 'signin' ? 'register' : 'signin')} className="font-semibold text-teal-800 hover:underline">{mode === 'signin' ? 'Buat akun' : 'Masuk'}</button>
        </p>
      </section>
    </div>
  );
};
