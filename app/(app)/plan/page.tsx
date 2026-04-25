'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ChevronDown, ChevronRight, Plus, UserPlus, Edit3, X, Copy, Check, Users, HelpCircle, RotateCcw, RotateCw } from 'lucide-react';
import BudgetRow from '@/components/BudgetRow';
import AddTransactionDialog from '@/components/AddTransactionDialog';
import PlanRightPanel from '@/components/PlanRightPanel';

interface BudgetEntry {
  category_id: number;
  category_name: string;
  group_id: number;
  group_name: string;
  group_sort: number;
  assigned: number;
  activity: number;
  available: number;
  is_goal: number;
  goal_amount: number | null;
  goal_type: string | null;
}

interface BudgetData {
  budgets: BudgetEntry[];
  readyToAssign: number;
  month: string;
}

interface Member { id: number; name: string; email: string; role: string; }

type FilterType = 'all' | 'overspent' | 'underfunded' | 'overfunded' | 'available';

export default function PlanPage() {
  const { t, tMonthShort, tMonthLong } = useI18n();
  const [data, setData] = useState<BudgetData | null>(null);
  const [month, setMonth] = useState('2026-04');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showTxDialog, setShowTxDialog] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  // Members modal state
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/budgets?month=${month}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Plan load failed:', e);
    }
  }, [month]);

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

  function getActiveVaultId(): number | null {
    const val = document.cookie.split('; ').find(c => c.startsWith('vault_id='))?.split('=')[1];
    return val ? parseInt(val, 10) : null;
  }

  async function openMembers() {
    const vaultId = getActiveVaultId();
    if (!vaultId) return;
    setInviteLink('');
    setInviteCopied(false);
    const res = await fetch(`/api/vaults/${vaultId}/members`);
    setMembers(await res.json());
    setShowMembers(true);
  }

  async function generateInvite() {
    const vaultId = getActiveVaultId();
    if (!vaultId) return;
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/vaults/${vaultId}/invite`, { method: 'POST' });
      const data = await res.json();
      setInviteLink(data.link);
    } finally {
      setInviteLoading(false);
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  }

  if (!data) return <div className="p-8 text-center text-gray-400">{t('plan_loading')}</div>;

  const { budgets, readyToAssign } = data;

  // Group budgets
  const groups: Record<string, { name: string; sort: number; rows: BudgetEntry[] }> = {};
  for (const b of budgets) {
    const key = String(b.group_id);
    if (!groups[key]) groups[key] = { name: b.group_name, sort: b.group_sort, rows: [] };
    groups[key].rows.push(b);
  }
  const sortedGroups = Object.entries(groups).sort((a, b) => a[1].sort - b[1].sort);

  const overspentCount = budgets.filter(b => b.available < 0).length;

  const [y, m] = month.split('-').map(Number);
  const monthLabel = `${tMonthShort(m - 1)} ${y}`;

  function changeMonth(delta: number) {
    let nm = m + delta;
    let ny = y;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1) { nm = 12; ny--; }
    setMonth(`${ny}-${String(nm).padStart(2, '0')}`);
    setShowMonthPicker(false);
  }

  function filterRows(rows: BudgetEntry[]): BudgetEntry[] {
    switch (filter) {
      case 'overspent': return rows.filter(r => r.available < 0);
      case 'underfunded': return rows.filter(r => r.goal_amount && r.available < r.goal_amount);
      case 'overfunded': return rows.filter(r => r.goal_amount && r.available > r.goal_amount);
      case 'available': return rows.filter(r => r.available > 0 && !r.goal_amount);
      default: return rows;
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top header bar */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b shrink-0"
        style={{ backgroundColor: readyToAssign < 0 ? 'var(--overspent-red)' : 'var(--ready-green)' }}
      >
        {/* Month navigation */}
        <div className="flex items-center gap-1">
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
                {/* Year row */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setMonth(`${y - 1}-${String(m).padStart(2, '0')}`)}
                    className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                  >‹</button>
                  <span className="text-sm font-semibold text-gray-800">{y}</span>
                  <button
                    onClick={() => setMonth(`${y + 1}-${String(m).padStart(2, '0')}`)}
                    className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                  >›</button>
                </div>
                {/* Month grid */}
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 12 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setMonth(`${y}-${String(i + 1).padStart(2, '0')}`);
                        setShowMonthPicker(false);
                      }}
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

        <button className="text-white/80 hover:text-white">
          <Edit3 size={16} />
        </button>

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
          <button
            onClick={openMembers}
            className="flex items-center gap-1 text-white/80 hover:text-white text-sm border border-white/30 rounded-lg px-3 py-2">
            <UserPlus size={14} /> {t('plan_add_member')}
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 px-6 py-2 bg-gray-100 border-b shrink-0 overflow-x-auto">
        {([
          ['all', t('plan_filter_all')] as const,
          ['overspent', overspentCount > 0 ? t('plan_filter_overspent_count', { count: String(overspentCount) }) : t('plan_filter_overspent')] as const,
          ['underfunded', t('plan_filter_underfunded')] as const,
          ['overfunded', t('plan_filter_overfunded')] as const,
          ['available', t('plan_filter_available')] as const,
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
        <button className="ml-auto text-gray-400 hover:text-gray-600">
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
              onClick={() => setShowTxDialog(true)}
              className="ml-auto flex items-center gap-1 bg-blue-600 text-white text-sm rounded-lg px-3 py-1.5 hover:bg-blue-700"
            >
              <Plus size={14} /> {t('plan_add_transaction')}
            </button>
          </div>

          {/* Budget table */}
          <table className="w-full border-collapse">
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
                return (
                  <React.Fragment key={key}>
                    {/* Group header row */}
                    <tr
                      className="bg-gray-50 border-y border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
                    >
                      <td className="w-8 px-3 py-2">
                        {collapsed[key]
                          ? <ChevronRight size={14} className="text-gray-400" />
                          : <ChevronDown size={14} className="text-gray-400" />
                        }
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        {group.name}
                      </td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2"></td>
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
                        assigned={row.assigned}
                        activity={row.activity}
                        available={row.available}
                        isGoal={row.is_goal === 1}
                        goalAmount={row.goal_amount}
                        goalType={row.goal_type}
                        month={month}
                        onAssignChange={handleAssignChange}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right panel */}
        <PlanRightPanel month={month} budgets={budgets} readyToAssign={readyToAssign} />
      </div>

      <AddTransactionDialog
        open={showTxDialog}
        onClose={() => setShowTxDialog(false)}
        onSaved={load}
      />

      {/* Members Modal */}
      {showMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMembers(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">{t('vault_members_title')}</h2>
              </div>
              <button onClick={() => setShowMembers(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Member list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                    {m.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{m.name}</div>
                    <div className="text-xs text-gray-500 truncate">{m.email}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.role === 'owner' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {m.role === 'owner' ? t('vault_member_role_owner') : t('vault_member_role_member')}
                  </span>
                </div>
              ))}
            </div>

            {/* Invite section */}
            <div className="px-5 py-4 border-t border-gray-200 space-y-3">
              {inviteLink ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2">{t('vault_invite_link_label')}</p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={inviteLink}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 outline-none"
                    />
                    <button
                      onClick={copyInvite}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${inviteCopied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      {inviteCopied ? <><Check size={13} /> {t('vault_invite_copied')}</> : <><Copy size={13} /> Kopieren</>}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={generateInvite}
                  disabled={inviteLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus size={15} />
                  {inviteLoading ? '…' : t('vault_invite_generate')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
