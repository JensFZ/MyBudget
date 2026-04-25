'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, ShieldCheck, ChevronRight, Wallet } from 'lucide-react';
import Image from 'next/image';

type Step = 'account' | '2fa' | 'done';

function PasswordStrength({ password }: { password: string }) {
  const score = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(password)).length;
  const labels = ['', 'Schwach', 'Mittel', 'Gut', 'Stark'];
  const colors = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];
  if (!password) return null;
  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? colors[score] : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className={`text-xs ${score < 2 ? 'text-red-500' : score < 4 ? 'text-orange-500' : 'text-green-600'}`}>
        {labels[score]}
      </p>
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('account');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [twoFaError, setTwoFaError] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/status').then(r => r.json()).then(d => {
      if (!d.setupNeeded) router.replace('/login');
    });
  }, [router]);

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwörter stimmen nicht überein'); return; }
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler beim Einrichten'); return; }
      // Account created + logged in — now offer 2FA setup
      const qrRes = await fetch('/api/auth/2fa');
      const qrData = await qrRes.json();
      setQrDataUrl(qrData.qrDataUrl);
      setStep('2fa');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable2fa(e: React.FormEvent) {
    e.preventDefault();
    setTwoFaError('');
    setTwoFaLoading(true);
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) { setTwoFaError(data.error ?? 'Ungültiger Code'); return; }
      setStep('done');
    } finally {
      setTwoFaLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4 shadow-lg">
            <Wallet size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MyBudget einrichten</h1>
          <p className="text-sm text-gray-500 mt-1">Erstellen Sie Ihr persönliches Konto</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(['account', '2fa', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step === s ? 'bg-blue-600 text-white' :
                ['account', '2fa', 'done'].indexOf(step) > i ? 'bg-green-500 text-white' :
                'bg-gray-200 text-gray-400'
              }`}>
                {['account', '2fa', 'done'].indexOf(step) > i ? <Check size={13} /> : i + 1}
              </div>
              {i < 2 && <div className={`w-8 h-0.5 ${['account', '2fa', 'done'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7">
          {/* Step 1: Account */}
          {step === 'account' && (
            <>
              <h2 className="text-base font-semibold text-gray-900 mb-5">Konto erstellen</h2>
              <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ihr Name</label>
                  <input
                    autoFocus required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    placeholder="Max Mustermann"
                    value={name} onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail</label>
                  <input
                    type="email" required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    placeholder="max@beispiel.de"
                    value={email} onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Passwort</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'} required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 pr-10"
                      value={password} onChange={e => setPassword(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Passwort bestätigen</label>
                  <input
                    type="password" required
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-50 ${
                      confirm && confirm !== password ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'
                    }`}
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                  />
                </div>
                {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <button
                  type="submit" disabled={loading}
                  className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? 'Erstelle Konto…' : (<>Weiter <ChevronRight size={15} /></>)}
                </button>
              </form>
            </>
          )}

          {/* Step 2: 2FA */}
          {step === '2fa' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">2-Faktor-Authentifizierung</h2>
                  <p className="text-xs text-gray-500">Optional, aber empfohlen</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Scannen Sie den QR-Code mit einer Authenticator-App (z.B. Google Authenticator, Authy) und geben Sie dann den generierten Code ein.
              </p>

              {qrDataUrl && (
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                    <img src={qrDataUrl} alt="2FA QR Code" className="w-44 h-44" />
                  </div>
                </div>
              )}

              <form onSubmit={handleEnable2fa} className="space-y-3">
                <input
                  type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                  placeholder="000000" autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-xl font-mono text-center tracking-[0.4em] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                {twoFaError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{twoFaError}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep('done')}
                    className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    Überspringen
                  </button>
                  <button
                    type="submit" disabled={twoFaLoading || totpCode.length !== 6}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {twoFaLoading ? 'Prüfen…' : '2FA aktivieren'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Step 3: Done */}
          {step === 'done' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Einrichtung abgeschlossen!</h2>
              <p className="text-sm text-gray-500 mb-6">Ihr Budget-Konto ist bereit.</p>
              <button
                onClick={() => router.replace('/plan')}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Zur Anwendung
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
