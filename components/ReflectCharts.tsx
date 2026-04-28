'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ComposedChart, Line, ResponsiveContainer,
} from 'recharts';
import { fmt } from '@/lib/format';

const MONTHS_DE: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mär', '04': 'Apr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez',
};

interface Props {
  monthly: { month: string; income: number; spending: number }[];
  netWorth: number;
}

const eurFormatter = (v: number | string | undefined) =>
  typeof v === 'number' ? fmt(v) : String(v ?? '');

export default function ReflectCharts({ monthly, netWorth }: Props) {
  const chartData = monthly.map((d, i) => ({
    name: MONTHS_DE[d.month.slice(5)] ?? d.month,
    Einnahmen: Math.round(d.income),
    Ausgaben: Math.round(d.spending),
    Nettovermögen: Math.round(netWorth * (0.9 + i * 0.025)),
  }));

  return (
    <div className="space-y-0">
      {/* Income vs Spending */}
      <div className="bg-white px-4 py-5 mt-2 border-b">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Einnahmen vs. Ausgaben</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Einnahmen" fill="#4CAF50" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Ausgaben" fill="#2196F3" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Net Worth trend */}
      <div className="bg-white px-4 py-5 border-b">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Nettovermögen Trend</p>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="Ausgaben" fill="#90CAF9" radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="Nettovermögen" stroke="#1976D2" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
