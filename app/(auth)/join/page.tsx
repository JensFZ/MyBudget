'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Eye, EyeOff, ChevronRight } from 'lucide-react';

type Mode = 'new' | 'existing';

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [vaultName, setVaultName] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [mode, setMode] = useState<Mode>('new');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setTokenError('Kein Einladungstoken gefunden.'); return; }
    fetch(`/api/vaults/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setTokenError('Dieser Einladungslink ist ungültig oder abgelaufen.');
        else setVaultName(d.vaultName);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = mode === 'new'
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const res = await fetch(`/api/vaults/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler beim Beitreten'); return; }
      router.replace('/plan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4 shadow-lg">
            <Users size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Einladung</h1>
          {vaultName && !tokenError && (
            <p className="text-sm text-gray-500 mt-1">
              Du wurdest eingeladen, <span className="font-medium text-gray-700">{vaultName}</span> beizutreten.
            </p>
          )}
        </div>

        {tokenError ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7 text-center">
            <p className="text-sm text-red-500">{tokenError}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7">
            {/* Mode switcher */}
            <div className="flex rounded-lg border border-gray-200 mb-5 overflow-hidden">
              <button
                type="button"
                onClick={() => { setMode('new'); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'new' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Neuen Account
              </button>
              <button
                type="button"
                onClick={() => { setMode('existing'); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'existing' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Bestehender Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'new' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                  <input
                    autoFocus required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    placeholder="Max Mustermann"
                    value={name} onChange={e => setName(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail</label>
                <input
                  type="email" required
                  autoFocus={mode === 'existing'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
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
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? 'Bitte warten…' : (
                  <>{mode === 'new' ? 'Registrieren & beitreten' : 'Anmelden & beitreten'} <ChevronRight size={15} /></>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
