'use client';

import { useState, useEffect, useCallback } from 'react';
import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { Plus, FileUp, RotateCcw, RotateCw, Search } from 'lucide-react';
import TransactionTable from '@/components/TransactionTable';
import type { Account, Category, CategoryGroup, SaveData } from '@/components/InlineTransactionRow';

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

export default function AllAccountsPage() {
  const { t } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const clearedBalance = transactions.filter(t => t.cleared).reduce((s, t) => s + t.amount, 0);
  const unclearedBalance = transactions.filter(t => !t.cleared).reduce((s, t) => s + t.amount, 0);
  const workingBalance = clearedBalance + unclearedBalance;
  const needsCategoryCount = transactions.filter(t => !t.category_id && t.amount < 0 && !t.transfer_account_id).length;

  const loadTransactions = useCallback(async () => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    const res = await fetch(`/api/transactions?${p}`);
    setTransactions(await res.json());
  }, [search]);

  useEffect(() => {
    loadTransactions();
    fetch('/api/accounts').then(r => r.json()).then(setAccounts).catch(() => {});
    fetch('/api/categories').then(r => r.json()).then((d: { groups: CategoryGroup[]; categories: Category[] }) => {
      setGroups(d.groups);
      setCategories(d.categories);
    }).catch(() => {});
  }, [loadTransactions]);

  async function handleNewSaved(data: SaveData) {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setAddingNew(false);
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
    loadTransactions();
  }

  async function handleDelete(txId: number) {
    await fetch(`/api/transactions/${txId}`, { method: 'DELETE' });
    loadTransactions();
  }

  async function handleToggleCleared(txId: number, cleared: number) {
    await fetch(`/api/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleared }),
    });
    loadTransactions();
  }

  return (
    <div className="flex flex-col h-full">
      {needsCategoryCount > 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 flex items-center justify-between shrink-0">
          <span className="text-sm text-yellow-800">
            {t('accounts_needs_category', { count: String(needsCategoryCount) })}
          </span>
          <button className="text-xs font-semibold text-yellow-700 hover:text-yellow-900 bg-yellow-100 px-3 py-1 rounded-full">
            {t('accounts_needs_category_view')}
          </button>
        </div>
      )}

      <div className="bg-white border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold text-gray-900 mb-3">{t('accounts_title')}</h1>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="font-bold text-gray-900">{fmt(clearedBalance)}</span>
            <span className="text-gray-500 ml-1">{t('accounts_cleared')}</span>
          </div>
          <span className="text-gray-300">+</span>
          <div>
            <span className="font-bold text-gray-900">{fmt(unclearedBalance)}</span>
            <span className="text-gray-500 ml-1">{t('accounts_uncleared')}</span>
          </div>
          <span className="text-gray-300">=</span>
          <div>
            <span className="font-bold text-lg text-gray-900">{fmt(workingBalance)}</span>
            <span className="text-gray-500 ml-1">{t('accounts_working')}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-6 py-2 bg-white border-b shrink-0">
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1 bg-blue-600 text-white text-sm rounded-lg px-3 py-1.5 hover:bg-blue-700"
        >
          <Plus size={14} /> {t('accounts_add_transaction')}
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

      <div className="flex-1 overflow-y-auto bg-white">
        <TransactionTable
          transactions={transactions}
          showAccount={true}
          accounts={accounts}
          categories={categories}
          groups={groups}
          addingNew={addingNew}
          onNewSaved={handleNewSaved}
          onNewCancelled={() => setAddingNew(false)}
          onSave={handleSave}
          onDelete={handleDelete}
          onToggleCleared={handleToggleCleared}
        />
      </div>
    </div>
  );
}
