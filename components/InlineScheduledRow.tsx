'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
import { Check, X, Trash2, RefreshCw, CalendarCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { fmt, fmt2, evalAmount } from '@/lib/format';
import type { Account, Category, CategoryGroup } from './InlineTransactionRow';

export interface ScheduledTransaction {
  id: number;
  account_id: number;
  account_name: string;
  category_id: number | null;
  category_name: string | null;
  payee: string | null;
  memo: string | null;
  amount: number;
  frequency: string;
  next_date: string;
}

export interface ScheduledUpdateData {
  account_id?: number;
  category_id?: number | null;
  payee?: string | null;
  memo?: string | null;
  amount?: number;
  frequency?: string;
  next_date?: string;
}

interface Props {
  scheduled: ScheduledTransaction;
  showAccount: boolean;
  accounts: Account[];
  categories: Category[];
  groups: CategoryGroup[];
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onBook: (id: number, date: string) => Promise<void>;
  onSave: (id: number, data: ScheduledUpdateData) => Promise<void>;
  onDelete: (id: number) => void;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

function parseCategoryValue(val: string): { category_id: number | null; transfer_account_id: number | null } {
  if (val.startsWith('c:')) return { category_id: Number(val.slice(2)), transfer_account_id: null };
  return { category_id: null, transfer_account_id: null };
}

function toCategoryValue(category_id: number | null): string {
  if (category_id) return `c:${category_id}`;
  return '';
}

export default function InlineScheduledRow({
  scheduled,
  showAccount,
  accounts,
  categories,
  groups,
  isEditing,
  onEdit,
  onCancelEdit,
  onBook,
  onSave,
  onDelete,
}: Props) {
  const { t } = useI18n();
  const [date, setDate] = useState(scheduled.next_date);
  const [payee, setPayee] = useState(scheduled.payee ?? '');
  const [catValue, setCatValue] = useState(toCategoryValue(scheduled.category_id));
  const [memo, setMemo] = useState(scheduled.memo ?? '');
  const [outflow, setOutflow] = useState(scheduled.amount < 0 ? Math.abs(scheduled.amount).toFixed(2).replace('.', ',') : '');
  const [inflow, setInflow] = useState(scheduled.amount > 0 ? scheduled.amount.toFixed(2).replace('.', ',') : '');
  const [frequency, setFrequency] = useState(scheduled.frequency);
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) firstInputRef.current?.focus();
  }, [isEditing]);

  // Reset form when scheduled transaction changes
  useEffect(() => {
    setDate(scheduled.next_date);
    setPayee(scheduled.payee ?? '');
    setCatValue(toCategoryValue(scheduled.category_id));
    setMemo(scheduled.memo ?? '');
    setOutflow(scheduled.amount < 0 ? Math.abs(scheduled.amount).toFixed(2).replace('.', ',') : '');
    setInflow(scheduled.amount > 0 ? scheduled.amount.toFixed(2).replace('.', ',') : '');
    setFrequency(scheduled.frequency);
  }, [scheduled]);

  function getAmount() {
    const outNum = outflow ? evalAmount(outflow) : 0;
    const inNum = inflow ? evalAmount(inflow) : 0;
    return inflow !== '' ? inNum : outflow !== '' ? -outNum : 0;
  }

  async function handleSave() {
    const amount = getAmount();
    const { category_id } = parseCategoryValue(catValue);
    setSaving(true);
    try {
      await onSave(scheduled.id, {
        account_id: scheduled.account_id,
        category_id,
        payee: payee || null,
        memo: memo || null,
        amount,
        frequency,
        next_date: date,
      });
      onCancelEdit();
    } finally {
      setSaving(false);
    }
  }

  async function handleBook() {
    setSaving(true);
    try {
      await onBook(scheduled.id, date);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full bg-transparent border-b border-amber-300 outline-none text-sm px-1 py-0.5 focus:border-amber-500';
  const colSpan = showAccount ? 10 : 9;

  if (!isEditing) {
    const isOutflow = scheduled.amount < 0;
    const catName = scheduled.category_name;
    const cat = categories.find(c => c.id === scheduled.category_id);

    return (
      <tr
        className="border-b border-gray-100 opacity-60 italic cursor-pointer hover:opacity-80 hover:bg-amber-50"
        onClick={onEdit}
        title={t('tx_scheduled_edit_hint')}
      >
        <td className="w-8 px-3 py-1.5" />
        <td className="w-6 px-1 py-1.5">
          <RefreshCw size={11} className="text-amber-400 mx-auto" />
        </td>
        {showAccount && (
          <td className="px-3 py-1.5 text-gray-500 text-xs whitespace-nowrap">{scheduled.account_name}</td>
        )}
        <td className="px-3 py-1.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(scheduled.next_date)}</td>
        <td className="px-3 py-1.5 text-gray-600 text-xs">{scheduled.payee ?? '—'}</td>
        <td className="px-3 py-1.5 text-xs">
          {catName ? (
            <span className="flex items-center gap-1.5">
              {cat?.color && <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: cat.color }} />}
              <span className="text-gray-500">{catName}</span>
            </span>
          ) : (
            <span className="text-gray-400">{t('inline_no_category')}</span>
          )}
        </td>
        <td className="px-3 py-1.5 text-gray-400 text-xs">{scheduled.memo ?? ''}</td>
        <td className="px-3 py-1.5 text-right w-28 text-xs">
          {isOutflow && <span className="text-red-400 font-medium">{fmt(Math.abs(scheduled.amount))}</span>}
        </td>
        <td className="px-3 py-1.5 text-right w-28 text-xs">
          {!isOutflow && scheduled.amount > 0 && <span className="text-green-500 font-medium">{fmt(scheduled.amount)}</span>}
        </td>
        <td className="w-8 px-3 py-1.5" />
        <td className="w-20 px-2 py-1.5 text-right" onClick={e => e.stopPropagation()}>
          <button
            onClick={async e => { e.stopPropagation(); setSaving(true); try { await onBook(scheduled.id, scheduled.next_date); } finally { setSaving(false); } }}
            disabled={saving}
            className="p-1 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded disabled:opacity-40"
            title={t('tx_book_now')}
          >
            <CalendarCheck size={14} />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <Fragment>
      <tr className="bg-amber-50">
        <td className="w-8 px-3 py-1.5" />
        <td className="w-6 px-1 py-1.5">
          <RefreshCw size={11} className="text-amber-400 mx-auto" />
        </td>
        {showAccount && (
          <td className="px-2 py-1.5 min-w-[120px]">
            <span className="text-xs text-gray-500">{scheduled.account_name}</span>
          </td>
        )}
        <td className="px-2 py-1.5 min-w-[110px]">
          <input
            ref={firstInputRef}
            type="date"
            className={inputCls}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </td>
        <td className="px-2 py-1.5 min-w-[150px]">
          <input
            className={inputCls}
            placeholder={t('inline_payee_placeholder')}
            value={payee}
            onChange={e => setPayee(e.target.value)}
          />
        </td>
        <td className="px-2 py-1.5 min-w-[160px]">
          <select
            className="w-full bg-white border border-amber-300 rounded text-sm px-1 py-0.5 outline-none focus:border-amber-500"
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
          </select>
        </td>
        <td className="px-2 py-1.5 min-w-[120px]">
          <input
            className={inputCls}
            placeholder={t('inline_memo_placeholder')}
            value={memo}
            onChange={e => setMemo(e.target.value)}
          />
        </td>
        <td className="px-2 py-1.5 w-28">
          <input
            className={`${inputCls} text-right`}
            placeholder={t('inline_outflow_placeholder')}
            value={outflow}
            onChange={e => { setOutflow(e.target.value); if (e.target.value) setInflow(''); }}
            onBlur={() => { if (outflow) { const r = evalAmount(outflow); if (r < 0) { setOutflow(''); setInflow(fmt2(r)); } else setOutflow(fmt2(r)); } }}
            onFocus={e => e.target.select()}
          />
        </td>
        <td className="px-2 py-1.5 w-28">
          <input
            className={`${inputCls} text-right`}
            placeholder={t('inline_inflow_placeholder')}
            value={inflow}
            onChange={e => { setInflow(e.target.value); if (e.target.value) setOutflow(''); }}
            onBlur={() => { if (inflow) { const r = evalAmount(inflow); if (r < 0) { setInflow(''); setOutflow(fmt2(r)); } else setInflow(fmt2(r)); } }}
            onFocus={e => e.target.select()}
          />
        </td>
        <td className="w-8 px-1 py-1.5" />
        <td className="px-2 py-1.5 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <button
              onClick={handleBook}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 disabled:opacity-50"
              title={t('tx_book_now')}
            >
              <CalendarCheck size={12} /> {t('tx_book_now')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
              title={t('tx_scheduled_save_template')}
            >
              <Check size={13} />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200"
            >
              <X size={13} />
            </button>
            <button
              onClick={() => onDelete(scheduled.id)}
              className="p-1 text-red-300 hover:text-red-500 rounded hover:bg-red-50"
              title={t('inline_delete_title')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
      <tr className="bg-amber-50 border-b border-amber-200">
        <td colSpan={colSpan} className="px-3 pb-2 pt-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{t('inline_frequency_label')}</span>
            <select
              className="text-xs bg-white border border-amber-200 rounded px-1.5 py-0.5 outline-none focus:border-amber-400 text-gray-700"
              value={frequency}
              onChange={e => setFrequency(e.target.value)}
            >
              <option value="daily">{t('recurring_daily')}</option>
              <option value="weekly">{t('recurring_weekly')}</option>
              <option value="every_other_week">{t('recurring_every_other_week')}</option>
              <option value="twice_a_month">{t('recurring_twice_a_month')}</option>
              <option value="every_4_weeks">{t('recurring_every_4_weeks')}</option>
              <option value="monthly">{t('recurring_monthly')}</option>
              <option value="every_other_month">{t('recurring_every_other_month')}</option>
              <option value="every_3_months">{t('recurring_every_3_months')}</option>
              <option value="every_4_months">{t('recurring_every_4_months')}</option>
              <option value="twice_a_year">{t('recurring_twice_a_year')}</option>
              <option value="yearly">{t('recurring_yearly')}</option>
              <option value="every_other_year">{t('recurring_every_other_year')}</option>
            </select>
          </div>
        </td>
      </tr>
    </Fragment>
  );
}
