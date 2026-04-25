'use client';

import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ChevronDown, Zap } from 'lucide-react';

interface BudgetEntry {
  assigned: number;
  activity: number;
  available: number;
  goal_amount: number | null;
}

interface Props {
  month: string;
  budgets: BudgetEntry[];
  readyToAssign: number;
}

export default function PlanRightPanel({ month, budgets, readyToAssign }: Props) {
  const { t, tMonthLong } = useI18n();
  const [, mm] = month.split('-');
  const monthName = tMonthLong(Number(mm) - 1);

  const totalAssigned = budgets.reduce((s, b) => s + b.assigned, 0);
  const totalActivity = budgets.reduce((s, b) => s + b.activity, 0);
  const totalAvailable = budgets.reduce((s, b) => s + b.available, 0);

  const underfunded = budgets
    .filter(b => b.goal_amount && b.available < b.goal_amount)
    .reduce((s, b) => s + ((b.goal_amount ?? 0) - Math.max(0, b.available)), 0);

  return (
    <aside className="w-72 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4">
        {/* Summary section */}
        <div className="mb-4">
          <button className="flex items-center gap-1 text-sm font-semibold text-gray-700 mb-3">
            {t('panel_summary_title', { month: monthName })} <ChevronDown size={14} />
          </button>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_left_over')}</span>
              <span className="font-medium text-gray-800">{fmt(readyToAssign + totalAssigned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_assigned_in', { month: monthName })}</span>
              <span className="font-medium text-gray-800">{fmt(totalAssigned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_activity')}</span>
              <span className={`font-medium ${totalActivity < 0 ? 'text-red-600' : 'text-gray-800'}`}>{fmt(totalActivity)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-semibold text-gray-700">{t('panel_available')}</span>
              <span className="font-bold text-gray-900">{fmt(totalAvailable)}</span>
            </div>
          </div>
        </div>

        {/* Cost to be me */}
        <div className="border-t pt-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('panel_cost_to_be_me')}</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('panel_targets', { month: monthName })}</span>
            <span className="font-medium text-gray-800">{fmt(underfunded)}</span>
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
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_underfunded')}</span>
              <span className="font-medium text-gray-800">{fmt(underfunded)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_assigned_last_month')}</span>
              <span className="font-medium text-gray-800">{fmt(totalAssigned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_spent_last_month')}</span>
              <span className="font-medium text-red-600">{fmt(Math.abs(Math.min(totalActivity, 0)))}</span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <button className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100">
              <span>{t('panel_reduce_overfunding')}</span>
              <span className="font-medium">{fmt(0)}</span>
            </button>
            <button className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100">
              <span>{t('panel_reset_available')}</span>
              <span className="font-medium">{fmt(0)}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
