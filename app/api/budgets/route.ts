import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedIfNeeded } from '@/lib/seed';
import { resolveVault } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  seedIfNeeded(ctx.vaultId);

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  // First day of the following month — used to include all dates within `month`
  const [yNum, mNum] = month.split('-').map(Number);
  const nextMonth = mNum === 12
    ? `${yNum + 1}-01`
    : `${yNum}-${String(mNum + 1).padStart(2, '0')}`;

  const budgets = db.prepare(`
    SELECT
      c.id    AS category_id,
      c.name  AS category_name,
      c.color AS category_color,
      c.group_id,
      c.is_goal,
      c.goal_amount,
      c.goal_type,
      cg.name       AS group_name,
      cg.sort_order AS group_sort,

      -- This month's assigned (for display in the Assigned column)
      COALESCE(b.assigned, 0) AS assigned,

      -- This month's activity (for display in the Activity column)
      COALESCE(
        (SELECT SUM(t.amount)
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE t.category_id = c.id
           AND t.date >= ? AND t.date < ?
           AND a.vault_id = ?),
        0
      ) AS activity,

      -- Cumulative available = all assigned up to this month
      --                      + all activity up to and including this month
      COALESCE(
        (SELECT SUM(b2.assigned)
         FROM budgets b2
         WHERE b2.category_id = c.id AND b2.month <= ?),
        0
      ) + COALESCE(
        (SELECT SUM(t.amount)
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE t.category_id = c.id
           AND t.date < ?
           AND a.vault_id = ?),
        0
      ) AS available

    FROM categories c
    LEFT JOIN category_groups cg ON c.group_id = cg.id
    LEFT JOIN budgets b ON b.category_id = c.id AND b.month = ?
    WHERE cg.vault_id = ?
    ORDER BY cg.sort_order, c.sort_order
  `).all(
    `${month}-01`, nextMonth, ctx.vaultId,   // activity: this month only
    month,                                    // cumulative assigned: <= month
    nextMonth, ctx.vaultId,                   // cumulative activity: < nextMonth
    month, ctx.vaultId                        // JOIN condition + WHERE
  );

  const accounts = db.prepare(
    "SELECT balance FROM accounts WHERE vault_id = ? AND on_budget = 1 AND type != 'credit'"
  ).all(ctx.vaultId) as { balance: number }[];
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  // readyToAssign = money in accounts not yet claimed by any envelope
  // = totalBalance - sum of all category available balances
  const totalAvailable = (budgets as { available: number }[]).reduce((s, b) => s + b.available, 0);
  const readyToAssign = totalBalance - totalAvailable;

  return NextResponse.json({ budgets, readyToAssign, month });
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { category_id, month, assigned } = await req.json();

  const cat = db.prepare(`
    SELECT c.id FROM categories c
    JOIN category_groups cg ON c.group_id = cg.id
    WHERE c.id = ? AND cg.vault_id = ?
  `).get(category_id, ctx.vaultId);
  if (!cat) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  const result = db.prepare(`
    INSERT INTO budgets (category_id, month, assigned) VALUES (?, ?, ?)
    ON CONFLICT(category_id, month) DO UPDATE SET assigned = excluded.assigned
    RETURNING *
  `).get(category_id, month, assigned);

  return NextResponse.json(result);
}
