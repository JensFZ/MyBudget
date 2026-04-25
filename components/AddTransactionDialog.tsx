'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Account {
  id: number;
  name: string;
  type: string;
}

interface CategoryGroup {
  id: number;
  name: string;
}

interface Category {
  id: number;
  group_id: number;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultAccountId?: number;
}

const FLAGS = [
  { value: '', label: 'None' },
  { value: 'red', label: '🔴 Red' },
  { value: 'yellow', label: '🟡 Yellow' },
  { value: 'green', label: '🟢 Green' },
];

export default function AddTransactionDialog({ open, onClose, onSaved, defaultAccountId }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const [accountId, setAccountId] = useState<string>('');
  const [date, setDate] = useState(today);
  const [payee, setPayee] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [memo, setMemo] = useState('');
  const [amount, setAmount] = useState('');
  const [isInflow, setIsInflow] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [flag, setFlag] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch('/api/accounts').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([accs, cats]) => {
      setAccounts(accs);
      setGroups(cats.groups);
      setCategories(cats.categories);
      if (defaultAccountId) {
        setAccountId(String(defaultAccountId));
      } else if (accs.length > 0 && !accountId) {
        setAccountId(String(accs[0].id));
      }
    }).catch(() => {});
  }, [open]);

  async function handleSave() {
    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!accountId || isNaN(numericAmount) || numericAmount <= 0) return;

    setSaving(true);
    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: Number(accountId),
          category_id: categoryId ? Number(categoryId) : null,
          date,
          amount: isInflow ? numericAmount : -numericAmount,
          memo: memo || null,
          payee: payee || null,
          cleared: cleared ? 1 : 0,
          flag: flag || null,
        }),
      });
      onSaved();
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setPayee('');
    setCategoryId('');
    setMemo('');
    setAmount('');
    setIsInflow(false);
    setCleared(false);
    setFlag('');
    setDate(today);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Account */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* Payee */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payee</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="Who paid / received?"
              value={payee}
              onChange={e => setPayee(e.target.value)}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
            >
              <option value="">Choose Category...</option>
              {groups.map(g => (
                <optgroup key={g.id} label={g.name}>
                  {categories.filter(c => c.group_id === g.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Memo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Memo</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="Optional note"
              value={memo}
              onChange={e => setMemo(e.target.value)}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 text-right"
                placeholder="0,00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              <span className="text-sm text-gray-500">€</span>
            </div>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" checked={!isInflow} onChange={() => setIsInflow(false)} />
                <span className="text-gray-700">Outflow</span>
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" checked={isInflow} onChange={() => setIsInflow(true)} />
                <span className="text-gray-700">Inflow</span>
              </label>
            </div>
          </div>

          {/* Cleared + Flag */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={cleared}
                onChange={e => setCleared(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700">Cleared</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Flag</label>
              <select
                className="border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-blue-400"
                value={flag}
                onChange={e => setFlag(e.target.value)}
              >
                {FLAGS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !accountId || !amount}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
