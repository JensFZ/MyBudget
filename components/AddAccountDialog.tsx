'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import {
  Banknote, CreditCard, Wallet, PiggyBank, Building2, TrendingUp,
  Home, Car, DollarSign, ChevronLeft, Check, Wifi, AlertCircle, ChevronRight
} from 'lucide-react';
import { lookupFintsUrl } from '@/lib/blz-lookup';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type AccountSubtype = {
  id: string;
  labelKey: string;
  descKey: string;
  icon: React.ReactNode;
  dbType: 'checking' | 'savings' | 'cash' | 'credit' | 'tracking' | 'closed';
  on_budget: 1 | 0;
  canLinkBank: boolean;
};

interface SEPAAccount {
  iban: string;
  bic: string;
  accountNumber: string;
  accountOwnerName?: string;
  accountName?: string;
}

type Step = 'type' | 'details' | 'offer' | 'bank_credentials' | 'bank_select' | 'bank_done';

const BUDGET_ACCOUNTS: AccountSubtype[] = [
  { id: 'checking', labelKey: 'acct_checking', descKey: 'acct_checking_desc', icon: <Banknote size={22} />, dbType: 'checking', on_budget: 1, canLinkBank: true },
  { id: 'savings', labelKey: 'acct_savings', descKey: 'acct_savings_desc', icon: <PiggyBank size={22} />, dbType: 'savings', on_budget: 1, canLinkBank: true },
  { id: 'cash', labelKey: 'acct_cash', descKey: 'acct_cash_desc', icon: <Wallet size={22} />, dbType: 'cash', on_budget: 1, canLinkBank: false },
  { id: 'credit', labelKey: 'acct_credit', descKey: 'acct_credit_desc', icon: <CreditCard size={22} />, dbType: 'credit', on_budget: 1, canLinkBank: true },
  { id: 'loc', labelKey: 'acct_loc', descKey: 'acct_loc_desc', icon: <DollarSign size={22} />, dbType: 'credit', on_budget: 1, canLinkBank: true },
];

const TRACKING_ACCOUNTS: AccountSubtype[] = [
  { id: 'asset', labelKey: 'acct_asset', descKey: 'acct_asset_desc', icon: <TrendingUp size={22} />, dbType: 'tracking', on_budget: 0, canLinkBank: false },
  { id: 'real_estate', labelKey: 'acct_real_estate', descKey: 'acct_real_estate_desc', icon: <Home size={22} />, dbType: 'tracking', on_budget: 0, canLinkBank: false },
  { id: 'vehicle', labelKey: 'acct_vehicle', descKey: 'acct_vehicle_desc', icon: <Car size={22} />, dbType: 'tracking', on_budget: 0, canLinkBank: false },
  { id: 'loan', labelKey: 'acct_loan', descKey: 'acct_loan_desc', icon: <Building2 size={22} />, dbType: 'tracking', on_budget: 0, canLinkBank: false },
];

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

export default function AddAccountDialog({ open, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('type');
  const [selected, setSelected] = useState<AccountSubtype | null>(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('0');
  const [balanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [newAccountId, setNewAccountId] = useState<number | null>(null);
  const [newAccountName, setNewAccountName] = useState('');

  // Bank connection state
  const [blz, setBlz] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<SEPAAccount[]>([]);
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [selectedIban, setSelectedIban] = useState<string | null>(null);
  const [bankSaving, setBankSaving] = useState(false);

  function resetBank() {
    setBlz(''); setUrl(''); setUsername(''); setPin('');
    setBankError(null); setBankAccounts([]); setResolvedUrl('');
    setSelectedIban(null);
  }

  function handleSelectType(type: AccountSubtype) {
    setSelected(type);
    setStep('details');
    setName('');
    setBalance('0');
  }

  function handleClose() {
    setStep('type');
    setSelected(null);
    setName(''); setBalance('0');
    setNewAccountId(null); setNewAccountName('');
    resetBank();
    onClose();
  }

  async function handleSave() {
    if (!selected || !name.trim()) return;
    const numBalance = parseFloat(balance.replace(',', '.')) || 0;
    setSaving(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type: selected.dbType, balance: numBalance, on_budget: selected.on_budget }),
      });
      const created = await res.json();
      onSaved();
      if (selected.canLinkBank) {
        setNewAccountId(created.id);
        setNewAccountName(name.trim());
        setStep('offer');
      } else {
        handleClose();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleBankConnect() {
    setBankError(null);
    setBankLoading(true);
    try {
      const res = await fetch('/api/bank-connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blz, url: url || undefined, username, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'wrong_credentials') setBankError(t('bank_connect_error_credentials'));
        else if (data.error === 'tan_required') setBankError(t('bank_connect_error_tan'));
        else if (data.error === 'no_url') setBankError(t('bank_connect_error_no_url'));
        else if (data.error === 'bad_response') setBankError(t('bank_connect_error_bad_response'));
        else setBankError(t('bank_connect_error_generic', { message: data.message ?? '' }));
        return;
      }
      setResolvedUrl(data.url);
      setBankAccounts(data.accounts ?? []);
      if (data.accounts?.length === 1) {
        setSelectedIban(data.accounts[0].iban);
        await saveBankConnection(data.url, data.accounts[0].iban);
      } else {
        setStep('bank_select');
      }
    } finally {
      setBankLoading(false);
    }
  }

  async function saveBankConnection(bankUrl: string, iban: string) {
    if (!newAccountId) return;
    setBankSaving(true);
    try {
      const res = await fetch('/api/bank-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: newAccountId, blz, bank_url: bankUrl, username, pin, iban }),
      });
      if (!res.ok) { setBankError(t('bank_connect_error_generic', { message: '' })); return; }
      setStep('bank_done');
    } finally {
      setBankSaving(false);
    }
  }

  const title: Record<Step, string> = {
    type: t('add_account_title'),
    details: selected ? t('add_account_add_type_title', { type: t(selected.labelKey) }) : '',
    offer: t('add_account_connect_bank_title'),
    bank_credentials: t('bank_connect_title'),
    bank_select: t('bank_connect_title'),
    bank_done: t('bank_connect_title'),
  };

  const showBack = step === 'details' || step === 'bank_credentials';

  function handleBack() {
    if (step === 'details') { setStep('type'); setSelected(null); }
    if (step === 'bank_credentials') setStep('offer');
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {showBack && (
              <button onClick={handleBack} className="text-gray-400 hover:text-gray-700">
                <ChevronLeft size={18} />
              </button>
            )}
            <DialogTitle>{title[step]}</DialogTitle>
          </div>
        </DialogHeader>

        {/* Step: type selection */}
        {step === 'type' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('add_account_budget_section')}</p>
              <p className="text-xs text-gray-400 mb-3">{t('add_account_budget_desc')}</p>
              <div className="grid grid-cols-1 gap-1">
                {BUDGET_ACCOUNTS.map(type => (
                  <button key={type.id} onClick={() => handleSelectType(type)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-left transition-colors group">
                    <span className="text-gray-400 group-hover:text-blue-500">{type.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{t(type.labelKey)}</div>
                      <div className="text-xs text-gray-400">{t(type.descKey)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('add_account_tracking_section')}</p>
              <p className="text-xs text-gray-400 mb-3">{t('add_account_tracking_desc')}</p>
              <div className="grid grid-cols-1 gap-1">
                {TRACKING_ACCOUNTS.map(type => (
                  <button key={type.id} onClick={() => handleSelectType(type)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50 text-left transition-colors group">
                    <span className="text-gray-400 group-hover:text-purple-500">{type.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{t(type.labelKey)}</div>
                      <div className="text-xs text-gray-400">{t(type.descKey)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step: account details */}
        {step === 'details' && selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-blue-500">{selected.icon}</span>
              <div>
                <div className="text-sm font-semibold text-gray-800">{t(selected.labelKey)}</div>
                <div className="text-xs text-gray-400">{t(selected.descKey)}</div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('add_account_name_label')} <span className="text-red-500">*</span></label>
              <input autoFocus className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder={t('add_account_name_placeholder', { type: t(selected.labelKey) })}
                value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('add_account_balance_label')}</label>
              <div className="flex items-center gap-2">
                <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 text-right"
                  placeholder="0,00" value={balance} onChange={e => setBalance(e.target.value)}
                  onFocus={e => e.target.select()} onKeyDown={e => e.key === 'Enter' && handleSave()} />
                <span className="text-sm text-gray-500">€</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {t('add_account_balance_hint', { date: new Date(balanceDate).toLocaleDateString('de-DE') })}
                {selected.dbType === 'credit' && t('add_account_credit_hint')}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">{t('add_account_cancel')}</button>
              <button onClick={handleSave} disabled={saving || !name.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <Check size={14} /> {saving ? t('add_account_saving') : t('add_account_save')}
              </button>
            </div>
          </div>
        )}

        {/* Step: offer bank connection */}
        {step === 'offer' && (
          <div className="space-y-5 py-2">
            <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                <Check size={14} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">{t('add_account_created')}</p>
                <p className="text-xs text-green-600 mt-0.5">{newAccountName}</p>
              </div>
            </div>
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                <Wifi size={22} className="text-blue-500" />
              </div>
              <p className="text-sm font-medium text-gray-900">{t('add_account_connect_bank_prompt')}</p>
              <p className="text-xs text-gray-500">{t('add_account_connect_bank_desc')}</p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button onClick={() => setStep('bank_credentials')}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                <Wifi size={16} /> {t('bank_connect_button')}
              </button>
              <button onClick={handleClose} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                {t('add_account_skip')}
              </button>
            </div>
          </div>
        )}

        {/* Step: bank credentials */}
        {step === 'bank_credentials' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{t('bank_connect_intro')}</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('bank_connect_blz_label')}</label>
              <input className={inputCls} placeholder="12345678" value={blz} autoFocus
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setBlz(v);
                  if (v.length === 8) { const found = lookupFintsUrl(v); if (found) setUrl(found); }
                }} maxLength={8} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('bank_connect_url_label')}</label>
              <input className={inputCls} placeholder={t('bank_connect_url_placeholder')} value={url} onChange={e => setUrl(e.target.value)} />
              {blz.length === 8 && url && lookupFintsUrl(blz) === url
                ? <p className="text-xs text-green-600 mt-1">✓ {t('bank_connect_url_hint_found')}</p>
                : blz.length === 8 && !url
                  ? <p className="text-xs text-amber-600 mt-1">{t('bank_connect_url_hint_unknown')}</p>
                  : <p className="text-xs text-gray-400 mt-1">{t('bank_connect_url_hint')}</p>
              }
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('bank_connect_username_label')}</label>
              <input className={inputCls} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('bank_connect_pin_label')}</label>
              <input type="password" className={inputCls} autoComplete="current-password" value={pin}
                onChange={e => setPin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleBankConnect(); }} />
            </div>
            {bankError && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{bankError}</span>
              </div>
            )}
            <button onClick={handleBankConnect} disabled={bankLoading || !blz || !username || !pin}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {bankLoading ? t('bank_connect_testing') : t('bank_connect_test')}
            </button>
            <p className="text-xs text-gray-400 text-center">{t('bank_connect_security_hint')}</p>
          </div>
        )}

        {/* Step: select bank account */}
        {step === 'bank_select' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">{t('bank_connect_select_account')}</p>
            {bankAccounts.map(acc => (
              <button key={acc.iban} onClick={() => { setSelectedIban(acc.iban); saveBankConnection(resolvedUrl, acc.iban); }}
                disabled={bankSaving}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  selectedIban === acc.iban ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900">{acc.accountName ?? acc.accountOwnerName ?? acc.accountNumber}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">{acc.iban}</div>
                </div>
                <ChevronRight size={16} className="text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Step: bank done */}
        {step === 'bank_done' && (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check size={24} className="text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">{t('bank_connect_success')}</p>
            <p className="text-xs text-gray-500">{t('bank_connect_success_hint')}</p>
            <button onClick={handleClose} className="mt-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              {t('plan_ok')}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
