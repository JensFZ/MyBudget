'use client';

import { useEffect, useState } from 'react';
import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import dynamic from 'next/dynamic';
import MonthPickerInput from '@/components/MonthPickerInput';

const Charts = dynamic(() => import('@/components/ReflectCharts'), { ssr: false });

interface StatsData {
  monthly: { month: string; income: number; spending: number }[];
  netWorth: number;
  assets: number;
  debts: number;
  loansReceived: number;
  loansGranted: number;
  ageOfMoney: number | null;
}

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;
  return { from, to };
}

export default function ReflectPage() {
  const { t } = useI18n();
  const [range, setRange] = useState(defaultRange);
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    if (range.from > range.to) return;
    setStats(null);
    fetch(`/api/stats?from=${range.from}&to=${range.to}`).then(r => r.json()).then(setStats);
  }, [range.from, range.to]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900 mr-auto">{t('reflect_title')}</h1>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500 font-medium">{t('reflect_from')}</label>
            <MonthPickerInput value={range.from} onChange={from => setRange(r => ({ ...r, from }))} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500 font-medium">{t('reflect_to')}</label>
            <MonthPickerInput value={range.to} onChange={to => setRange(r => ({ ...r, to }))} />
          </div>
        </div>
      </div>

      {!stats && <div className="p-8 text-center text-gray-400">{t('reflect_loading')}</div>}
      {stats && (
        <div className="max-w-4xl mx-auto w-full px-6 py-6 space-y-6">
          {/* Net Worth card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {/* Total (everything) */}
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('reflect_total_worth')}</p>
            <p className="text-4xl font-bold text-gray-900">{fmt(stats.netWorth + stats.loansReceived + stats.loansGranted)}</p>

            {/* Net worth without loans */}
            {(stats.loansReceived !== 0 || stats.loansGranted !== 0) && (
              <p className="text-sm text-gray-400 mt-1">
                {t('reflect_net_worth')}: <span className="font-medium text-gray-600">{fmt(stats.netWorth)}</span>
              </p>
            )}

            {/* Four tiles */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-green-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">{t('reflect_assets')}</p>
                <p className="text-base font-semibold text-green-600">{fmt(stats.assets)}</p>
              </div>
              <div className="bg-red-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">{t('reflect_debts')}</p>
                <p className="text-base font-semibold text-red-500">{fmt(stats.debts)}</p>
              </div>
              {(stats.loansReceived !== 0 || stats.loansGranted !== 0) && (<>
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-dashed border-gray-200">
                  <p className="text-xs text-gray-400 mb-0.5">{t('reflect_loans_received')}</p>
                  <p className="text-base font-semibold text-orange-500">{fmt(stats.loansReceived)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-dashed border-gray-200">
                  <p className="text-xs text-gray-400 mb-0.5">{t('reflect_loans_granted')}</p>
                  <p className="text-base font-semibold text-blue-500">{fmt(stats.loansGranted)}</p>
                </div>
              </>)}
            </div>
            {(stats.loansReceived !== 0 || stats.loansGranted !== 0) && (
              <p className="text-xs text-gray-400 mt-2">{t('reflect_loans_hint')}</p>
            )}
          </div>

          {/* Age of Money */}
          {stats.ageOfMoney !== null && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('reflect_age_of_money')}</p>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold ${
                  stats.ageOfMoney >= 30 ? 'text-green-600'
                  : stats.ageOfMoney >= 15 ? 'text-yellow-500'
                  : 'text-orange-500'
                }`}>
                  {stats.ageOfMoney}
                </span>
                <span className="text-gray-400 text-lg mb-0.5">{t('reflect_age_days')}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{t('reflect_age_desc')}</p>
            </div>
          )}

          {/* Charts */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <Charts monthly={stats.monthly} netWorth={stats.netWorth} />
          </div>
        </div>
      )}
    </div>
  );
}
