'use client';

import { useState, useEffect, useRef } from 'react';

export interface PayeeSuggestion {
  payee: string;
  last_category_id: number | null;
  last_category_name: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelectPayee: (payee: string, categoryId: number | null) => void;
  className?: string;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function PayeeInput({ value, onChange, onSelectPayee, className, placeholder, onKeyDown }: Props) {
  const [suggestions, setSuggestions] = useState<PayeeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/payees').then(r => r.json()).then(setSuggestions).catch(() => {});
  }, []);

  const filtered = value.trim().length > 0
    ? suggestions.filter(s => s.payee.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => { setFocusedIdx(-1); }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function select(s: PayeeSuggestion) {
    onSelectPayee(s.payee, s.last_category_id);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx(i => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx(i => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Enter' && focusedIdx >= 0) {
        e.preventDefault();
        select(filtered[focusedIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    onKeyDown?.(e);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        className={className}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (filtered.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 top-full mt-0.5 min-w-[220px] bg-white border border-gray-200 rounded shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((s, i) => (
            <li
              key={s.payee}
              className={`px-3 py-1.5 cursor-pointer select-none ${i === focusedIdx ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50 text-gray-800'}`}
              onMouseDown={e => { e.preventDefault(); select(s); }}
              onMouseEnter={() => setFocusedIdx(i)}
            >
              <div className="text-sm leading-tight">{s.payee}</div>
              {s.last_category_name && (
                <div className="text-xs text-gray-400 leading-tight">{s.last_category_name}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
