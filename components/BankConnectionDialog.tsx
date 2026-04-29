'use client';

import { useState } from 'react';
import { X, Wifi, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface SEPAAccount {
  iban: string;
  bic: string;
  accountNumber: string;
  accountOwnerName?: string;
  accountName?: string;
}

interface Props {
  accountId: number;
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'credentials' | 'select_account' | 'done';

export default function BankConnectionDialog({ accountId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('credentials');
  const [blz, setBlz] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<SEPAAccount[]>([]);
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [selectedIban, setSelectedIban] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleConnect() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/bank-connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blz, url: url || undefined, username, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'wrong_credentials') setError(t('bank_connect_error_credentials'));
        else if (data.error === 'tan_required') setError(t('bank_connect_error_tan'));
        else if (data.error === 'no_url') setError(t('bank_connect_error_no_url'));
        else setError(t('bank_connect_error_generic', { message: data.message ?? '' }));
        return;
      }
      setResolvedUrl(data.url);
      setBankAccounts(data.accounts ?? []);
      if (data.accounts?.length === 1) {
        setSelectedIban(data.accounts[0].iban);
        await saveConnection(data.url, data.accounts[0].iban);
      } else {
        setStep('select_account');
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveConnection(bankUrl: string, iban: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/bank-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, blz, bank_url: bankUrl, username, pin, iban }),
      });
      if (!res.ok) { setError(t('bank_connect_error_generic', { message: '' })); return; }
      setStep('done');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectAccount(iban: string) {
    setSelectedIban(iban);
    await saveConnection(resolvedUrl, iban);
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Wifi size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">{t('bank_connect_title')}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {step === 'credentials' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">{t('bank_connect_intro')}</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('bank_connect_blz_label')}</label>
                <input
                  className={inputCls}
                  placeholder="12345678"
                  value={blz}
                  onChange={e => setBlz(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  maxLength={8}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('bank_connect_url_label')}</label>
                <input
                  className={inputCls}
                  placeholder={t('bank_connect_url_placeholder')}
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">{t('bank_connect_url_hint')}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('bank_connect_username_label')}</label>
                <input
                  className={inputCls}
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('bank_connect_pin_label')}</label>
                <input
                  type="password"
                  className={inputCls}
                  autoComplete="current-password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleConnect(); }}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={loading || !blz || !username || !pin}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? t('bank_connect_testing') : t('bank_connect_test')}
              </button>

              <p className="text-xs text-gray-400 text-center">{t('bank_connect_security_hint')}</p>
            </div>
          )}

          {step === 'select_account' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">{t('bank_connect_select_account')}</p>
              {bankAccounts.map(acc => (
                <button
                  key={acc.iban}
                  onClick={() => handleSelectAccount(acc.iban)}
                  disabled={saving}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    selectedIban === acc.iban
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">{acc.accountName ?? acc.accountOwnerName ?? acc.accountNumber}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{acc.iban}</div>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check size={24} className="text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-900">{t('bank_connect_success')}</p>
              <p className="text-xs text-gray-500">{t('bank_connect_success_hint')}</p>
              <button onClick={onClose} className="mt-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                {t('plan_ok')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
