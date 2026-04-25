'use client';

import { useEffect, useState } from 'react';
import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import dynamic from 'next/dynamic';

const Charts = dynamic(() => import('@/components/ReflectCharts'), { ssr: false });

interface StatsData {
  monthly: { month: string; income: number; spending: number }[];
  netWorth: number;
  assets: number;
  debts: number;
  ageOfMoney: number;
}

export default function ReflectPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch('/api/stats?from=2025-12&to=2026-04').then(r => r.json()).then(setStats);
  }, []);

  if (!stats) return <div className="p-8 text-center text-gray-400">{t('reflect_loading')}</div>;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold text-gray-900">{t('reflect_title')}</h1>
      </div>

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

        {/* Age of Money */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('reflect_age_of_money')}</p>
          <p className="text-4xl font-bold text-gray-900">
            {stats.ageOfMoney}{' '}
            <span className="text-xl font-normal text-gray-400">{t('reflect_age_days')}</span>
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {t('reflect_age_desc')}
          </p>
        </div>

        {/* Charts */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <Charts monthly={stats.monthly} netWorth={stats.netWorth} ageOfMoney={stats.ageOfMoney} />
        </div>
      </div>
    </div>
  );
}
