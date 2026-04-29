import { PinTanClient } from 'fints';
import type { SEPAAccount } from 'fints';

export type { SEPAAccount };

export interface FintsConfig {
  url: string;
  blz: string;
  username: string;
  pin: string;
}

export interface ParsedTransaction {
  date: string;       // YYYY-MM-DD
  payee: string | null;
  memo: string | null;
  amount: number;     // positive = inflow, negative = outflow
  import_hash: string;
}

function makeClient(config: FintsConfig) {
  return new PinTanClient({
    url: config.url,
    blz: config.blz,
    name: config.username,
    pin: config.pin,
  });
}

// MT940 valueDate is YYMMDD or YYYYMMDD
function parseValueDate(s: string): string {
  if (s.length === 6) {
    const yy = s.slice(0, 2);
    const mm = s.slice(2, 4);
    const dd = s.slice(4, 6);
    const year = parseInt(yy) <= 50 ? `20${yy}` : `19${yy}`;
    return `${year}-${mm}-${dd}`;
  }
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return s;
}

export async function fetchAccounts(config: FintsConfig): Promise<SEPAAccount[]> {
  const client = makeClient(config);
  return client.accounts();
}

export async function fetchBalance(config: FintsConfig, iban: string): Promise<number> {
  const client = makeClient(config);
  const accounts = await client.accounts();
  const account = accounts.find(a => a.iban === iban);
  if (!account) throw new Error(`Account ${iban} not found`);
  const balance = await client.balance(account);
  return balance.bookedBalance;
}

export async function fetchTransactions(
  config: FintsConfig,
  iban: string,
  fromDate: Date,
): Promise<ParsedTransaction[]> {
  const client = makeClient(config);
  const accounts = await client.accounts();
  const account = accounts.find(a => a.iban === iban);
  if (!account) throw new Error(`Account ${iban} not found`);

  const statements = await client.statements(account, fromDate, new Date());
  const result: ParsedTransaction[] = [];

  for (const statement of statements) {
    for (const tx of statement.transactions) {
      const amount = tx.isCredit ? tx.amount : -tx.amount;
      const date = parseValueDate(tx.valueDate);
      const structured = (tx as { descriptionStructured?: { name?: string; reference?: { text?: string } } }).descriptionStructured;
      const payee = structured?.name?.trim() || null;
      const memo = structured?.reference?.text?.trim() || tx.description?.trim() || null;
      const import_hash = `fints:${iban}:${tx.valueDate}:${tx.isCredit ? '+' : '-'}${tx.amount}:${(tx.description ?? '').slice(0, 80)}`;

      result.push({ date, payee, memo, amount, import_hash });
    }
  }

  return result;
}
