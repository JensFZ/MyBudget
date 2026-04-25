'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import {
  Banknote, CreditCard, Wallet, PiggyBank, Building2, TrendingUp,
  Home, Car, DollarSign, ChevronLeft, Check
} from 'lucide-react';

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
  dbType: 'cash' | 'credit' | 'tracking' | 'closed';
  on_budget: 1 | 0;
};

const BUDGET_ACCOUNTS: AccountSubtype[] = [
  { id: 'checking', labelKey: 'acct_checking', descKey: 'acct_checking_desc', icon: <Banknote size={22} />, dbType: 'cash', on_budget: 1 },
  { id: 'savings', labelKey: 'acct_savings', descKey: 'acct_savings_desc', icon: <PiggyBank size={22} />, dbType: 'cash', on_budget: 1 },
  { id: 'cash', labelKey: 'acct_cash', descKey: 'acct_cash_desc', icon: <Wallet size={22} />, dbType: 'cash', on_budget: 1 },
  { id: 'credit', labelKey: 'acct_credit', descKey: 'acct_credit_desc', icon: <CreditCard size={22} />, dbType: 'credit', on_budget: 1 },
  { id: 'loc', labelKey: 'acct_loc', descKey: 'acct_loc_desc', icon: <DollarSign size={22} />, dbType: 'credit', on_budget: 1 },
];

const TRACKING_ACCOUNTS: AccountSubtype[] = [
  { id: 'asset', labelKey: 'acct_asset', descKey: 'acct_asset_desc', icon: <TrendingUp size={22} />, dbType: 'tracking', on_budget: 0 },
  { id: 'real_estate', labelKey: 'acct_real_estate', descKey: 'acct_real_estate_desc', icon: <Home size={22} />, dbType: 'tracking', on_budget: 0 },
  { id: 'vehicle', labelKey: 'acct_vehicle', descKey: 'acct_vehicle_desc', icon: <Car size={22} />, dbType: 'tracking', on_budget: 0 },
  { id: 'loan', labelKey: 'acct_loan', descKey: 'acct_loan_desc', icon: <Building2 size={22} />, dbType: 'tracking', on_budget: 0 },
];

export default function AddAccountDialog({ open, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<AccountSubtype | null>(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('0');
  const [balanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  function handleSelectType(type: AccountSubtype) {
    setSelected(type);
    setStep(2);
    setName('');
    setBalance('0');
  }

  function handleBack() {
    setStep(1);
    setSelected(null);
  }

  function handleClose() {
    setStep(1);
    setSelected(null);
    setName('');
    setBalance('0');
    onClose();
  }

  async function handleSave() {
    if (!selected || !name.trim()) return;
    const numBalance = parseFloat(balance.replace(',', '.')) || 0;
    setSaving(true);
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type: selected.dbType,
          balance: numBalance,
          on_budget: selected.on_budget,
        }),
      });
      onSaved();
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button onClick={handleBack} className="text-gray-400 hover:text-gray-700">
                <ChevronLeft size={18} />
              </button>
            )}
            <DialogTitle>
              {step === 1
                ? t('add_account_title')
                : t('add_account_add_type_title', { type: selected ? t(selected.labelKey) : '' })
              }
            </DialogTitle>
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {/* Budget accounts */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {t('add_account_budget_section')}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                {t('add_account_budget_desc')}
              </p>
              <div className="grid grid-cols-1 gap-1">
                {BUDGET_ACCOUNTS.map(type => (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-left transition-colors group"
                  >
                    <span className="text-gray-400 group-hover:text-blue-500">{type.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{t(type.labelKey)}</div>
                      <div className="text-xs text-gray-400">{t(type.descKey)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tracking accounts */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {t('add_account_tracking_section')}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                {t('add_account_tracking_desc')}
              </p>
              <div className="grid grid-cols-1 gap-1">
                {TRACKING_ACCOUNTS.map(type => (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50 text-left transition-colors group"
                  >
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

        {step === 2 && selected && (
          <div className="space-y-4">
            {/* Selected type badge */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-blue-500">{selected.icon}</span>
              <div>
                <div className="text-sm font-semibold text-gray-800">{t(selected.labelKey)}</div>
                <div className="text-xs text-gray-400">{t(selected.descKey)}</div>
              </div>
            </div>

            {/* Account name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('add_account_name_label')} <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder={t('add_account_name_placeholder', { type: t(selected.labelKey) })}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>

            {/* Current balance */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('add_account_balance_label')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 text-right"
                  placeholder="0,00"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
                <span className="text-sm text-gray-500">€</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {t('add_account_balance_hint', { date: new Date(balanceDate).toLocaleDateString('de-DE') })}
                {selected.dbType === 'credit' && t('add_account_credit_hint')}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                {t('add_account_cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Check size={14} />
                {saving ? t('add_account_saving') : t('add_account_save')}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
