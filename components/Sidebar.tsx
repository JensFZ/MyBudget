'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { fmt } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { locales } from '@/lib/translations';
import type { Lang } from '@/lib/i18n';
import {
  LayoutGrid, TrendingUp, List, Plus, ChevronDown,
  Building2, Settings, X, Check, Star,
  ShieldCheck, Shield, LogOut, Layers, ChevronRight, Camera,
  Copy, Users
} from 'lucide-react';
import AddAccountDialog from '@/components/AddAccountDialog';


interface Account {
  id: number;
  name: string;
  type: string;
  balance: number;
  on_budget: number;
  starred: number;
  archived: number;
}

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);  const userMenuRef = useRef<HTMLDivElement>(null);

  // 2FA state
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaFlow, setTwoFaFlow] = useState<null | 'enable' | 'disable'>(null);
  const [twoFaQr, setTwoFaQr] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaError, setTwoFaError] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  // Members state
  interface Member { id: number; name: string; email: string; role: string; }
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Vault state
  interface VaultInfo { id: number; name: string; role: string; }
  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [activeVaultId, setActiveVaultId] = useState<number | null>(null);
  const [showVaultMenu, setShowVaultMenu] = useState(false);
  const [showNewVault, setShowNewVault] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setUserName(d.name); setUserEmail(d.email); setUserAvatar(d.avatar ?? null); }
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showUserMenu]);

  function loadAccounts() {
    fetch('/api/accounts').then(r => r.json()).then(setAccounts).catch(() => {});
  }

  function loadVaults() {
    fetch('/api/vaults').then(r => r.json()).then((list: VaultInfo[]) => {
      setVaults(list);
      // Read active vault from cookie
      const cookieVal = document.cookie.split('; ').find(c => c.startsWith('vault_id='))?.split('=')[1];
      const cookieId = cookieVal ? parseInt(cookieVal, 10) : null;
      const match = list.find(v => v.id === cookieId) ?? list[0];
      if (match) setActiveVaultId(match.id);
    }).catch(() => {});
  }

  useEffect(() => {
    loadAccounts();
    loadVaults();
    window.addEventListener('accounts-updated', loadAccounts);
    return () => window.removeEventListener('accounts-updated', loadAccounts);
  }, []);

  // Close sidebar drawer on mobile when navigating
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchVault(id: number) {
    document.cookie = `vault_id=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setActiveVaultId(id);
    setShowVaultMenu(false);
    loadAccounts();
  }

  async function createVault() {
    if (!newVaultName.trim()) return;
    const res = await fetch('/api/vaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newVaultName.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewVaultName('');
      setShowNewVault(false);
      setShowVaultMenu(false);
      await loadVaults();
      switchVault(data.id);
    }
  }

  async function openMembers() {
    if (!activeVaultId) return;
    setInviteLink('');
    setInviteCopied(false);
    const res = await fetch(`/api/vaults/${activeVaultId}/members`);
    setMembers(await res.json());
    setShowMembers(true);
  }

  async function generateInvite() {
    if (!activeVaultId) return;
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/vaults/${activeVaultId}/invite`, { method: 'POST' });
      setInviteLink((await res.json()).link);
    } finally {
      setInviteLoading(false);
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  }

  async function removeMember(memberId: number) {
    if (!activeVaultId) return;
    await fetch(`/api/vaults/${activeVaultId}/members?userId=${memberId}`, { method: 'DELETE' });
    setMembers(prev => prev.filter(m => m.id !== memberId));
  }

  const byStarred = (a: Account, b: Account) => (b.starred ?? 0) - (a.starred ?? 0);

  const active = (a: Account) => !a.archived;
  const bankAccounts = accounts.filter(a => active(a) && (a.type === 'checking' || a.type === 'savings') && a.on_budget === 1).sort(byStarred);
  const cash         = accounts.filter(a => active(a) && a.type === 'cash'   && a.on_budget === 1).sort(byStarred);
  const credit       = accounts.filter(a => active(a) && a.type === 'credit' && a.on_budget === 1).sort(byStarred);
  const tracking     = accounts.filter(a => active(a) && a.on_budget === 0   && a.type !== 'closed').sort(byStarred);
  const closed       = accounts.filter(a => active(a) && a.type === 'closed').sort(byStarred);
  const archived     = accounts.filter(a => a.archived === 1).sort(byStarred);

  function NavLink({ href, icon, label, disabled }: { href: string; icon: React.ReactNode; label: string; disabled?: boolean }) {
    const active = pathname === href || pathname.startsWith(href + '/');
    if (disabled) {
      return (
        <span className="flex items-center gap-3 px-4 py-2 rounded-lg mx-2 text-sm font-medium text-slate-600 cursor-not-allowed select-none">
          {icon}
          {label}
        </span>
      );
    }
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-4 py-2 rounded-lg mx-2 text-sm font-medium transition-colors ${
          active
            ? 'bg-slate-700 text-white'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  }

  function AccountGroup({ title, items, muted }: { title: string; items: Account[]; muted?: boolean }) {
    const [open, setOpen] = useState(true);
    if (items.length === 0) return null;
    return (
      <div className="mt-3">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-between w-full px-4 py-1"
        >
          <span className={`text-xs font-semibold uppercase tracking-wider ${muted ? 'text-slate-600' : 'text-slate-500'}`}>{title}</span>
          <ChevronDown size={12} className={`text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        {open && items.map(a => (
          <Link
            key={a.id}
            href={`/accounts/${a.id}`}
            className="flex items-center justify-between px-4 py-1.5 mx-2 rounded-md hover:bg-slate-800 group"
          >
            <span className={`text-sm truncate flex items-center gap-1 ${muted ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-300 group-hover:text-white'}`}>
              {a.starred ? <Star size={10} className="text-yellow-400 shrink-0" fill="currentColor" /> : null}
              {a.name}
            </span>
            <span className={`text-xs font-medium ml-2 shrink-0 ${a.balance < 0 ? 'text-red-400' : muted ? 'text-slate-600' : 'text-slate-400'}`}>
              {fmt(a.balance)}
            </span>
          </Link>
        ))}
      </div>
    );
  }

  const LANGS = (Object.entries(locales) as [Lang, { nativeName: string }][]).map(
    ([code, { nativeName }]) => ({ code, label: code.toUpperCase(), nativeName })
  );

  const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 300, 300);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      setUserAvatar(dataUrl);
      await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: dataUrl }),
      });
    } catch { /* ignore */ }
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  }

  async function removeAvatar() {
    setUserAvatar(null);
    await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: null }),
    });
  }

  function openSettings() {
    setEditName(userName);
    setEditEmail(userEmail);
    setShowUserMenu(false);
    setTwoFaFlow(null);
    setTwoFaCode('');
    setTwoFaError('');
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setTwoFaEnabled(!!d.totpEnabled);
    });
    setShowSettings(true);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  async function startEnable2fa() {
    setTwoFaError('');
    setTwoFaLoading(true);
    try {
      const res = await fetch('/api/auth/2fa');
      const data = await res.json();
      setTwoFaQr(data.qrDataUrl);
      setTwoFaCode('');
      setTwoFaFlow('enable');
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function confirmEnable2fa() {
    setTwoFaError('');
    setTwoFaLoading(true);
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFaCode }),
      });
      const data = await res.json();
      if (!res.ok) { setTwoFaError(data.error ?? 'Ungültiger Code'); return; }
      setTwoFaEnabled(true);
      setTwoFaFlow(null);
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function confirmDisable2fa() {
    setTwoFaError('');
    setTwoFaLoading(true);
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFaCode }),
      });
      const data = await res.json();
      if (!res.ok) { setTwoFaError(data.error ?? 'Ungültiger Code'); return; }
      setTwoFaEnabled(false);
      setTwoFaFlow(null);
    } finally {
      setTwoFaLoading(false);
    }
  }

  function saveSettings() {
    const n = editName.trim() || userName;
    const e = editEmail.trim() || userEmail;
    setUserName(n);
    setUserEmail(e);
    fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n, email: e }),
    });
    setShowSettings(false);
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col h-full overflow-y-auto transition-transform duration-200 md:relative md:translate-x-0 md:flex-shrink-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white md:hidden"
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
        {/* User header with dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="w-full px-4 py-5 border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden">
                {userAvatar
                  ? <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                  : initials}
              </div>
              <div className="min-w-0 text-left">
                <div className="text-sm font-semibold text-white truncate">{userName}</div>
                <div className="text-xs text-slate-400 truncate">{userEmail}</div>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-400 shrink-0 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {/* Dropdown menu */}
          {showUserMenu && (
            <div className="absolute top-full left-0 right-0 z-50 bg-slate-800 border border-slate-700 rounded-b-lg shadow-xl overflow-hidden">
              <button
                onClick={openSettings}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <Settings size={14} />
                {t('settings_title')}
              </button>
              <div className="border-t border-slate-700" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-700 hover:text-red-400 transition-colors"
              >
                <LogOut size={14} />
                {t('settings_logout')}
              </button>
            </div>
          )}
        </div>

        {/* Vault Switcher */}
        {vaults.length > 0 && (
          <div className="relative px-3 py-2 border-b border-slate-800">
            <button
              onClick={() => setShowVaultMenu(v => !v)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Layers size={13} className="text-slate-400 shrink-0" />
              <span className="text-xs text-slate-300 truncate flex-1 text-left">
                {vaults.find(v => v.id === activeVaultId)?.name ?? '…'}
              </span>
              <ChevronDown size={11} className={`text-slate-500 transition-transform ${showVaultMenu ? 'rotate-180' : ''}`} />
            </button>

            {showVaultMenu && (
              <div className="absolute left-3 right-3 top-full mt-1 z-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                {vaults.map(v => (
                  <button
                    key={v.id}
                    onClick={() => switchVault(v.id)}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${
                      v.id === activeVaultId ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Layers size={11} className="shrink-0" />
                    <span className="flex-1 truncate text-left">{v.name}</span>
                    {v.id === activeVaultId && <Check size={11} className="text-blue-400 shrink-0" />}
                  </button>
                ))}
                <div className="border-t border-slate-700" />
                {showNewVault ? (
                  <div className="px-2 py-2 flex gap-1">
                    <input
                      autoFocus
                      className="min-w-0 flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-400"
                      placeholder={t('vault_new_name_placeholder')}
                      value={newVaultName}
                      onChange={e => setNewVaultName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') createVault(); if (e.key === 'Escape') { setShowNewVault(false); setNewVaultName(''); } }}
                    />
                    <button onClick={createVault} className="shrink-0 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                      <ChevronRight size={12} />
                    </button>
                    <button onClick={() => { setShowNewVault(false); setNewVaultName(''); }} className="shrink-0 px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewVault(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <Plus size={11} />
                    {t('vault_new')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="pt-3 pb-2">          <NavLink href="/plan" icon={<LayoutGrid size={16} />} label={t('nav_plan')} />
          <NavLink href="/reflect" icon={<TrendingUp size={16} />} label={t('nav_reflect')} />
          <NavLink href="/accounts" icon={<List size={16} />} label={t('nav_all_accounts')} disabled={accounts.length === 0} />
        </nav>

        <div className="border-t border-slate-800 mt-1" />

        {/* Accounts */}
        <div className="flex-1 overflow-y-auto py-2">
          <AccountGroup title={t('sidebar_account_group_accounts')} items={bankAccounts} />
          <AccountGroup title={t('sidebar_account_group_cash')} items={cash} />
          <AccountGroup title={t('sidebar_account_group_credit')} items={credit} />
          <AccountGroup title={t('sidebar_account_group_tracking')} items={tracking} />
          <AccountGroup title={t('sidebar_account_group_closed')} items={closed} />
          <AccountGroup title={t('sidebar_account_group_archived')} items={archived} muted />
        </div>

        {/* Bottom actions */}
        <div className="border-t border-slate-800 px-4 py-3 space-y-1">
          <button
            onClick={() => setShowAddAccount(true)}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
          >
            <Plus size={14} />
            {t('sidebar_add_account')}
          </button>
          <button
            onClick={openMembers}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
          >
            <Building2 size={14} />
            {t('sidebar_refer_friend')}
          </button>
          <p className="px-2 pt-1 text-[10px] text-slate-600 leading-tight">
            Build {process.env.NEXT_PUBLIC_BUILD_DATE}
            {process.env.NEXT_PUBLIC_BUILD_COMMIT && (
              <> &middot; <span className="font-mono">{process.env.NEXT_PUBLIC_BUILD_COMMIT}</span></>
            )}
          </p>
        </div>

        <AddAccountDialog
          open={showAddAccount}
          onClose={() => setShowAddAccount(false)}
          onSaved={() => loadAccounts()}
        />
      </aside>

      {/* Settings overlay */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSettings(false)}
          />
          {/* Panel — slides in from the left, aligned with sidebar */}
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">{t('settings_title')}</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {/* Profile section */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                  {t('settings_profile')}
                </p>

                {/* Avatar preview */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative group">
                    <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold overflow-hidden">
                      {userAvatar
                        ? <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                        : (editName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || initials)}
                    </div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title={t('settings_avatar_upload')}
                    >
                      <Camera size={16} className="text-white" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </div>
                  <div className="text-sm text-gray-500 flex flex-col gap-1">
                    <span>{t('settings_avatar_hint')}</span>
                    {userAvatar && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        className="text-xs text-red-500 hover:text-red-700 text-left"
                      >
                        {t('settings_avatar_remove')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('settings_name')}
                    </label>
                    <input
                      autoFocus
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveSettings()}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('settings_email')}
                    </label>
                    <input
                      type="email"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveSettings()}
                    />
                  </div>
                </div>
              </div>

              {/* Language section */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                  {t('settings_language')}
                </p>
                <div className="space-y-1">
                  {LANGS.map(({ code, label, nativeName }) => (
                    <button
                      key={code}
                      onClick={() => setLang(code)}
                      className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        lang === code
                          ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <span>{nativeName}</span>
                      <span className="text-xs font-mono text-gray-400">{label}</span>
                      {lang === code && <Check size={14} className="text-blue-600 ml-1" />}
                    </button>
                  ))}
                </div>
              </div>
              {/* Security / 2FA section */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                  {t('settings_security')}
                </p>

                {twoFaFlow === null && (
                  <div className="flex items-center justify-between px-3 py-3 rounded-lg border border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                      {twoFaEnabled
                        ? <ShieldCheck size={16} className="text-green-500 shrink-0" />
                        : <Shield size={16} className="text-gray-400 shrink-0" />}
                      <span className={`text-sm ${twoFaEnabled ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                        {twoFaEnabled ? t('settings_2fa_status_on') : t('settings_2fa_status_off')}
                      </span>
                    </div>
                    {twoFaEnabled ? (
                      <button
                        onClick={() => { setTwoFaCode(''); setTwoFaError(''); setTwoFaFlow('disable'); }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        {t('settings_2fa_disable')}
                      </button>
                    ) : (
                      <button
                        onClick={startEnable2fa}
                        disabled={twoFaLoading}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                      >
                        {twoFaLoading ? '…' : t('settings_2fa_enable')}
                      </button>
                    )}
                  </div>
                )}

                {twoFaFlow === 'enable' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">{t('settings_2fa_scan_hint')}</p>
                    {twoFaQr && (
                      <div className="flex justify-center">
                        <div className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                          <img src={twoFaQr} alt="2FA QR" className="w-36 h-36" />
                        </div>
                      </div>
                    )}
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                      placeholder="000000" autoFocus
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-lg font-mono text-center tracking-[0.4em] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      value={twoFaCode}
                      onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                    {twoFaError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{twoFaError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTwoFaFlow(null)}
                        className="flex-1 py-2 border border-gray-200 text-xs text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        {t('settings_2fa_back')}
                      </button>
                      <button
                        onClick={confirmEnable2fa}
                        disabled={twoFaLoading || twoFaCode.length !== 6}
                        className="flex-1 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {twoFaLoading ? '…' : t('settings_2fa_verify')}
                      </button>
                    </div>
                  </div>
                )}

                {twoFaFlow === 'disable' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">{t('settings_2fa_confirm_disable')}</p>
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                      placeholder="000000" autoFocus
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-lg font-mono text-center tracking-[0.4em] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      value={twoFaCode}
                      onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                    {twoFaError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{twoFaError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTwoFaFlow(null)}
                        className="flex-1 py-2 border border-gray-200 text-xs text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        {t('settings_2fa_back')}
                      </button>
                      <button
                        onClick={confirmDisable2fa}
                        disabled={twoFaLoading || twoFaCode.length !== 6}
                        className="flex-1 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
                      >
                        {twoFaLoading ? '…' : t('settings_2fa_disable')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
              >
                {t('settings_cancel')}
              </button>
              <button
                onClick={saveSettings}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Check size={14} />
                {t('settings_save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members / Invite Modal */}
      {showMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMembers(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">{t('vault_members_title')}</h2>
              </div>
              <button onClick={() => setShowMembers(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {(() => {
                const iAmOwner = members.some(m => m.email === userEmail && m.role === 'owner');
                return members.map(mem => (
                  <div key={mem.id} className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                      {mem.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{mem.name}</div>
                      <div className="text-xs text-gray-500 truncate">{mem.email}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${mem.role === 'owner' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {mem.role === 'owner' ? t('vault_member_role_owner') : t('vault_member_role_member')}
                    </span>
                    {iAmOwner && mem.role !== 'owner' && (
                      <button
                        onClick={() => removeMember(mem.id)}
                        className="p-1 text-gray-300 hover:text-red-500 rounded hover:bg-red-50 shrink-0"
                        title={t('vault_member_remove')}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ));
              })()}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 space-y-3">
              {inviteLink ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2">{t('vault_invite_link_label')}</p>
                  <div className="flex gap-2">
                    <input readOnly value={inviteLink} className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 outline-none" />
                    <button
                      onClick={copyInvite}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${inviteCopied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      {inviteCopied ? <><Check size={13} /> {t('vault_invite_copied')}</> : <><Copy size={13} /> {t('vault_invite_copy')}</>}
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
    </>
  );
}
