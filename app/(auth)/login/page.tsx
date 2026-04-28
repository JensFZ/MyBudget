'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Eye, EyeOff, Lock } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const totpRef = useRef<HTMLInputElement>(null);

  // Check if setup is needed
  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(d => { if (d.setupNeeded) router.replace('/setup'); });
  }, [router]);

  // Pre-fill email from single user
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.ok) router.replace('/plan'); // already logged in
    });
  }, [router]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Anmeldung fehlgeschlagen'); return; }
      if (data.requires2fa) {
        setStep('2fa');
        setTimeout(() => totpRef.current?.focus(), 50);
        return;
      }
      router.replace('/plan');
    } finally {
      setLoading(false);
    }
  }

  async function handle2fa(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totpCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Ungültiger Code'); return; }
      router.replace('/plan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4 shadow-lg">
            <Lock size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MyBudget</h1>
          <p className="text-sm text-gray-500 mt-1">Persönliche Budgetverwaltung</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7">
          {step === 'credentials' ? (
            <>
              <h2 className="text-base font-semibold text-gray-900 mb-5">Anmelden</h2>
              <form onSubmit={handleCredentials} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail</label>
                  <input
                    type="email"
                    autoFocus
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Passwort</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 pr-10"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
                >
                  {loading ? 'Anmelden…' : 'Anmelden'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <ShieldCheck size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">2-Faktor-Authentifizierung</h2>
                  <p className="text-xs text-gray-500">Code aus Ihrer Authenticator-App eingeben</p>
                </div>
              </div>
              <form onSubmit={handle2fa} className="space-y-4">
                <input
                  ref={totpRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-2xl font-mono text-center tracking-[0.4em] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  value={totpCode}
                  onChange={e => {
                    setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                />
                {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); }}
                    className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    Zurück
                  </button>
                  <button
                    type="submit"
                    disabled={loading || totpCode.length !== 6}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Prüfen…' : 'Bestätigen'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Noch kein Konto?{' '}
          <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
