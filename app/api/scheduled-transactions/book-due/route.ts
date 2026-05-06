import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';
import { nextDate, Frequency } from '../route';

interface ScheduledRow {
  id: number;
  account_id: number;
  category_id: number | null;
  payee: string | null;
  memo: string | null;
  amount: number;
  frequency: string;
  next_date: string;
  cleared: number;
  flag: string | null;
}

// POST body: { today: "YYYY-MM-DD" }  (client sends local date to avoid UTC skew)
export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const today: string = body.today;
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const due = db.prepare(`
    SELECT * FROM scheduled_transactions
    WHERE vault_id = ? AND next_date <= ?
    ORDER BY next_date ASC
  `).all(ctx.vaultId, today) as ScheduledRow[];

  let booked = 0;

  for (const st of due) {
    let currentDate = st.next_date;
    // Book one transaction per missed occurrence until caught up
    while (currentDate <= today) {
      db.prepare(`
        INSERT INTO transactions (account_id, category_id, date, amount, memo, payee, cleared, flag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(st.account_id, st.category_id, currentDate, st.amount, st.memo, st.payee, st.cleared ?? 0, st.flag);

      db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(st.amount, st.account_id);

      currentDate = nextDate(currentDate, st.frequency as Frequency);
      booked++;
    }
    db.prepare('UPDATE scheduled_transactions SET next_date = ? WHERE id = ?').run(currentDate, st.id);
  }

  return NextResponse.json({ booked });
}
