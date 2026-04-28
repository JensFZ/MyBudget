'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { X, Delete } from 'lucide-react';
import { fmt } from '@/lib/format';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Account {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
  group_name?: string;
}

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function TransactionForm({ open, onClose, onSaved }: TransactionFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [payee, setPayee] = useState('');
  const [cleared, setCleared] = useState(false);
  const [amount, setAmount] = useState('0');
  const [isExpense, setIsExpense] = useState(true);
  const [showCatSheet, setShowCatSheet] = useState(false);
  const [frequency, setFrequency] = useState('never');

  useEffect(() => {
    if (!open) return;
    fetch('/api/accounts').then(r => r.json()).then(data => {
      const onBudget = data.filter((a: Account & { on_budget: number }) => a.on_budget);
      setAccounts(onBudget);
      if (onBudget.length > 0 && !accountId) setAccountId(onBudget[0].id);
    });
    fetch('/api/categories').then(r => r.json()).then(data => {
      const cats = data.categories.map((c: { id: number; name: string; group_id: number }) => {
        const group = data.groups.find((g: { id: number; name: string }) => g.id === c.group_id);
        return { ...c, group_name: group?.name };
      });
      setCategories(cats);
    });
  }, [open]);

  function pressKey(key: string) {
    if (key === 'backspace') {
      setAmount(prev => prev.length <= 1 ? '0' : prev.slice(0, -1));
      return;
    }
    if (key === ',' && amount.includes(',')) return;
    if (amount === '0' && key !== ',') {
      setAmount(key);
    } else {
      const parts = amount.split(',');
      if (parts[1]?.length >= 2) return;
      setAmount(prev => prev + key);
    }
  }

  async function handleSave() {
    if (!accountId) return;
    const numeric = parseFloat(amount.replace(',', '.')) || 0;
    const finalAmount = isExpense ? -Math.abs(numeric) : Math.abs(numeric);

    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: accountId,
        category_id: categoryId,
        date,
        amount: finalAmount,
        memo,
        payee,
        cleared: cleared ? 1 : 0,
      }),
    });

    if (frequency !== 'never') {
      await fetch('/api/scheduled-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          category_id: categoryId,
          date,
          amount: finalAmount,
          memo,
          payee,
          frequency,
          cleared: cleared ? 1 : 0,
        }),
      });
    }

    onSaved();
    onClose();
    setAmount('0');
    setMemo('');
    setPayee('');
    setFrequency('never');
  }

  const selectedAccount = accounts.find(a => a.id === accountId);
  const selectedCategory = categories.find(c => c.id === categoryId);
  const numericAmount = parseFloat(amount.replace(',', '.')) || 0;

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent side="bottom" className="h-[90dvh] p-0 rounded-t-2xl overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
              <button onClick={onClose}><X size={20} /></button>
              <button
                onClick={() => setShowCatSheet(true)}
                className="text-sm text-blue-600 font-medium"
              >
                {selectedCategory ? selectedCategory.name : 'Kategorie wählen'}
              </button>
              <span className="text-sm font-semibold">Transaktion</span>
            </div>

            {/* Amount display */}
            <div className="text-center py-4 bg-gray-50">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsExpense(true)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${isExpense ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}
                >
                  Ausgabe
                </button>
                <span className={`text-3xl font-bold ${isExpense ? 'text-red-500' : 'text-green-600'}`}>
                  {isExpense ? '-' : '+'}{fmt(numericAmount)}
                </span>
                <button
                  onClick={() => setIsExpense(false)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${!isExpense ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}
                >
                  Einnahme
                </button>
              </div>
            </div>

            {/* Fields */}
            <div className="px-4 py-2 space-y-1 border-b">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Empfänger</span>
                <input
                  className="text-sm text-right outline-none text-gray-800 w-48"
                  placeholder="Name eingeben..."
                  value={payee}
                  onChange={e => setPayee(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Konto</span>
                <select
                  className="text-sm text-right outline-none bg-transparent text-gray-800"
                  value={accountId ?? ''}
                  onChange={e => setAccountId(Number(e.target.value))}
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Datum</span>
                <input
                  type="date"
                  className="text-sm text-right outline-none bg-transparent text-gray-800"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Notiz</span>
                <input
                  className="text-sm text-right outline-none text-gray-800 flex-1 ml-4"
                  placeholder="Notiz eingeben..."
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Wiederholung</span>
                <select
                  className="text-sm text-right outline-none bg-transparent text-gray-800"
                  value={frequency}
                  onChange={e => setFrequency(e.target.value)}
                >
                  <option value="never">Einmalig</option>
                  <option value="daily">Täglich</option>
                  <option value="weekly">Wöchentlich</option>
                  <option value="every_other_week">Alle zwei Wochen</option>
                  <option value="twice_a_month">Zweimal im Monat</option>
                  <option value="every_4_weeks">Alle 4 Wochen</option>
                  <option value="monthly">Monatlich</option>
                  <option value="every_other_month">Alle zwei Monate</option>
                  <option value="every_3_months">Alle 3 Monate</option>
                  <option value="every_4_months">Alle 4 Monate</option>
                  <option value="twice_a_year">Zweimal im Jahr</option>
                  <option value="yearly">Jährlich</option>
                  <option value="every_other_year">Alle zwei Jahre</option>
                </select>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500">Gebucht</span>
                <button
                  onClick={() => setCleared(c => !c)}
                  className={`w-10 h-6 rounded-full transition-colors ${cleared ? 'bg-green-500' : 'bg-gray-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${cleared ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            </div>

            {/* Numpad */}
            <div className="flex-1 grid grid-cols-4 gap-px bg-gray-100 mt-auto">
              {['7','8','9','−','4','5','6','+','1','2','3','=','','0','backspace','done'].map(k => (
                <button
                  key={k}
                  onClick={() => {
                    if (k === 'done') handleSave();
                    else if (k === '=' || k === '−' || k === '+') return;
                    else pressKey(k === 'backspace' ? 'backspace' : k);
                  }}
                  className={`bg-white flex items-center justify-center text-lg font-medium py-4 active:bg-gray-50 ${
                    k === 'done' ? 'bg-blue-600 text-white active:bg-blue-700' : ''
                  } ${k === '' ? 'opacity-0 pointer-events-none' : ''}`}
                >
                  {k === 'backspace' ? <Delete size={18} /> : k === 'done' ? 'OK' : k}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Category picker */}
      <Sheet open={showCatSheet} onOpenChange={v => !v && setShowCatSheet(false)}>
        <SheetContent side="bottom" className="h-[70dvh] p-0 rounded-t-2xl overflow-hidden">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle>Kategorie wählen</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-full pb-8">
            <button
              onClick={() => { setCategoryId(null); setShowCatSheet(false); }}
              className="w-full px-4 py-3 text-left text-sm text-gray-500 border-b"
            >
              Keine Kategorie
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => { setCategoryId(c.id); setShowCatSheet(false); }}
                className={`w-full px-4 py-3 text-left border-b hover:bg-gray-50 ${categoryId === c.id ? 'bg-blue-50' : ''}`}
              >
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-gray-400">{c.group_name}</div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
