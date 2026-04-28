'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
}

export default function MonthPickerInput({ value, onChange }: Props) {
  const { tMonthShort } = useI18n();
  const [open, setOpen] = useState(false);
  const [yearMode, setYearMode] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [selYear, selMonth] = value.split('-').map(Number);
  const [pickerYear, setPickerYear] = useState(selYear);

  // Sync picker year when value changes externally
  useEffect(() => { setPickerYear(selYear); }, [selYear]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setYearMode(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function selectMonth(m: number) {
    onChange(`${pickerYear}-${String(m).padStart(2, '0')}`);
    setOpen(false);
    setYearMode(false);
  }

  function selectYear(y: number) {
    setPickerYear(y);
    setYearMode(false);
  }

  const currentYear = new Date().getFullYear();
  const yearStart = Math.floor((pickerYear - 1) / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setPickerYear(selYear); setYearMode(false); }}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 min-w-[110px] text-left"
      >
        {tMonthShort(selMonth - 1)} {selYear}
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 z-50 bg-white rounded-xl shadow-lg ring-1 ring-gray-200 p-3 w-52">
          {/* Year navigation row */}
          <div className="flex items-center justify-between mb-2.5">
            <button
              onClick={() => yearMode ? setPickerYear(y => y - 12) : setPickerYear(y => y - 1)}
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setYearMode(m => !m)}
              className={`text-sm font-semibold px-2 py-0.5 rounded hover:bg-gray-100 transition-colors ${yearMode ? 'text-blue-600' : 'text-gray-800 hover:text-blue-600'}`}
            >
              {yearMode ? `${years[0]} – ${years[years.length - 1]}` : pickerYear}
            </button>
            <button
              onClick={() => yearMode ? setPickerYear(y => y + 12) : setPickerYear(y => y + 1)}
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {yearMode ? (
            <div className="grid grid-cols-3 gap-1">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => selectYear(y)}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    y === selYear
                      ? 'bg-blue-600 text-white'
                      : y === currentYear
                      ? 'text-blue-600 font-semibold hover:bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 12 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => selectMonth(i + 1)}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    i + 1 === selMonth && pickerYear === selYear
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tMonthShort(i)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
