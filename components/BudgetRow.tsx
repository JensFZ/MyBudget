'use client';

import { fmt } from '@/lib/format';
import { useState, useEffect, useRef } from 'react';
import { Clock, CheckCircle2, Archive, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface BudgetRowProps {
  categoryId: number;
  name: string;
  color?: string | null;
  assigned: number;
  activity: number;
  available: number;
  isGoal: boolean;
  goalAmount: number | null;
  goalType: string | null;
  month: string;
  isSelected?: boolean;
  onSelect?: () => void;
  onAssignChange: (categoryId: number, month: string, value: number) => void;
  onArchive?: () => void;
  onDelete?: () => void;
  isArchived?: boolean;
  onRestore?: () => void;
  onRename?: (newName: string) => void;
}

export default function BudgetRow({
  categoryId, name, color, assigned, activity, available,
  isGoal, goalAmount, goalType, month,
  isSelected, onSelect, onAssignChange, onArchive, onDelete, isArchived, onRestore, onRename,
}: BudgetRowProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [renamingName, setRenamingName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [editVal, setEditVal] = useState((Number(assigned) || 0).toFixed(2).replace('.', ','));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setEditVal((Number(assigned) || 0).toFixed(2).replace('.', ','));
  }, [assigned, editing]);

  const overspent = available < 0;
  const funded = goalAmount != null && available >= goalAmount;
  const neededEventually = isGoal && goalType === 'eventual' && !funded;

  function handleBlur() {
    setEditing(false);
    const numeric = parseFloat(editVal.replace(',', '.'));
    if (!isNaN(numeric) && numeric !== assigned) onAssignChange(categoryId, month, numeric);
  }

  function handleAssignClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditVal((Number(assigned) || 0).toFixed(2).replace('.', ','));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  const availableBadge = () => {
    if (overspent) return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: 'var(--badge-red)', color: 'var(--badge-red-text)' }}>
        {fmt(available)}
      </span>
    );
    if (funded) return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: 'var(--badge-green)', color: 'var(--badge-green-text)' }}>
        <CheckCircle2 size={11} /> {fmt(available)}
      </span>
    );
    if (neededEventually) return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
        <Clock size={11} /> {fmt(available)}
      </span>
    );
    if (available > 0) return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: 'var(--badge-green)', color: 'var(--badge-green-text)' }}>
        {fmt(available)}
      </span>
    );
    return <span className="text-sm text-gray-400">{fmt(available)}</span>;
  };

  const sub = (() => {
    if (overspent) return t('budget_overspent_sub', { abs: fmt(Math.abs(available)), assigned: fmt(assigned) });
    if (funded) return t('budget_funded');
    if (neededEventually && goalAmount) return t('budget_needed_eventually', { amount: fmt(goalAmount - Math.max(0, available)) });
    return null;
  })();

  return (
    <tr
      className={`border-b border-gray-100 cursor-pointer group transition-colors ${isArchived ? 'bg-amber-50 opacity-60' : isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      onClick={onSelect}
    >
      {/* Selection indicator */}
      <td className="w-8 px-3 py-2">
        <div className={`w-1.5 h-6 rounded-full mx-auto transition-colors ${isSelected ? 'bg-blue-500' : 'bg-transparent group-hover:bg-gray-200'}`} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color ?? '#d1d5db' }}
          />
          {renaming ? (
            <input
              autoFocus
              className="text-sm flex-1 border-b border-blue-400 bg-transparent outline-none px-0.5"
              value={renamingName}
              onChange={e => setRenamingName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); const v = renamingName.trim(); setRenaming(false); if (v && v !== name) onRename?.(v); }
                if (e.key === 'Escape') setRenaming(false);
              }}
              onBlur={() => { const v = renamingName.trim(); setRenaming(false); if (v && v !== name) onRename?.(v); }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div className={`text-sm flex-1 ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-800'}`}>{name}</div>
          )}
          <div className="flex items-center gap-0.5 ml-1">
            {isArchived && onRestore ? (
              <button
                onClick={e => { e.stopPropagation(); onRestore(); }}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-amber-700 bg-amber-100 hover:bg-amber-200 rounded"
              >
                <RotateCcw size={11} /> {t('plan_restore')}
              </button>
            ) : (
              <>
                {onRename && (
                  <button
                    onClick={e => { e.stopPropagation(); setRenamingName(name); setRenaming(true); }}
                    className="p-0.5 text-gray-400 hover:text-blue-500 rounded"
                    title={t('plan_rename')}
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {onArchive && (
                  <button
                    onClick={e => { e.stopPropagation(); onArchive(); }}
                    className="p-0.5 text-gray-400 hover:text-amber-500 rounded"
                    title={t('plan_archive')}
                  >
                    <Archive size={12} />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    className="p-0.5 text-gray-400 hover:text-red-500 rounded"
                    title={t('plan_delete')}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
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
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={handleAssignClick}
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
