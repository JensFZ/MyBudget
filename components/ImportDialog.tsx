'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Account } from '@/components/InlineTransactionRow';

interface ImportRow {
  date: string;
  payee: string | null;
  memo: string | null;
  amount: number;
  cleared: number;
  import_hash: string;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  total: number;
}

interface Props {
  accounts: Account[];
  defaultAccountId?: number;
  onClose: () => void;
  onImported: () => void;
}

// Parse German number format: "1.500,00" → 1500.00, "-1.500,00" → -1500.00
function parseGermanNumber(s: string): number {
  const cleaned = s.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
}

// Parse DD.MM.YYYY → YYYY-MM-DD
function parseGermanDate(s: string): string {
  const [d, m, y] = s.trim().split('.');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parse1822CSV(text: string): ImportRow[] {
  const lines = text.split('\n').map(l => l.trimEnd());
  // Find header line (starts with "Kontonummer")
  const headerIdx = lines.findIndex(l => l.startsWith('Kontonummer'));
  if (headerIdx < 0) throw new Error('Not a valid 1822direkt CSV');
  const dataLines = lines.slice(headerIdx + 1).filter(l => l.trim().length > 0);

  const rows: ImportRow[] = [];
  for (const line of dataLines) {
    const cols = line.split(';');
    if (cols.length < 32) continue;

    const buchungsschluessel = cols[5]?.trim();
    // Skip Rechnungsabschluss (type 25100)
    if (buchungsschluessel === '25100') continue;

    const dateRaw = cols[2]?.trim();
    if (!dateRaw || !dateRaw.match(/^\d{2}\.\d{2}\.\d{4}$/)) continue;

    const amountRaw = cols[4]?.trim();
    if (!amountRaw) continue;

    const amount = parseGermanNumber(amountRaw);
    if (isNaN(amount)) continue;

    const date = parseGermanDate(dateRaw);
    const payee = cols[7]?.trim() || null;
    // Collect memo fields Vwz.0 through Vwz.17 (cols 13-30)
    const memoParts = cols.slice(13, 31).map(c => c.trim()).filter(Boolean);
    const memo = memoParts.join(' ') || null;
    const e2e = cols[31]?.trim() || '';

    let import_hash: string;
    if (e2e) {
      import_hash = `1822:${e2e}`;
    } else {
      const vwz0 = cols[13]?.trim() || '';
      import_hash = `1822:${date}:${amountRaw}:${vwz0}`;
    }

    rows.push({ date, payee, memo, amount, cleared: 1, import_hash });
  }
  return rows;
}

function parseNativeCSV(text: string): ImportRow[] {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(Boolean);
  if (lines.length < 2) throw new Error('Empty CSV');

  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const dateIdx = idx('date');
  const payeeIdx = idx('payee');
  const memoIdx = idx('memo');
  const amountIdx = idx('amount');
  const outflowIdx = idx('outflow');
  const inflowIdx = idx('inflow');
  const clearedIdx = idx('cleared');

  if (dateIdx < 0 || amountIdx < 0 && outflowIdx < 0) {
    throw new Error('Unrecognized native CSV format (missing date/amount columns)');
  }

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const dateRaw = cols[dateIdx]?.trim() ?? '';
    if (!dateRaw) continue;

    // Support YYYY-MM-DD and DD.MM.YYYY
    let date: string;
    if (dateRaw.match(/^\d{4}-\d{2}-\d{2}$/)) {
      date = dateRaw;
    } else if (dateRaw.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      date = parseGermanDate(dateRaw);
    } else {
      continue;
    }

    let amount: number;
    if (amountIdx >= 0) {
      const raw = cols[amountIdx]?.trim() ?? '';
      amount = raw.includes(',') ? parseGermanNumber(raw) : parseFloat(raw);
    } else {
      const outflow = parseFloat(cols[outflowIdx]?.trim().replace(',', '.') ?? '0') || 0;
      const inflow = parseFloat(cols[inflowIdx]?.trim().replace(',', '.') ?? '0') || 0;
      amount = inflow - outflow;
    }
    if (isNaN(amount)) continue;

    const payee = cols[payeeIdx]?.trim() || null;
    const memo = cols[memoIdx]?.trim() || null;
    const cleared = clearedIdx >= 0 ? (cols[clearedIdx]?.trim() === '1' || cols[clearedIdx]?.trim().toLowerCase() === 'true' ? 1 : 0) : 0;
    const import_hash = `native:${date}:${amount}:${payee ?? ''}:${memo ?? ''}:${i}`;

    rows.push({ date, payee, memo, amount, cleared, import_hash });
  }
  return rows;
}

function detectAndParse(text: string): { rows: ImportRow[]; format: string } {
  if (text.includes('Buchungsschlüssel') || text.includes('Kontonummer') || text.includes('End-to-End')) {
    return { rows: parse1822CSV(text), format: '1822direkt' };
  }
  return { rows: parseNativeCSV(text), format: 'native' };
}

export default function ImportDialog({ accounts, defaultAccountId, onClose, onImported }: Props) {
  const { t } = useI18n();
  const [accountId, setAccountId] = useState<number>(defaultAccountId ?? (accounts[0]?.id ?? 0));
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [format, setFormat] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    setRows(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target?.result as ArrayBuffer;
        // Try UTF-8 first; fall back to ISO-8859-1 if replacement chars appear
        let text = new TextDecoder('utf-8').decode(buf);
        if (text.includes('�')) {
          text = new TextDecoder('iso-8859-1').decode(buf);
        }
        const { rows: parsed, format: fmt } = detectAndParse(text);
        if (parsed.length === 0) throw new Error(t('import_no_rows'));
        setRows(parsed);
        setFormat(fmt);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    reader.readAsArrayBuffer(file);
  }, [t]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  async function doImport() {
    if (!rows || !accountId) return;
    setImporting(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, rows }),
      });
      if (!res.ok) throw new Error(await res.text());
      const r: ImportResult = await res.json();
      setResult(r);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  const preview = rows?.slice(0, 50) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{t('import_title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Account selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('import_account')}</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
              value={accountId}
              onChange={e => setAccountId(Number(e.target.value))}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          {!rows && !result && (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <Upload size={32} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">{t('import_drop_hint')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('import_formats_hint')}</p>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{t('import_result', { imported: String(result.imported), duplicates: String(result.duplicates), total: String(result.total) })}</span>
            </div>
          )}

          {/* Preview */}
          {rows && !result && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {t('import_preview', { count: String(rows.length), format })}
              </p>
              <div className="border border-gray-200 rounded-lg overflow-auto max-h-64">
                <table className="text-xs w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">{t('tx_col_date')}</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">{t('tx_col_payee')}</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">{t('tx_col_memo')}</th>
                      <th className="text-right px-3 py-2 text-gray-600 font-medium">{t('tx_col_outflow')}</th>
                      <th className="text-right px-3 py-2 text-gray-600 font-medium">{t('tx_col_inflow')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-gray-700 font-mono">{row.date}</td>
                        <td className="px-3 py-1.5 text-gray-700 max-w-[150px] truncate">{row.payee ?? '—'}</td>
                        <td className="px-3 py-1.5 text-gray-500 max-w-[200px] truncate">{row.memo ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right text-red-600 font-mono">
                          {row.amount < 0 ? Math.abs(row.amount).toFixed(2) : ''}
                        </td>
                        <td className="px-3 py-1.5 text-right text-green-700 font-mono">
                          {row.amount >= 0 ? row.amount.toFixed(2) : ''}
                        </td>
                      </tr>
                    ))}
                    {rows.length > 50 && (
                      <tr className="border-t border-gray-100">
                        <td colSpan={5} className="px-3 py-2 text-center text-gray-400 italic">
                          {t('import_preview_more', { count: String(rows.length - 50) })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0">
          {result ? (
            <button onClick={onClose} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              {t('settings_save')}
            </button>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">
                {t('settings_cancel')}
              </button>
              {rows && (
                <button
                  onClick={doImport}
                  disabled={importing}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {importing ? t('import_importing') : t('import_confirm', { count: String(rows.length) })}
                </button>
              )}
              {!rows && (
                <button
                  onClick={() => inputRef.current?.click()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {t('import_choose_file')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
