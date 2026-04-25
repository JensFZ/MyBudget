'use client';

import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ChevronDown, Zap, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BudgetEntry {
  assigned: number;
  activity: number;
  available: number;
  goal_amount: number | null;
}

interface MonthStats {
  assigned: number;
  spent: number; // absolute value of negative activity
}

interface Props {
  month: string;
  budgets: BudgetEntry[];
  readyToAssign: number;
}

/** Returns YYYY-MM shifted by `delta` months (negative = past) */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function sumStats(budgets: BudgetEntry[]): MonthStats {
  return {
    assigned: budgets.reduce((s, b) => s + b.assigned, 0),
    spent: budgets.reduce((s, b) => s + Math.abs(Math.min(b.activity, 0)), 0),
  };
}

export default function PlanRightPanel({ month, budgets, readyToAssign }: Props) {
  const { t, tMonthLong } = useI18n();
  const [, mm] = month.split('-');
  const monthName = tMonthLong(Number(mm) - 1);

  // Historical data for last 3 months before current
  const [history, setHistory] = useState<MonthStats[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const months = [-1, -2, -3].map(d => shiftMonth(month, d));
    Promise.all(
      months.map(m => fetch(`/api/budgets?month=${m}`).then(r => r.json()).then((d: { budgets: BudgetEntry[] }) => sumStats(d.budgets)))
    ).then(results => {
      setHistory(results);
    }).catch(() => {
      setHistory([]);
    }).finally(() => setLoading(false));
  }, [month]);

  // Current month totals
  const totalAssigned = budgets.reduce((s, b) => s + b.assigned, 0);
  const totalActivity = budgets.reduce((s, b) => s + b.activity, 0);
  const totalAvailable = budgets.reduce((s, b) => s + b.available, 0);

  // Underfunded: sum of shortfall for categories below their goal
  const underfunded = budgets
    .filter(b => b.goal_amount && b.available < b.goal_amount)
    .reduce((s, b) => s + ((b.goal_amount ?? 0) - Math.max(0, b.available)), 0);

  // Previous month (index 0 = last month)
  const lastMonth = history[0] ?? null;

  // Averages over last 3 months (only months that have data)
  const avgAssigned = history.length > 0
    ? history.reduce((s, h) => s + h.assigned, 0) / history.length
    : null;
  const avgSpent = history.length > 0
    ? history.reduce((s, h) => s + h.spent, 0) / history.length
    : null;

  function StatRow({ label, value, red }: { label: string; value: number | null; red?: boolean }) {
    return (
      <div className="flex justify-between items-center">
        <span className="text-gray-500">{label}</span>
        {loading || value === null
          ? <Loader2 size={12} className="animate-spin text-gray-300" />
          : <span className={`font-medium tabular-nums ${red ? 'text-red-600' : 'text-gray-800'}`}>
              {fmt(value)}
            </span>
        }
      </div>
    );
  }

  return (
    <aside className="w-72 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4">

        {/* Monthly Summary */}
        <div className="mb-4">
          <button className="flex items-center gap-1 text-sm font-semibold text-gray-700 mb-3">
            {t('panel_summary_title', { month: monthName })} <ChevronDown size={14} />
          </button>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_left_over')}</span>
              <span className="font-medium tabular-nums text-gray-800">{fmt(readyToAssign + totalAssigned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_assigned_in', { month: monthName })}</span>
              <span className="font-medium tabular-nums text-gray-800">{fmt(totalAssigned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_activity')}</span>
              <span className={`font-medium tabular-nums ${totalActivity < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                {fmt(totalActivity)}
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-semibold text-gray-700">{t('panel_available')}</span>
              <span className="font-bold tabular-nums text-gray-900">{fmt(totalAvailable)}</span>
            </div>
          </div>
        </div>

        {/* Cost to Be Me */}
        <div className="border-t pt-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t('panel_cost_to_be_me')}
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('panel_targets', { month: monthName })}</span>
            <span className="font-medium tabular-nums text-gray-800">{fmt(underfunded)}</span>
          </div>
          <button className="mt-3 w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">
            <span>{t('panel_enter_income')}</span>
            <span>→</span>
          </button>
        </div>

        {/* Auto-Assign */}
        <div className="border-t pt-4">
          <button className="flex items-center gap-2 w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 mb-3">
            <Zap size={14} />
            {t('panel_auto_assign')}
            <ChevronDown size={14} className="ml-auto" />
          </button>

          <div className="space-y-2.5 text-sm">
            {/* Underfunded */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('panel_underfunded')}</span>
              <span className={`font-medium tabular-nums ${underfunded > 0 ? 'text-orange-600' : 'text-gray-800'}`}>
                {fmt(underfunded)}
              </span>
            </div>

            <div className="border-t border-gray-100 pt-2.5 space-y-2.5">
              {/* Assigned Last Month */}
              <StatRow
                label={t('panel_assigned_last_month')}
                value={lastMonth?.assigned ?? null}
              />
              {/* Spent Last Month */}
              <StatRow
                label={t('panel_spent_last_month')}
                value={lastMonth?.spent ?? null}
                red
              />
            </div>

            <div className="border-t border-gray-100 pt-2.5 space-y-2.5">
              {/* Average Assigned (3 months) */}
              <StatRow
                label={t('panel_average_assigned')}
                value={avgAssigned}
              />
              {/* Average Spent (3 months) */}
              <StatRow
                label={t('panel_average_spent')}
                value={avgSpent}
                red
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 space-y-2">
            <button className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100">
              <span>{t('panel_reduce_overfunding')}</span>
              <span className="font-medium tabular-nums">{fmt(0)}</span>
            </button>
            <button className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100">
              <span>{t('panel_reset_available')}</span>
              <span className="font-medium tabular-nums">{fmt(0)}</span>
            </button>
          </div>
        </div>

      </div>
    </aside>
  );
}
