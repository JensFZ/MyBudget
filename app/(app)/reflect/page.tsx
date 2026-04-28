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
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('reflect_net_worth')}</p>
            <p className="text-4xl font-bold text-gray-900">{fmt(stats.netWorth)}</p>
            <div className="flex gap-8 mt-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">{t('reflect_assets')}</p>
                <p className="text-lg font-semibold text-green-600">{fmt(stats.assets)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">{t('reflect_debts')}</p>
                <p className="text-lg font-semibold text-red-500">{fmt(stats.debts)}</p>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <Charts monthly={stats.monthly} netWorth={stats.netWorth} />
          </div>
        </div>
      )}
    </div>
  );
}
