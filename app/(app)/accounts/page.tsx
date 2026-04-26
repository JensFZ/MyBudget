'use client';

import { useState, useEffect, useCallback } from 'react';
import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { Plus, FileUp, RotateCcw, RotateCw, Search, X } from 'lucide-react';
import TransactionTable from '@/components/TransactionTable';
import ImportDialog from '@/components/ImportDialog';
import type { Account, Category, CategoryGroup, SaveData } from '@/components/InlineTransactionRow';

type Filter = 'all' | 'uncleared' | 'needs_category';

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
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');

  const clearedBalance = transactions.filter(tx => tx.cleared).reduce((s, tx) => s + tx.amount, 0);
  const unclearedBalance = transactions.filter(tx => !tx.cleared).reduce((s, tx) => s + tx.amount, 0);
  const workingBalance = clearedBalance + unclearedBalance;
  const needsCategoryCount = transactions.filter(tx => !tx.category_id && tx.amount < 0 && !tx.transfer_account_id).length;

  const filtered = transactions.filter(tx => {
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${tx.payee ?? ''} ${tx.memo ?? ''} ${tx.category_name ?? ''} ${tx.account_name}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (activeFilter === 'uncleared') return !tx.cleared;
    if (activeFilter === 'needs_category') return !tx.category_id && tx.amount < 0 && !tx.transfer_account_id;
    return true;
  });

  const loadTransactions = useCallback(async () => {
    const res = await fetch('/api/transactions');
    setTransactions(await res.json());
  }, []);

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

  function toggleFilter(f: Filter) {
    setActiveFilter(prev => prev === f ? 'all' : f);
  }

  const filterPill = (f: Filter, label: string) => (
    <button
      onClick={() => toggleFilter(f)}
      className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
        activeFilter === f
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {needsCategoryCount > 0 && (
        <button
          onClick={() => toggleFilter('needs_category')}
          className={`w-full text-left border-b px-6 py-2 flex items-center justify-between shrink-0 transition-colors ${
            activeFilter === 'needs_category'
              ? 'bg-yellow-100 border-yellow-300'
              : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
          }`}
        >
          <span className="text-sm text-yellow-800">
            {t('accounts_needs_category', { count: String(needsCategoryCount) })}
          </span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            activeFilter === 'needs_category'
              ? 'bg-yellow-400 text-yellow-900'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {activeFilter === 'needs_category' ? t('filter_active') : t('accounts_needs_category_view')}
          </span>
        </button>
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

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-2 bg-white border-b shrink-0">
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1 bg-blue-600 text-white text-sm rounded-lg px-3 py-1.5 hover:bg-blue-700"
        >
          <Plus size={14} /> {t('accounts_add_transaction')}
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
        >
          <FileUp size={14} /> {t('accounts_file_import')}
        </button>
        <button className="p-1.5 text-gray-400 hover:text-gray-700 border border-gray-200 rounded"><RotateCcw size={14} /></button>
        <button className="p-1.5 text-gray-400 hover:text-gray-700 border border-gray-200 rounded"><RotateCw size={14} /></button>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 ml-3 border-l pl-3 border-gray-200">
          {filterPill('all', t('filter_all'))}
          {filterPill('uncleared', t('filter_uncleared'))}
          {filterPill('needs_category', t('filter_needs_category'))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {showSearch ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400 w-48"
                placeholder={t('accounts_search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onBlur={() => { if (!search) setShowSearch(false); }}
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
          ) : (
            <button onClick={() => setShowSearch(true)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <Search size={16} /> {t('accounts_search')}
            </button>
          )}
        </div>
      </div>

      {/* Active filter indicator */}
      {(activeFilter !== 'all' || search) && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-1.5 flex items-center gap-2 shrink-0">
          <span className="text-xs text-blue-700">
            {t('filter_showing', { count: String(filtered.length) })}
          </span>
          <button
            onClick={() => { setActiveFilter('all'); setSearch(''); }}
            className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
          >
            {t('filter_clear')}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white">
        <TransactionTable
          transactions={filtered}
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

      {showImport && (
        <ImportDialog
          accounts={accounts}
          onClose={() => setShowImport(false)}
          onImported={() => { loadTransactions(); }}
        />
      )}
    </div>
  );
}
