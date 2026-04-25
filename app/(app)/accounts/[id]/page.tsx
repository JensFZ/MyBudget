'use client';

import { useState, useEffect, useCallback } from 'react';
import { use } from 'react';
import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { Plus, Link2, FileUp, RotateCcw, RotateCw, Search, Star, Edit2, X, Check } from 'lucide-react';
import TransactionTable from '@/components/TransactionTable';
import type { Account, Category, CategoryGroup, SaveData } from '@/components/InlineTransactionRow';

interface AccountDetail {
  id: number;
  name: string;
  type: string;
  balance: number;
  on_budget: number;
  starred: number;
  clearedBalance: number;
  unclearedBalance: number;
}

interface Transaction {
  id: number;
  account_id: number;
  account_name: string;
  category_id: number | null;
  category_name: string | null;
  date: string;
  amount: number;
  memo: string | null;
  payee: string | null;
  cleared: number;
  flag: string | null;
  needs_category: number;
  transfer_account_id: number | null;
}

export default function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [editAccountName, setEditAccountName] = useState('');
  const [editAccountType, setEditAccountType] = useState('');
  const [editAccountBalance, setEditAccountBalance] = useState('');

  const loadAccount = useCallback(async () => {
    const res = await fetch(`/api/accounts/${id}`);
    if (res.ok) setAccount(await res.json());
  }, [id]);

  const loadTransactions = useCallback(async () => {
    const p = new URLSearchParams({ account_id: id });
    if (search) p.set('search', search);
    const res = await fetch(`/api/transactions?${p}`);
    setTransactions(await res.json());
  }, [id, search]);

  useEffect(() => {
    loadAccount();
    loadTransactions();
    fetch('/api/accounts').then(r => r.json()).then(setAccounts).catch(() => {});
    fetch('/api/categories').then(r => r.json()).then((d: { groups: CategoryGroup[]; categories: Category[] }) => {
      setGroups(d.groups);
      setCategories(d.categories);
    }).catch(() => {});
  }, [loadAccount, loadTransactions]);

  async function handleNewSaved(data: SaveData) {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setAddingNew(false);
    loadAccount();
    loadTransactions();
  }

  async function handleSave(txId: number, data: SaveData) {
    await fetch(`/api/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: data.amount,
        cleared: data.cleared,
        category_id: data.category_id,
        transfer_account_id: data.transfer_account_id,
        payee: data.payee,
        memo: data.memo,
        flag: data.flag,
      }),
    });
    loadAccount();
    loadTransactions();
  }

  async function handleDelete(txId: number) {
    await fetch(`/api/transactions/${txId}`, { method: 'DELETE' });
    loadAccount();
    loadTransactions();
  }

  async function handleToggleCleared(txId: number, cleared: number) {
    await fetch(`/api/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleared }),
    });
    loadAccount();
    loadTransactions();
  }

  function openEditAccount() {
    if (!account) return;
    setEditAccountName(account.name);
    setEditAccountType(account.type);
    setEditAccountBalance(account.balance.toFixed(2).replace('.', ','));
    setShowEditAccount(true);
  }

  async function saveEditAccount() {
    if (!account) return;
    const today = new Date().toISOString().slice(0, 10);

    // Save name/type
    await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editAccountName.trim(), type: editAccountType }),
    });

    // Balance adjustment transaction if changed
    const newBalance = parseFloat(editAccountBalance.replace(',', '.'));
    if (!isNaN(newBalance)) {
      const delta = Math.round((newBalance - account.balance) * 100) / 100;
      if (delta !== 0) {
        await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: account.id,
            category_id: null,
            date: today,
            amount: delta,
            payee: t('account_adjustment_payee'),
            memo: null,
            cleared: 1,
          }),
        });
      }
    }

    setShowEditAccount(false);
    loadAccount();
    loadTransactions();
    window.dispatchEvent(new CustomEvent('accounts-updated'));
  }

  async function handleToggleStarred() {    if (!account) return;
    const newVal = account.starred ? 0 : 1;
    await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: newVal }),
    });
    setAccount({ ...account, starred: newVal });
    window.dispatchEvent(new CustomEvent('accounts-updated'));
  }

  if (!account) return <div className="p-8 text-center text-gray-400">{t('accounts_loading')}</div>;

  const isCredit = account.type === 'credit';

  const TYPE_LABELS: Record<string, string> = {
    cash: t('account_type_cash'),
    credit: t('account_type_credit'),
    tracking: t('account_type_tracking'),
    closed: t('account_type_closed'),
  };

  return (
    <div className="flex flex-col h-full">
      {/* Account header */}
      <div className="bg-white border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{account.name}</h1>
            <button
              onClick={handleToggleStarred}
              className={account.starred ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}
            >
              <Star size={16} fill={account.starred ? 'currentColor' : 'none'} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openEditAccount} className="text-gray-400 hover:text-gray-700"><Edit2 size={16} /></button>
            <button className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50">
              {t('account_reconcile')}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            {TYPE_LABELS[account.type] ?? account.type}
          </span>
          <span>·</span>
          <span>{t('account_not_yet_reconciled')}</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className={`font-bold ${account.clearedBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {fmt(account.clearedBalance)}
            </span>
            <span className="text-gray-500 ml-1">{t('accounts_cleared')}</span>
          </div>
          <span className="text-gray-300">+</span>
          <div>
            <span className={`font-bold ${account.unclearedBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {fmt(account.unclearedBalance)}
            </span>
            <span className="text-gray-500 ml-1">{t('accounts_uncleared')}</span>
          </div>
          <span className="text-gray-300">=</span>
          <div>
            <span className={`font-bold text-lg ${account.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {fmt(account.balance)}
            </span>
            <span className="text-gray-500 ml-1">{t('accounts_working')}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-2 bg-white border-b shrink-0">
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1 bg-blue-600 text-white text-sm rounded-lg px-3 py-1.5 hover:bg-blue-700"
        >
          <Plus size={14} /> {t('accounts_add_transaction')}
        </button>
        {isCredit && (
          <button className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            {t('account_record_payment')}
          </button>
        )}
        <button className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
          <Link2 size={14} /> {t('accounts_link_account')}
        </button>
        <button className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
          <FileUp size={14} /> {t('accounts_file_import')}
        </button>
        <button className="p-1.5 text-gray-400 hover:text-gray-700 border border-gray-200 rounded"><RotateCcw size={14} /></button>
        <button className="p-1.5 text-gray-400 hover:text-gray-700 border border-gray-200 rounded"><RotateCw size={14} /></button>
        <div className="ml-auto flex items-center gap-2">
          {showSearch ? (
            <input
              autoFocus
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400 w-48"
              placeholder={t('accounts_search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onBlur={() => { if (!search) setShowSearch(false); }}
            />
          ) : (
            <button onClick={() => setShowSearch(true)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <Search size={16} /> {t('accounts_search')}
            </button>
          )}
        </div>
      </div>

      {/* Transaction table */}
      <div className="flex-1 overflow-y-auto bg-white">
        <TransactionTable
          transactions={transactions}
          showAccount={false}
          accounts={accounts}
          categories={categories}
          groups={groups}
          defaultAccountId={account.id}
          addingNew={addingNew}
          onNewSaved={handleNewSaved}
          onNewCancelled={() => setAddingNew(false)}
          onSave={handleSave}
          onDelete={handleDelete}
          onToggleCleared={handleToggleCleared}
        />
      </div>

      {/* Edit account modal */}
      {showEditAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditAccount(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">{t('account_edit_title')}</h2>
              <button onClick={() => setShowEditAccount(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('account_edit_name')}</label>
                <input
                  autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                  value={editAccountName}
                  onChange={e => setEditAccountName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEditAccount(); if (e.key === 'Escape') setShowEditAccount(false); }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('account_edit_type')}</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                  value={editAccountType}
                  onChange={e => setEditAccountType(e.target.value)}
                >
                  <option value="cash">{t('account_type_cash')}</option>
                  <option value="credit">{t('account_type_credit')}</option>
                  <option value="tracking">{t('account_type_tracking')}</option>
                  <option value="closed">{t('account_type_closed')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('account_edit_balance')}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-right font-mono"
                  value={editAccountBalance}
                  onChange={e => setEditAccountBalance(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEditAccount(); if (e.key === 'Escape') setShowEditAccount(false); }}
                />
                <p className="text-xs text-gray-400 mt-1">{t('account_edit_balance_hint')}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowEditAccount(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">
                {t('settings_cancel')}
              </button>
              <button onClick={saveEditAccount} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                <Check size={14} /> {t('settings_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
