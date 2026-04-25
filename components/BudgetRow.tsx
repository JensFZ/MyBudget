'use client';

import { fmt } from '@/lib/format';
import { useState, useEffect, useRef } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface BudgetRowProps {
  categoryId: number;
  name: string;
  assigned: number;
  activity: number;
  available: number;
  isGoal: boolean;
  goalAmount: number | null;
  goalType: string | null;
  month: string;
  onAssignChange: (categoryId: number, month: string, value: number) => void;
}

export default function BudgetRow({
  categoryId,
  name,
  assigned,
  activity,
  available,
  isGoal,
  goalAmount,
  goalType,
  month,
  onAssignChange,
}: BudgetRowProps) {
  const { t } = useI18n();
  const num = Number(assigned) || 0;
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(num.toFixed(2).replace('.', ','));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setEditVal((Number(assigned) || 0).toFixed(2).replace('.', ','));
    }
  }, [assigned, editing]);

  const overspent = available < 0;
  const funded = goalAmount ? available >= goalAmount : false;
  const neededEventually = isGoal && goalType === 'eventual' && !funded;

  function handleBlur() {
    setEditing(false);
    const numeric = parseFloat(editVal.replace(',', '.'));
    if (!isNaN(numeric) && numeric !== assigned) {
      onAssignChange(categoryId, month, numeric);
    }
  }

  function handleFocus() {
    const formatted = (Number(assigned) || 0).toFixed(2).replace('.', ',');
    setEditVal(formatted);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  const availableBadge = () => {
    if (overspent) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: 'var(--badge-red)', color: 'var(--badge-red-text)' }}>
          {fmt(available)}
        </span>
      );
    }
    if (funded) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: 'var(--badge-green)', color: 'var(--badge-green-text)' }}>
          <CheckCircle2 size={11} /> {fmt(available)}
        </span>
      );
    }
    if (neededEventually) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
          <Clock size={11} /> {fmt(available)}
        </span>
      );
    }
    if (available > 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: 'var(--badge-green)', color: 'var(--badge-green-text)' }}>
          {fmt(available)}
        </span>
      );
    }
    return <span className="text-sm text-gray-400">{fmt(available)}</span>;
  };

  const subtext = () => {
    if (overspent) return t('budget_overspent_sub', { abs: fmt(Math.abs(available)), assigned: fmt(assigned) });
    if (funded) return t('budget_funded');
    if (neededEventually && goalAmount) return t('budget_needed_eventually', { amount: fmt(goalAmount - Math.max(0, available)) });
    return null;
  };

  const sub = subtext();

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 group">
      <td className="w-8 px-3 py-2">
        <input type="checkbox" className="rounded border-gray-300" />
      </td>
      <td className="px-3 py-2">
        <div className="text-sm text-gray-800">{name}</div>
        {sub && (
          <div className={`text-xs mt-0.5 ${overspent ? 'text-red-500' : funded ? 'text-green-600' : 'text-orange-500'}`}>
            {sub}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right w-36">
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            className="text-sm text-right w-28 border border-blue-400 rounded px-2 py-0.5 outline-none"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={e => { if (e.key === 'Enter') handleBlur(); if (e.key === 'Escape') setEditing(false); }}
          />
        ) : (
          <button
            onClick={handleFocus}
            className="text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded w-full text-right"
          >
            {fmt(assigned)}
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-right w-36">
        <span className={`text-sm ${activity < 0 ? 'text-red-600' : activity > 0 ? 'text-green-600' : 'text-gray-400'}`}>
          {activity !== 0 ? fmt(activity) : ''}
        </span>
      </td>
      <td className="px-3 py-2 text-right w-36">
        {availableBadge()}
      </td>
    </tr>
  );
}
