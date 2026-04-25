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

  const budgets = db.prepare(`
    SELECT
      c.id as category_id,
      c.name as category_name,
      c.group_id,
      c.is_goal,
      c.goal_amount,
      c.goal_type,
      cg.name as group_name,
      cg.sort_order as group_sort,
      COALESCE(b.assigned, 0) as assigned,
      COALESCE(
        (SELECT SUM(t.amount) FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE t.category_id = c.id AND t.date LIKE ? AND a.vault_id = ?),
        0
      ) as activity,
      COALESCE(b.assigned, 0) + COALESCE(
        (SELECT SUM(t.amount) FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE t.category_id = c.id AND t.date LIKE ? AND a.vault_id = ?),
        0
      ) as available
    FROM categories c
    LEFT JOIN category_groups cg ON c.group_id = cg.id
    LEFT JOIN budgets b ON b.category_id = c.id AND b.month = ?
    WHERE cg.vault_id = ?
    ORDER BY cg.sort_order, c.sort_order
  `).all(`${month}%`, ctx.vaultId, `${month}%`, ctx.vaultId, month, ctx.vaultId);

  const accounts = db.prepare(
    "SELECT balance FROM accounts WHERE vault_id = ? AND on_budget = 1 AND type != 'credit'"
  ).all(ctx.vaultId) as { balance: number }[];
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  // Only sum budgets for categories in this vault
  const assignedRow = db.prepare(`
    SELECT COALESCE(SUM(b.assigned), 0) as total
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    JOIN category_groups cg ON c.group_id = cg.id
    WHERE b.month = ? AND cg.vault_id = ?
  `).get(month, ctx.vaultId) as { total: number };

  return NextResponse.json({ budgets, readyToAssign: totalBalance - assignedRow.total, month });
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { category_id, month, assigned } = await req.json();

  // Verify category belongs to vault
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
