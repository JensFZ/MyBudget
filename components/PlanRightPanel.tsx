'use client';

import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ChevronDown, ChevronUp, Zap, Loader2, ArrowLeft, Target, TrendingDown } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

interface BudgetEntry {
  category_id: number;
  category_name: string;
  category_color: string | null;
  group_name: string;
  assigned: number;
  activity: number;
  available: number;
  is_goal: number;
  goal_amount: number | null;
  goal_type: string | null;
}

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#14b8a6', '#3b82f6',
  '#8b5cf6', '#d946ef', '#ec4899', '#94a3b8',
];

interface MonthStats {
  assigned: number;
  spent: number;
}

interface Props {
  month: string;
  budgets: BudgetEntry[];
  readyToAssign: number;
  selectedCategory: BudgetEntry | null;
  onDeselect: () => void;
  onAssignChange: (categoryId: number, month: string, value: number) => void;
  onColorChange: (categoryId: number, color: string | null) => void;
}

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

export default function PlanRightPanel({ month, budgets, readyToAssign, selectedCategory, onDeselect, onAssignChange, onColorChange }: Props) {
  const { t, tMonthLong } = useI18n();
  const [, mm] = month.split('-');
  const monthName = tMonthLong(Number(mm) - 1);

  // History for month summary (3 months back)
  const [monthHistory, setMonthHistory] = useState<MonthStats[]>([]);
  const [monthHistoryLoading, setMonthHistoryLoading] = useState(false);

  // History for selected category
  const [catHistory, setCatHistory] = useState<{ assigned: number; activity: number }[]>([]);
  const [catHistoryLoading, setCatHistoryLoading] = useState(false);

  useEffect(() => {
    setMonthHistoryLoading(true);
    const months = [-1, -2, -3].map(d => shiftMonth(month, d));
    Promise.all(
      months.map(m => fetch(`/api/budgets?month=${m}`).then(r => r.json()).then((d: { budgets: BudgetEntry[] }) => sumStats(d.budgets)))
    ).then(setMonthHistory).catch(() => setMonthHistory([])).finally(() => setMonthHistoryLoading(false));
  }, [month]);

  useEffect(() => {
    if (!selectedCategory) return;
    setCatHistoryLoading(true);
    const months = [-1, -2, -3].map(d => shiftMonth(month, d));
    Promise.all(
      months.map(m =>
        fetch(`/api/budgets?month=${m}`).then(r => r.json()).then((d: { budgets: BudgetEntry[] }) => {
          const cat = d.budgets.find(b => b.category_id === selectedCategory.category_id);
          return { assigned: cat?.assigned ?? 0, activity: cat?.activity ?? 0 };
        })
      )
    ).then(setCatHistory).catch(() => setCatHistory([])).finally(() => setCatHistoryLoading(false));
  }, [month, selectedCategory]);

  const totalAssigned = budgets.reduce((s, b) => s + b.assigned, 0);
  const totalActivity = budgets.reduce((s, b) => s + b.activity, 0);
  const totalAvailable = budgets.reduce((s, b) => s + b.available, 0);
  const underfunded = budgets
    .filter(b => b.goal_amount && b.available < b.goal_amount)
    .reduce((s, b) => s + ((b.goal_amount ?? 0) - Math.max(0, b.available)), 0);

  const lastMonth = monthHistory[0] ?? null;
  const avgAssigned = monthHistory.length > 0 ? monthHistory.reduce((s, h) => s + h.assigned, 0) / monthHistory.length : null;
  const avgSpent = monthHistory.length > 0 ? monthHistory.reduce((s, h) => s + h.spent, 0) / monthHistory.length : null;

  function StatRow({ label, value, red, loading }: { label: string; value: number | null; red?: boolean; loading?: boolean }) {
    return (
      <div className="flex justify-between items-center">
        <span className="text-gray-500">{label}</span>
        {loading || value === null
          ? <Loader2 size={12} className="animate-spin text-gray-300" />
          : <span className={`font-medium tabular-nums ${red ? 'text-red-600' : 'text-gray-800'}`}>{fmt(value)}</span>
        }
      </div>
    );
  }

  const [autoAssignOpen, setAutoAssignOpen] = useState(false);

  const assign = useCallback((value: number) => {
    if (!selectedCategory) return;
    onAssignChange(selectedCategory.category_id, month, Math.max(0, Math.round(value * 100) / 100));
    setAutoAssignOpen(false);
  }, [selectedCategory, month, onAssignChange]);

  // ── Category detail panel ──────────────────────────────────────────────────
  if (selectedCategory) {
    const cat = selectedCategory;
    const overspent = cat.available < 0;
    const funded = cat.goal_amount != null && cat.available >= cat.goal_amount;
    const lastCat = catHistory[0] ?? null;
    const catAvgAssigned = catHistory.length > 0 ? catHistory.reduce((s, h) => s + h.assigned, 0) / catHistory.length : null;
    const catAvgSpent = catHistory.length > 0 ? catHistory.reduce((s, h) => s + Math.abs(Math.min(h.activity, 0)), 0) / catHistory.length : null;
    const toFundGoal = cat.goal_amount != null && !funded
      ? Math.max(0, cat.goal_amount - cat.available)
      : null;

    return (
      <aside className="w-72 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
        <div className="p-4">
          {/* Back button */}
          <button
            onClick={onDeselect}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 mb-4"
          >
            <ArrowLeft size={13} /> {t('panel_back_to_summary')}
          </button>

          {/* Category name */}
          <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{cat.group_name}</p>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: cat.category_color ?? '#d1d5db' }}
              />
              <h3 className="text-base font-semibold text-gray-900">{cat.category_name}</h3>
            </div>
          </div>

          {/* Color picker */}
          <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Farbe</p>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => onColorChange(cat.category_id, cat.category_color === c ? null : c)}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: cat.category_color === c ? '#1d4ed8' : 'transparent',
                    outline: cat.category_color === c ? '2px solid #bfdbfe' : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* This month stats */}
          <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_assigned_in', { month: monthName })}</span>
              <span className="font-medium tabular-nums text-gray-800">{fmt(cat.assigned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('panel_activity')}</span>
              <span className={`font-medium tabular-nums ${cat.activity < 0 ? 'text-red-600' : cat.activity > 0 ? 'text-green-600' : 'text-gray-800'}`}>
                {fmt(cat.activity)}
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-semibold text-gray-700">{t('panel_available')}</span>
              <span className={`font-bold tabular-nums ${overspent ? 'text-red-600' : funded ? 'text-green-600' : 'text-gray-900'}`}>
                {fmt(cat.available)}
              </span>
            </div>
          </div>

          {/* Goal info */}
          {cat.goal_amount != null && (
            <div className="border rounded-xl p-3 mb-4 text-sm">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                <Target size={12} /> {t('panel_goal')}
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">{t('panel_goal_target')}</span>
                <span className="font-medium tabular-nums">{fmt(cat.goal_amount)}</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div
                  className={`h-1.5 rounded-full transition-all ${funded ? 'bg-green-500' : overspent ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, Math.max(0, (cat.available / cat.goal_amount) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{funded ? t('panel_goal_funded') : t('panel_goal_remaining', { amount: fmt(Math.max(0, cat.goal_amount - cat.available)) })}</span>
                <span>{Math.round(Math.min(100, Math.max(0, (cat.available / cat.goal_amount) * 100)))}%</span>
              </div>
            </div>
          )}

          {/* Auto-Assign */}
          <div className="border-t pt-4 mb-4">
            <button
              onClick={() => setAutoAssignOpen(v => !v)}
              className="flex items-center gap-2 w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Zap size={14} />
              {t('panel_auto_assign')}
              {autoAssignOpen ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
            </button>

            {autoAssignOpen && (() => {
              const lastSpent = lastCat ? Math.abs(Math.min(lastCat.activity, 0)) : null;
              const options: { key: string; label: string; value: number | null; note?: string }[] = [
                {
                  key: 'underfunded',
                  label: t('panel_underfunded'),
                  value: toFundGoal !== null
                    ? cat.assigned + toFundGoal
                    : overspent ? cat.assigned + Math.abs(cat.available) : null,
                  note: toFundGoal !== null
                    ? `+${fmt(toFundGoal)}`
                    : overspent ? `+${fmt(Math.abs(cat.available))}` : undefined,
                },
                {
                  key: 'last_assigned',
                  label: t('panel_assigned_last_month'),
                  value: lastCat?.assigned ?? null,
                },
                {
                  key: 'last_spent',
                  label: t('panel_spent_last_month'),
                  value: lastSpent,
                },
                {
                  key: 'avg_assigned',
                  label: t('panel_average_assigned'),
                  value: catAvgAssigned,
                },
                {
                  key: 'avg_spent',
                  label: t('panel_average_spent'),
                  value: catAvgSpent,
                },
              ];

              return (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden text-sm">
                  {options.map((opt, i) => {
                    const isLast = i === options.length - 1;
                    const disabled = catHistoryLoading || opt.value === null;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => opt.value !== null && assign(opt.value)}
                        disabled={disabled}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${!isLast ? 'border-b border-gray-100' : ''} ${disabled ? 'opacity-40 cursor-default' : 'hover:bg-blue-50'}`}
                      >
                        <span className="text-gray-700">{opt.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {catHistoryLoading && opt.key !== 'underfunded'
                            ? <Loader2 size={12} className="animate-spin text-gray-300" />
                            : opt.value !== null
                              ? <>
                                  {opt.note && <span className="text-xs text-gray-400">{opt.note}</span>}
                                  <span className="font-medium tabular-nums text-blue-600">{fmt(opt.value)}</span>
                                </>
                              : <span className="text-xs text-gray-300">—</span>
                          }
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* History */}
          <div className="border-t pt-4 space-y-2.5 text-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              <TrendingDown size={12} /> {t('panel_history')}
            </div>
            <StatRow label={t('panel_assigned_last_month')} value={lastCat?.assigned ?? null} loading={catHistoryLoading} />
            <StatRow label={t('panel_spent_last_month')} value={lastCat ? Math.abs(Math.min(lastCat.activity, 0)) : null} red loading={catHistoryLoading} />
            <div className="border-t border-gray-100 pt-2.5 space-y-2.5">
              <StatRow label={t('panel_average_assigned')} value={catAvgAssigned} loading={catHistoryLoading} />
              <StatRow label={t('panel_average_spent')} value={catAvgSpent} red loading={catHistoryLoading} />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // ── Month summary panel (default) ─────────────────────────────────────────
  return (
    <aside className="w-72 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4">
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

        <div className="border-t pt-4">
          <button className="flex items-center gap-2 w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 mb-3">
            <Zap size={14} />
            {t('panel_auto_assign')}
            <ChevronDown size={14} className="ml-auto" />
          </button>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('panel_underfunded')}</span>
              <span className={`font-medium tabular-nums ${underfunded > 0 ? 'text-orange-600' : 'text-gray-800'}`}>
                {fmt(underfunded)}
              </span>
            </div>

            <div className="border-t border-gray-100 pt-2.5 space-y-2.5">
              <StatRow label={t('panel_assigned_last_month')} value={lastMonth?.assigned ?? null} loading={monthHistoryLoading} />
              <StatRow label={t('panel_spent_last_month')} value={lastMonth?.spent ?? null} red loading={monthHistoryLoading} />
            </div>

            <div className="border-t border-gray-100 pt-2.5 space-y-2.5">
              <StatRow label={t('panel_average_assigned')} value={avgAssigned} loading={monthHistoryLoading} />
              <StatRow label={t('panel_average_spent')} value={avgSpent} red loading={monthHistoryLoading} />
            </div>
          </div>

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
