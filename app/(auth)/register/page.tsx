'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, ChevronRight } from 'lucide-react';
import Link from 'next/link';

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

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwörter stimmen nicht überein'); return; }
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Registrierung fehlgeschlagen'); return; }
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
            <Lock size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MyBudget</h1>
          <p className="text-sm text-gray-500 mt-1">Neues Konto erstellen</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Registrieren</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                autoFocus required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                placeholder="Max Mustermann"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail</label>
              <input
                type="email" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                placeholder="max@beispiel.de"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Passwort</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} required
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
              <PasswordStrength password={password} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Passwort bestätigen</label>
              <input
                type="password" required
                className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-50 ${
                  confirm && confirm !== password ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'
                }`}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? 'Konto wird erstellt…' : (<>Konto erstellen <ChevronRight size={15} /></>)}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Bereits ein Konto?{' '}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
