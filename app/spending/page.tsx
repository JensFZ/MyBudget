'use client';

import { useState, useEffect, useCallback } from 'react';
import { fmt } from '@/lib/format';
import { Search, Plus, Flag } from 'lucide-react';
import TransactionForm from '@/components/TransactionForm';

interface Transaction {
  id: number;
  payee: string | null;
  memo: string | null;
  amount: number;
  date: string;
  flag: string | null;
  cleared: number;
  account_name: string;
  category_name: string | null;
}

export default function SpendingPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showTxForm, setShowTxForm] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ month: '2026-04' });
    if (search) params.set('search', search);
    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    setTransactions(data);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  // Group by date
  const grouped: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    if (!grouped[tx.date]) grouped[tx.date] = [];
    grouped[tx.date].push(tx);
  }

  const flagColors: Record<string, string> = {
    red: 'text-red-500',
    yellow: 'text-yellow-500',
    green: 'text-green-500',
  };

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  async function deleteTransaction(id: number) {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">Ausgaben</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSearch(v => !v)}>
              <Search size={20} className="text-gray-500" />
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="px-4 pb-3">
            <input
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="Suche nach Empfänger, Notiz..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Transaction list */}
      {Object.entries(grouped).map(([date, txs]) => (
        <div key={date}>
          <div className="px-4 py-2 bg-gray-50 border-b">
            <span className="text-xs font-semibold text-gray-500 uppercase">{formatDate(date)}</span>
          </div>
          {txs.map(tx => (
            <div
              key={tx.id}
              className="flex items-center justify-between px-4 py-3 border-b active:bg-gray-50"
              onDoubleClick={() => deleteTransaction(tx.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {tx.payee || tx.memo || 'Transaktion'}
                  </span>
                  {!tx.cleared && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {tx.category_name && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {tx.category_name}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{tx.account_name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className={`text-sm font-semibold ${tx.amount < 0 ? 'text-gray-900' : 'text-green-600'}`}>
                  {fmt(tx.amount)}
                </span>
                {tx.flag && (
                  <Flag size={14} className={flagColors[tx.flag] ?? 'text-gray-400'} fill="currentColor" />
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {transactions.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>Keine Transaktionen gefunden</p>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowTxForm(true)}
        className="fixed bottom-24 right-4 bg-blue-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-40"
      >
        <Plus size={24} />
      </button>

      <TransactionForm
        open={showTxForm}
        onClose={() => setShowTxForm(false)}
        onSaved={load}
      />
    </div>
  );
}
