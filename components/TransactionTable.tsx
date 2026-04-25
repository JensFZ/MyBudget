'use client';

import { fmt } from '@/lib/format';
import { useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import InlineTransactionRow, { Account, Category, CategoryGroup, SaveData } from '@/components/InlineTransactionRow';

interface Transaction {
  id: number;
  account_id: number;
  account_name: string;
  category_id: number | null;
  category_name: string | null;
  date: string;
  amount: number;
  memo: string | null;
  payee: string | null;
  cleared: number;
  flag: string | null;
  needs_category: number;
  transfer_account_id: number | null;
}

interface Props {
  transactions: Transaction[];
  showAccount: boolean;
  accounts: Account[];
  categories: Category[];
  groups: CategoryGroup[];
  defaultAccountId?: number;
  addingNew: boolean;
  onNewSaved: (data: SaveData) => Promise<void>;
  onNewCancelled: () => void;
  onSave: (id: number, data: SaveData) => Promise<void>;
  onDelete: (id: number) => void;
  onToggleCleared: (id: number, cleared: number) => void;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

const ACTION_COL = 1;

export default function TransactionTable({
  transactions,
  showAccount,
  accounts,
  categories,
  groups,
  defaultAccountId,
  addingNew,
  onNewSaved,
  onNewCancelled,
  onSave,
  onDelete,
  onToggleCleared,
}: Props) {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<number | null>(null);

  function handleRowClick(id: number) {
    if (editingId === id) return;
    setEditingId(id);
  }

  const colSpan = (showAccount ? 9 : 8) + ACTION_COL;

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 z-10">
          <th className="w-8 px-3 py-2">
            <input type="checkbox" className="rounded border-gray-300" />
          </th>
          <th className="w-6 px-1 py-2" />
          {showAccount && <th className="px-3 py-2 text-left">{t('tx_col_account')}</th>}
          <th className="px-3 py-2 text-left">{t('tx_col_date')}</th>
          <th className="px-3 py-2 text-left">{t('tx_col_payee')}</th>
          <th className="px-3 py-2 text-left">{t('tx_col_category')}</th>
          <th className="px-3 py-2 text-left">{t('tx_col_memo')}</th>
          <th className="px-3 py-2 text-right w-28">{t('tx_col_outflow')}</th>
          <th className="px-3 py-2 text-right w-28">{t('tx_col_inflow')}</th>
          <th className="w-8 px-3 py-2 text-center">{t('tx_col_cleared')}</th>
          <th className="w-20 px-2 py-2" />
        </tr>
      </thead>
      <tbody>
        {/* New row at top */}
        {addingNew && (
          <InlineTransactionRow
            mode="new"
            showAccount={showAccount}
            accounts={accounts}
            categories={categories}
            groups={groups}
            defaultAccountId={defaultAccountId}
            onSave={async data => { await onNewSaved(data); }}
            onCancel={onNewCancelled}
          />
        )}

        {transactions.length === 0 && !addingNew && (
          <tr>
            <td colSpan={colSpan} className="py-16 text-center text-gray-400 text-sm">
              {t('tx_no_transactions')}
            </td>
          </tr>
        )}

        {transactions.map(tx => {
          if (editingId === tx.id) {
            return (
              <InlineTransactionRow
                key={tx.id}
                mode="edit"
                showAccount={showAccount}
                accounts={accounts}
                categories={categories}
                groups={groups}
                defaultAccountId={tx.account_id}
                initial={{
                  account_id: tx.account_id,
                  category_id: tx.category_id,
                  transfer_account_id: tx.transfer_account_id,
                  date: tx.date,
                  amount: tx.amount,
                  payee: tx.payee,
                  memo: tx.memo,
                  cleared: tx.cleared,
                }}
                onSave={async data => {
                  await onSave(tx.id, data);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
                onDelete={() => { setEditingId(null); onDelete(tx.id); }}
              />
            );
          }

          const isOutflow = tx.amount < 0;
          const isTransfer = !!tx.transfer_account_id;

          return (
            <tr
              key={tx.id}
              className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
              onClick={() => handleRowClick(tx.id)}
            >
              <td className="w-8 px-3 py-2" onClick={e => e.stopPropagation()}>
                <input type="checkbox" className="rounded border-gray-300" onChange={() => {}} />
              </td>
              <td className="w-6 px-1 py-2">
                <div className={`w-2 h-2 rounded-full ${tx.cleared ? 'bg-green-400' : 'bg-blue-400'}`} />
              </td>
              {showAccount && (
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{tx.account_name}</td>
              )}
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDate(tx.date)}</td>
              <td className="px-3 py-2 text-gray-800">
                {isTransfer
                  ? <span className="text-blue-600">{tx.payee ?? '—'}</span>
                  : (tx.payee ?? '—')
                }
              </td>
              <td className="px-3 py-2">
                {isTransfer ? (
                  <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded">{t('tx_transfer_badge')}</span>
                ) : tx.needs_category === 1 || (!tx.category_id && tx.amount < 0) ? (
                  <span className="inline-block bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded">
                    {t('tx_needs_category')}
                  </span>
                ) : (
                  <span className="text-gray-500">{tx.category_name ?? ''}</span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-400 text-xs">{tx.memo ?? ''}</td>
              <td className="px-3 py-2 text-right w-28">
                {isOutflow && (
                  <span className="text-red-600 font-medium">{fmt(Math.abs(tx.amount))}</span>
                )}
              </td>
              <td className="px-3 py-2 text-right w-28">
                {!isOutflow && tx.amount > 0 && (
                  <span className="text-green-600 font-medium">{fmt(tx.amount)}</span>
                )}
              </td>
              <td
                className="w-8 px-3 py-2 text-center"
                onClick={e => { e.stopPropagation(); onToggleCleared(tx.id, tx.cleared ? 0 : 1); }}
              >
                {tx.cleared ? (
                  <Check size={14} className="text-green-500 mx-auto" />
                ) : (
                  <Circle size={14} className="text-gray-300 mx-auto" />
                )}
              </td>
              <td className="w-20 px-2 py-2" />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
