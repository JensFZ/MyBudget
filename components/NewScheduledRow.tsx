'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
import { Check, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { fmt2, evalAmount, localToday } from '@/lib/format';
import PayeeInput from '@/components/PayeeInput';
import type { Account, Category, CategoryGroup } from './InlineTransactionRow';

export interface NewScheduledData {
  account_id: number;
  category_id: number | null;
  payee: string | null;
  memo: string | null;
  amount: number;
  frequency: string;
  next_date: string;
}

interface Props {
  showAccount: boolean;
  accounts: Account[];
  categories: Category[];
  groups: CategoryGroup[];
  defaultAccountId?: number;
  onCreate: (data: NewScheduledData) => Promise<void>;
  onCancel: () => void;
}

const today = localToday();

export default function NewScheduledRow({ showAccount, accounts, categories, groups, defaultAccountId, onCreate, onCancel }: Props) {
  const { t } = useI18n();
  const [accountId, setAccountId] = useState(String(defaultAccountId ?? accounts[0]?.id ?? ''));
  const [date, setDate] = useState(today);
  const [payee, setPayee] = useState('');
  const [catValue, setCatValue] = useState('income:');
  const [memo, setMemo] = useState('');
  const [outflow, setOutflow] = useState('');
  const [inflow, setInflow] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [saving, setSaving] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  function parseCat(val: string): number | null {
    if (val.startsWith('c:')) return Number(val.slice(2));
    return null;
  }

  async function handleSave() {
    const outNum = outflow ? evalAmount(outflow) : 0;
    const inNum  = inflow  ? evalAmount(inflow)  : 0;
    const amount = inflow !== '' ? inNum : outflow !== '' ? -outNum : 0;
    if (amount === 0 || frequency === 'never') return;

    setSaving(true);
    try {
      await onCreate({
        account_id: Number(accountId),
        category_id: parseCat(catValue),
        payee: payee || null,
        memo: memo || null,
        amount,
        frequency,
        next_date: date,
      });
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full bg-transparent border-b border-green-300 outline-none text-sm px-1 py-0.5 focus:border-green-500';
  const colSpan = showAccount ? 10 : 9;

  return (
    <Fragment>
      <tr className="bg-green-50">
        <td className="w-8 px-3 py-1.5" />
        <td className="w-6 px-1 py-1.5" />
        {showAccount && (
          <td className="px-2 py-1.5 min-w-[120px]">
            <select
              className="w-full bg-white border border-green-300 rounded text-sm px-1 py-0.5 outline-none"
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
            >
              {accounts.filter(a => a.type !== 'closed').map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </td>
        )}
        <td className="px-2 py-1.5 min-w-[110px]">
          <input
            ref={firstRef}
            type="date"
            className={inputCls}
            value={date}
            onChange={e => setDate(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') handleSave(); }}
          />
        </td>
        <td className="px-2 py-1.5 min-w-[150px]">
          <PayeeInput
            className={inputCls}
            placeholder={t('inline_payee_placeholder')}
            value={payee}
            onChange={setPayee}
            onSelectPayee={(p, catId) => { setPayee(p); if (catId) setCatValue(`c:${catId}`); }}
            onKeyDown={e => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') handleSave(); }}
          />
        </td>
        <td className="px-2 py-1.5 min-w-[160px]">
          <select
            className="w-full bg-white border border-green-300 rounded text-sm px-1 py-0.5 outline-none"
            value={catValue}
            onChange={e => setCatValue(e.target.value)}
          >
            <option value="income:">{t('tx_income_label')}</option>
            <option value="">{t('inline_no_category')}</option>
            {groups.map(g => {
              const cats = categories.filter(c => c.group_id === g.id);
              if (cats.length === 0) return null;
              return (
                <optgroup key={g.id} label={g.name}>
                  {cats.map(c => (
                    <option key={c.id} value={`c:${c.id}`}>{c.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </td>
        <td className="px-2 py-1.5 min-w-[120px]">
          <input
            className={inputCls}
            placeholder={t('inline_memo_placeholder')}
            value={memo}
            onChange={e => setMemo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') handleSave(); }}
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
            onKeyDown={e => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') handleSave(); }}
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
            onKeyDown={e => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') handleSave(); }}
          />
        </td>
        <td className="w-8 px-1 py-1.5" />
        <td className="px-2 py-1.5 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              title={t('sched_create')}
            >
              <Check size={13} />
            </button>
            <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200">
              <X size={13} />
            </button>
          </div>
        </td>
      </tr>
      <tr className="bg-green-50 border-b border-green-200">
        <td colSpan={colSpan} className="px-3 pb-2 pt-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{t('inline_frequency_label')}</span>
            <select
              className="text-xs bg-white border border-green-200 rounded px-1.5 py-0.5 outline-none focus:border-green-400 text-gray-700"
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
            <span className="text-xs text-gray-400">{t('sched_first_occurrence_hint')}</span>
          </div>
        </td>
      </tr>
    </Fragment>
  );
}
