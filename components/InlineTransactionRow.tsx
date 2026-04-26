'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export interface Account {
  id: number;
  name: string;
  type: string;
}

export interface CategoryGroup {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  group_id: number;
  name: string;
  color?: string | null;
}

export interface SaveData {
  account_id: number;
  category_id: number | null;
  transfer_account_id: number | null;
  date: string;
  amount: number;
  payee: string | null;
  memo: string | null;
  cleared: number;
  flag: string | null;
}

interface Props {
  mode: 'new' | 'edit';
  showAccount: boolean;
  accounts: Account[];
  categories: Category[];
  groups: CategoryGroup[];
  defaultAccountId?: number;
  initial?: {
    account_id?: number;
    category_id?: number | null;
    transfer_account_id?: number | null;
    date?: string;
    amount?: number;
    payee?: string | null;
    memo?: string | null;
    cleared?: number;
    flag?: string | null;
  };
  onSave: (data: SaveData) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}

const today = new Date().toISOString().slice(0, 10);

/** Evaluates chained expressions like "1,50+8+8+8" or "100-5,20+3" */
function evalAmount(expr: string): number {
  const s = expr.trim().replace(/,/g, '.');
  // Split before each + or - (keeping the sign with the number)
  const tokens = s.split(/(?=[+\-])/);
  let result = 0;
  for (const token of tokens) {
    const num = parseFloat(token);
    if (!isNaN(num)) result += num;
  }
  return result;
}

function fmt2(n: number): string {
  return Math.abs(n).toFixed(2).replace('.', ',');
}

function parseCategoryValue(val: string): { category_id: number | null; transfer_account_id: number | null } {
  if (val.startsWith('t:')) return { category_id: null, transfer_account_id: Number(val.slice(2)) };
  if (val.startsWith('c:')) return { category_id: Number(val.slice(2)), transfer_account_id: null };
  return { category_id: null, transfer_account_id: null };
}

function toCategoryValue(category_id: number | null, transfer_account_id: number | null): string {
  if (transfer_account_id) return `t:${transfer_account_id}`;
  if (category_id) return `c:${category_id}`;
  return '';
}

export default function InlineTransactionRow({
  mode,
  showAccount,
  accounts,
  categories,
  groups,
  defaultAccountId,
  initial,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const { t } = useI18n();

  const initAccountId = initial?.account_id ?? defaultAccountId ?? accounts[0]?.id ?? 0;
  const initCatVal = toCategoryValue(initial?.category_id ?? null, initial?.transfer_account_id ?? null);
  const initAmount = initial?.amount ?? 0;

  const [accountId, setAccountId] = useState(String(initAccountId));
  const [date, setDate] = useState(initial?.date ?? today);
  const [payee, setPayee] = useState(initial?.payee ?? '');
  const [catValue, setCatValue] = useState(initCatVal);
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [outflow, setOutflow] = useState(initAmount < 0 ? Math.abs(initAmount).toFixed(2).replace('.', ',') : '');
  const [inflow, setInflow] = useState(initAmount > 0 ? initAmount.toFixed(2).replace('.', ',') : '');
  const [cleared, setCleared] = useState(initial?.cleared ?? 0);
  const [saving, setSaving] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstInputRef.current?.focus(); }, []);

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
  }

  function makeAmountKeyDown(setValue: (v: string) => void, clearOther: () => void) {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === '+' || e.key === '-') {
        const input = e.currentTarget;
        const allSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length && input.value.length > 0;
        if (allSelected) {
          e.preventDefault();
          const newVal = input.value + e.key;
          setValue(newVal);
          clearOther();
          setTimeout(() => input.setSelectionRange(newVal.length, newVal.length), 0);
          return;
        }
      }
      handleKey(e as unknown as KeyboardEvent);
    };
  }

  async function handleSave() {
    const outNum = outflow ? evalAmount(outflow) : 0;
    const inNum  = inflow  ? evalAmount(inflow)  : 0;
    // Negative outflow → income (+), negative inflow → expense (−)
    const amount = inflow !== '' ? inNum : outflow !== '' ? -outNum : 0;

    const { category_id, transfer_account_id } = parseCategoryValue(catValue);

    setSaving(true);
    try {
      await onSave({
        account_id: Number(accountId),
        category_id,
        transfer_account_id,
        date,
        amount,
        payee: payee || null,
        memo: memo || null,
        cleared,
        flag: null,
      });
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full bg-transparent border-b border-blue-300 outline-none text-sm px-1 py-0.5 focus:border-blue-500';

  return (
    <tr className="bg-blue-50 border-b border-blue-200">
      {/* Checkbox */}
      <td className="w-8 px-3 py-1.5" />
      {/* Cleared dot */}
      <td className="w-6 px-1 py-1.5">
        <button onClick={() => setCleared(c => c ? 0 : 1)}>
          <div className={`w-2 h-2 rounded-full ${cleared ? 'bg-green-400' : 'bg-gray-300'}`} />
        </button>
      </td>

      {/* Account (only when showAccount) */}
      {showAccount && (
        <td className="px-2 py-1.5 min-w-[120px]">
          <select
            className="w-full bg-white border border-blue-300 rounded text-sm px-1 py-0.5 outline-none focus:border-blue-500"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
          >
            {accounts.filter(a => a.type !== 'closed').map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </td>
      )}

      {/* Date */}
      <td className="px-2 py-1.5 min-w-[110px]">
        <input
          ref={firstInputRef}
          type="date"
          className={inputCls}
          value={date}
          onChange={e => setDate(e.target.value)}
          onKeyDown={handleKey}
        />
      </td>

      {/* Payee */}
      <td className="px-2 py-1.5 min-w-[150px]">
        <input
          className={inputCls}
          placeholder={t('inline_payee_placeholder')}
          value={payee}
          onChange={e => setPayee(e.target.value)}
          onKeyDown={handleKey}
        />
      </td>

      {/* Category / Transfer */}
      <td className="px-2 py-1.5 min-w-[160px]">
        <select
          className="w-full bg-white border border-blue-300 rounded text-sm px-1 py-0.5 outline-none focus:border-blue-500"
          value={catValue}
          onChange={e => setCatValue(e.target.value)}
        >
          <option value="">{t('inline_no_category')}</option>
          {groups.map(g => (
            <optgroup key={g.id} label={g.name}>
              {categories.filter(c => c.group_id === g.id).map(c => (
                <option key={c.id} value={`c:${c.id}`}>{c.name}</option>
              ))}
            </optgroup>
          ))}
          <optgroup label={t('inline_transfer_group')}>
            {accounts
              .filter(a => a.id !== Number(accountId) && a.type !== 'closed')
              .map(a => (
                <option key={a.id} value={`t:${a.id}`}>{t('inline_transfer_to', { name: a.name })}</option>
              ))}
          </optgroup>
        </select>
      </td>

      {/* Memo */}
      <td className="px-2 py-1.5 min-w-[120px]">
        <input
          className={inputCls}
          placeholder={t('inline_memo_placeholder')}
          value={memo}
          onChange={e => setMemo(e.target.value)}
          onKeyDown={handleKey}
        />
      </td>

      {/* Outflow */}
      <td className="px-2 py-1.5 w-28">
        <input
          className={`${inputCls} text-right`}
          placeholder={t('inline_outflow_placeholder')}
          value={outflow}
          onChange={e => { setOutflow(e.target.value); if (e.target.value) setInflow(''); }}
          onBlur={() => {
            if (!outflow) return;
            const result = evalAmount(outflow);
            if (result < 0) { setOutflow(''); setInflow(fmt2(result)); }
            else { setOutflow(fmt2(result)); }
          }}
          onKeyDown={makeAmountKeyDown(v => setOutflow(v), () => setInflow(''))}
          onFocus={e => e.target.select()}
        />
      </td>

      {/* Inflow */}
      <td className="px-2 py-1.5 w-28">
        <input
          className={`${inputCls} text-right`}
          placeholder={t('inline_inflow_placeholder')}
          value={inflow}
          onChange={e => { setInflow(e.target.value); if (e.target.value) setOutflow(''); }}
          onBlur={() => {
            if (!inflow) return;
            const result = evalAmount(inflow);
            if (result < 0) { setInflow(''); setOutflow(fmt2(result)); }
            else { setInflow(fmt2(result)); }
          }}
          onKeyDown={makeAmountKeyDown(v => setInflow(v), () => setOutflow(''))}
          onFocus={e => e.target.select()}
        />
      </td>

      {/* Cleared */}
      <td className="w-8 px-1 py-1.5 text-center">
        <button onClick={() => setCleared(c => c ? 0 : 1)}>
          {cleared
            ? <Check size={14} className="text-green-500 mx-auto" />
            : <div className="w-3 h-3 rounded-full border border-gray-300 mx-auto" />
          }
        </button>
      </td>

      {/* Actions */}
      <td className="px-2 py-1.5 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            title={t('inline_save_title')}
          >
            <Check size={13} />
          </button>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200"
            title={t('inline_cancel_title')}
          >
            <X size={13} />
          </button>
          {mode === 'edit' && onDelete && (
            <button
              onClick={onDelete}
              className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
              title={t('inline_delete_title')}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
