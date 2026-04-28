'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ChevronDown, ChevronRight, Plus, X, HelpCircle, RotateCcw, RotateCw, Archive, Trash2, Pencil } from 'lucide-react';
import BudgetRow from '@/components/BudgetRow';
import PlanRightPanel from '@/components/PlanRightPanel';

interface BudgetEntry {
  category_id: number;
  category_name: string;
  category_color: string | null;
  group_id: number;
  group_name: string;
  group_sort: number;
  assigned: number;
  activity: number;
  available: number;
  is_goal: number;
  is_hidden: number;
  goal_amount: number | null;
  goal_type: string | null;
  goal_date: string | null;
}

interface GroupMeta {
  id: number;
  name: string;
  sort_order: number;
  is_hidden: number;
}

interface BudgetData {
  budgets: BudgetEntry[];
  allGroups: GroupMeta[];
  readyToAssign: number;
  month: string;
}

type FilterType = 'all' | 'overspent' | 'underfunded' | 'overfunded' | 'available';

export default function PlanPage() {
  const { t, tMonthShort, tMonthLong } = useI18n();
  const [data, setData] = useState<BudgetData | null>(null);
  const [month, setMonth] = useState('2026-04');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Inline add category state
  const [addingCategoryToGroup, setAddingCategoryToGroup] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Inline add group state
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const [showArchived, setShowArchived] = useState(false);
  const [renamingGroupId, setRenamingGroupId] = useState<number | null>(null);
  const [renamingGroupName, setRenamingGroupName] = useState('');


  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/budgets?month=${month}${showArchived ? '&includeHidden=true' : ''}`);
      setData(await res.json());
    } catch (e) {
      console.error('Plan load failed:', e);
    }
  }, [month, showArchived]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showMonthPicker) return;
    function handleClick(e: MouseEvent) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setShowMonthPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMonthPicker]);

  async function handleAssignChange(categoryId: number, month: string, value: number) {
    await fetch('/api/budgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, month, assigned: value }),
    });
    load();
  }

  async function handleColorChange(categoryId: number, color: string | null) {
    await fetch(`/api/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    });
    load();
  }

  async function handleGoalChange(categoryId: number, goalAmount: number | null) {
    await fetch(`/api/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_amount: goalAmount }),
    });
    load();
  }

  async function handleGoalDateChange(categoryId: number, goalDate: string | null) {
    await fetch(`/api/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_date: goalDate }),
    });
    load();
  }

  async function handleAddCategory(groupId: number) {
    const name = newCategoryName.trim();
    setAddingCategoryToGroup(null);
    setNewCategoryName('');
    if (!name) return;
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, name }),
    });
    load();
  }

  async function handleAddGroup() {
    const name = newGroupName.trim();
    setAddingGroup(false);
    setNewGroupName('');
    if (!name) return;
    await fetch('/api/category-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    load();
  }

  async function handleArchiveCategory(categoryId: number) {
    await fetch(`/api/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden: true }),
    });
    load();
  }

  async function handleDeleteCategory(categoryId: number, name: string) {
    if (!window.confirm(t('plan_delete_confirm_category', { name }))) return;
    const res = await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
    if (res.status === 409) {
      alert(t('plan_delete_has_transactions'));
      return;
    }
    load();
  }

  async function handleArchiveGroup(groupId: number) {
    await fetch(`/api/category-groups/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden: true }),
    });
    load();
  }

  async function handleRenameCategory(categoryId: number, newName: string) {
    await fetch(`/api/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    load();
  }

  async function handleRenameGroup(groupId: number, newName: string) {
    await fetch(`/api/category-groups/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    load();
  }

  async function handleRestoreCategory(categoryId: number) {
    await fetch(`/api/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden: false }),
    });
    load();
  }

  async function handleRestoreGroup(groupId: number) {
    await fetch(`/api/category-groups/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden: false }),
    });
    load();
  }

  async function handleDeleteGroup(groupId: number, name: string, hasCategories: boolean) {
    if (hasCategories) {
      alert(t('plan_delete_group_has_categories'));
      return;
    }
    if (!window.confirm(t('plan_delete_confirm_group', { name }))) return;
    await fetch(`/api/category-groups/${groupId}`, { method: 'DELETE' });
    load();
  }

  if (!data) return <div className="p-8 text-center text-gray-400">{t('plan_loading')}</div>;

  const { budgets, allGroups, readyToAssign } = data;

  const groups: Record<string, { name: string; sort: number; rows: BudgetEntry[]; id: number; isHidden: boolean }> = {};
  for (const g of allGroups) {
    groups[String(g.id)] = { name: g.name, sort: g.sort_order, rows: [], id: g.id, isHidden: g.is_hidden === 1 };
  }
  for (const b of budgets) {
    const key = String(b.group_id);
    if (groups[key]) groups[key].rows.push(b);
  }
  const sortedGroups = Object.entries(groups).sort((a, b) => a[1].sort - b[1].sort);
  const overspentCount = budgets.filter(b => b.available < 0).length;

  const [y, m] = month.split('-').map(Number);
  const monthLabel = `${tMonthShort(m - 1)} ${y}`;

  function changeMonth(delta: number) {
    let nm = m + delta, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1)  { nm = 12; ny--; }
    setMonth(`${ny}-${String(nm).padStart(2, '0')}`);
    setShowMonthPicker(false);
  }

  function filterRows(rows: BudgetEntry[]): BudgetEntry[] {
    switch (filter) {
      case 'overspent':   return rows.filter(r => r.available < 0);
      case 'underfunded': return rows.filter(r => r.goal_amount != null && r.available < r.goal_amount);
      case 'overfunded':  return rows.filter(r => r.goal_amount != null && r.available > r.goal_amount);
      case 'available':   return rows.filter(r => r.available > 0 && !r.goal_amount);
      default:            return rows;
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top header bar */}
      <div
        className="flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 border-b shrink-0"
        style={{ backgroundColor: readyToAssign < 0 ? 'var(--overspent-red)' : 'var(--ready-green)' }}
      >
        {/* Month navigation */}
        <div
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg"
          style={{ backgroundColor: readyToAssign < 0 ? '#dc2626' : '#16a34a' }}
        >
          <button onClick={() => changeMonth(-1)} className="p-1 text-white/80 hover:text-white">‹</button>
          <button
            onClick={() => setMonth(new Date().toISOString().slice(0, 7))}
            className="text-xs text-white/70 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 font-medium"
          >
            {t('plan_heute')}
          </button>
          <div className="relative" ref={monthPickerRef}>
            <button
              onClick={() => setShowMonthPicker(v => !v)}
              className="flex items-center gap-1 text-white font-semibold px-2 py-1 rounded hover:bg-white/10"
            >
              {monthLabel} <ChevronDown size={14} />
            </button>
            {showMonthPicker && (
              <div className="absolute top-full mt-1 left-0 bg-white shadow-lg rounded-lg p-3 z-50 w-48">
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => setMonth(`${y - 1}-${String(m).padStart(2, '0')}`)} className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded">‹</button>
                  <span className="text-sm font-semibold text-gray-800">{y}</span>
                  <button onClick={() => setMonth(`${y + 1}-${String(m).padStart(2, '0')}`)} className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded">›</button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 12 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => { setMonth(`${y}-${String(i + 1).padStart(2, '0')}`); setShowMonthPicker(false); }}
                      className={`py-1.5 rounded text-xs ${i + 1 === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {tMonthShort(i)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => changeMonth(1)} className="p-1 text-white/80 hover:text-white">›</button>
        </div>

        {/* Ready to assign */}
        <div className="flex items-center gap-2 ml-auto">
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-lg"
            style={{ backgroundColor: readyToAssign < 0 ? '#dc2626' : '#16a34a' }}
          >
            <span className="text-white font-bold text-lg">{fmt(readyToAssign)}</span>
            <div>
              <div className="text-white/80 text-xs">{t('plan_ready_to_assign')}</div>
            </div>
            <ChevronDown size={16} className="text-white/70" />
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 px-6 py-2 bg-gray-100 border-b shrink-0 overflow-x-auto">
        {([
          ['all',         t('plan_filter_all')] as const,
          ['overspent',   overspentCount > 0 ? t('plan_filter_overspent_count', { count: String(overspentCount) }) : t('plan_filter_overspent')] as const,
          ['underfunded', t('plan_filter_underfunded')] as const,
          ['overfunded',  t('plan_filter_overfunded')] as const,
          ['available',   t('plan_filter_available')] as const,
        ]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key as FilterType)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
              filter === key
                ? 'bg-blue-600 text-white'
                : key === 'overspent' && overspentCount > 0
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setShowArchived(v => !v)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            showArchived
              ? 'bg-amber-100 text-amber-700 border-amber-300'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Archive size={12} /> {t('plan_show_archived')}
        </button>
        <button className="text-gray-400 hover:text-gray-600">
          <HelpCircle size={16} />
        </button>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Budget table area */}
        <div className="flex-1 overflow-y-auto">
          {/* Table toolbar */}
          <div className="flex items-center gap-2 px-6 py-2 bg-white border-b sticky top-0 z-10">
            <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded px-2 py-1">
              {t('plan_category_group')} <ChevronDown size={12} />
            </button>
            <button className="p-1 text-gray-400 hover:text-gray-700"><RotateCcw size={14} /></button>
            <button className="p-1 text-gray-400 hover:text-gray-700"><RotateCw size={14} /></button>
            <button
              onClick={() => { setAddingGroup(true); setNewGroupName(''); }}
              className="ml-auto flex items-center gap-1 bg-blue-600 text-white text-sm rounded-lg px-3 py-1.5 hover:bg-blue-700"
            >
              <Plus size={14} /> {t('plan_add_group')}
            </button>
          </div>

          {/* Budget table */}
          <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-[41px] z-10">
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" className="rounded border-gray-300" />
                </th>
                <th className="px-3 py-2 text-left">{t('plan_col_category')}</th>
                <th className="px-3 py-2 text-right w-36">{t('plan_col_assigned')}</th>
                <th className="px-3 py-2 text-right w-36">{t('plan_col_activity')}</th>
                <th className="px-3 py-2 text-right w-36">{t('plan_col_available')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map(([key, group]) => {
                const filtered = filterRows(group.rows);
                if (filter !== 'all' && filtered.length === 0) return null;
                const groupAvail = group.rows.reduce((s, r) => s + r.available, 0);
                const isAddingHere = addingCategoryToGroup === group.id;

                return (
                  <React.Fragment key={key}>
                    {/* Group header row */}
                    <tr
                      className={`border-y border-gray-200 cursor-pointer group/grouprow ${group.isHidden ? 'bg-amber-50 hover:bg-amber-100' : 'bg-gray-50 hover:bg-gray-100'}`}
                      onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
                    >
                      <td className="w-8 px-3 py-2">
                        {collapsed[key]
                          ? <ChevronRight size={14} className="text-gray-400" />
                          : <ChevronDown size={14} className="text-gray-400" />
                        }
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        <div className="flex items-center gap-2">
                          {renamingGroupId === group.id ? (
                            <input
                              autoFocus
                              className="text-xs font-semibold uppercase tracking-wide border-b border-blue-400 bg-transparent outline-none px-0.5 w-40"
                              value={renamingGroupName}
                              onChange={e => setRenamingGroupName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); const v = renamingGroupName.trim(); setRenamingGroupId(null); if (v) handleRenameGroup(group.id, v); }
                                if (e.key === 'Escape') setRenamingGroupId(null);
                              }}
                              onBlur={() => { const v = renamingGroupName.trim(); setRenamingGroupId(null); if (v) handleRenameGroup(group.id, v); }}
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span className={group.isHidden ? 'text-amber-600 line-through' : 'text-gray-600'}>{group.name}</span>
                          )}
                          {!group.isHidden && renamingGroupId !== group.id && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setCollapsed(c => ({ ...c, [key]: false }));
                                setAddingCategoryToGroup(group.id);
                                setNewCategoryName('');
                              }}
                              className="opacity-0 group-hover/grouprow:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-opacity"
                              title={t('plan_add_category')}
                            >
                              <Plus size={13} />
                            </button>
                          )}
                          <div className="flex items-center gap-0.5 ml-auto">
                            {group.isHidden ? (
                              <button
                                onClick={e => { e.stopPropagation(); handleRestoreGroup(group.id); }}
                                className="flex items-center gap-1 px-2 py-0.5 text-xs text-amber-700 bg-amber-100 hover:bg-amber-200 rounded"
                              >
                                <RotateCcw size={11} /> {t('plan_restore')}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); setRenamingGroupName(group.name); setRenamingGroupId(group.id); }}
                                  className="p-0.5 text-gray-400 hover:text-blue-500 rounded"
                                  title={t('plan_rename')}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); handleArchiveGroup(group.id); }}
                                  className="p-0.5 text-gray-400 hover:text-amber-500 rounded"
                                  title={t('plan_archive')}
                                >
                                  <Archive size={13} />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteGroup(group.id, group.name, group.rows.length > 0); }}
                                  className="p-0.5 text-gray-400 hover:text-red-500 rounded"
                                  title={t('plan_delete')}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs font-medium text-gray-500">
                          {groupAvail !== 0 ? fmt(groupAvail) : ''}
                        </span>
                      </td>
                    </tr>

                    {/* Category rows */}
                    {!collapsed[key] && (filter === 'all' ? group.rows : filtered).map(row => (
                      <BudgetRow
                        key={row.category_id}
                        categoryId={row.category_id}
                        name={row.category_name}
                        color={row.category_color}
                        assigned={row.assigned}
                        activity={row.activity}
                        available={row.available}
                        isGoal={row.is_goal === 1}
                        goalAmount={row.goal_amount}
                        goalType={row.goal_type}
                        month={month}
                        isSelected={selectedCategoryId === row.category_id}
                        onSelect={() => setSelectedCategoryId(id => id === row.category_id ? null : row.category_id)}
                        onAssignChange={handleAssignChange}
                        isArchived={row.is_hidden === 1}
                        onRename={newName => handleRenameCategory(row.category_id, newName)}
                        onRestore={row.is_hidden === 1 ? () => handleRestoreCategory(row.category_id) : undefined}
                        onArchive={row.is_hidden === 0 ? () => handleArchiveCategory(row.category_id) : undefined}
                        onDelete={row.is_hidden === 0 ? () => handleDeleteCategory(row.category_id, row.category_name) : undefined}
                      />
                    ))}

                    {/* Inline new-category row */}
                    {isAddingHere ? (
                      <tr className="border-b border-blue-100 bg-blue-50">
                        <td className="w-8 px-3 py-1.5" />
                        <td className="px-3 py-1.5" colSpan={4}>
                          <input
                            autoFocus
                            className="w-full max-w-xs text-sm outline-none bg-transparent border-b border-blue-400 px-1 py-0.5 placeholder-blue-300"
                            placeholder={t('plan_new_category_placeholder')}
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(group.id); }
                              if (e.key === 'Escape') { setAddingCategoryToGroup(null); setNewCategoryName(''); }
                            }}
                            onBlur={() => handleAddCategory(group.id)}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr className="border-b border-gray-100">
                        <td className="w-8 px-3 py-1" />
                        <td className="px-3 py-1" colSpan={4}>
                          <button
                            onClick={() => {
                              setCollapsed(c => ({ ...c, [key]: false }));
                              setAddingCategoryToGroup(group.id);
                              setNewCategoryName('');
                            }}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600"
                          >
                            <Plus size={12} /> {t('plan_add_category')}
                          </button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Inline new-group row */}
              {addingGroup && (
                <tr className="border-b border-blue-100 bg-blue-50">
                  <td className="w-8 px-3 py-2" />
                  <td className="px-3 py-2" colSpan={4}>
                    <input
                      autoFocus
                      className="w-full max-w-xs text-sm font-semibold uppercase tracking-wide outline-none bg-transparent border-b border-blue-400 px-1 py-0.5 placeholder-blue-300"
                      placeholder={t('plan_new_group_placeholder')}
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); }
                        if (e.key === 'Escape') { setAddingGroup(false); setNewGroupName(''); }
                      }}
                      onBlur={() => handleAddGroup()}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Add group link at bottom */}
          {!addingGroup && (
            <div className="px-6 py-3">
              <button
                onClick={() => { setAddingGroup(true); setNewGroupName(''); }}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-600"
              >
                <Plus size={14} /> {t('plan_add_group')}
              </button>
            </div>
          )}
        </div>

        {/* Right panel */}
        <PlanRightPanel
          month={month}
          budgets={budgets}
          readyToAssign={readyToAssign}
          selectedCategory={budgets.find(b => b.category_id === selectedCategoryId) ?? null}
          onDeselect={() => setSelectedCategoryId(null)}
          onAssignChange={handleAssignChange}
          onColorChange={handleColorChange}
          onGoalChange={handleGoalChange}
          onGoalDateChange={handleGoalDateChange}
        />
      </div>

    </div>
  );
}
