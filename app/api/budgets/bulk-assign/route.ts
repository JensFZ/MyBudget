import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { resolveVault } from '@/lib/vault';

type Source = 'last_assigned' | 'avg_assigned' | 'last_spent' | 'avg_spent';
type Scope = 'all' | 'unfunded';

function prevMonths(month: string, count: number): string[] {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (i + 1), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveVault(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month, source, scope } = await req.json() as { month: string; source: Source; scope: Scope };

  const [pm1, pm2, pm3] = prevMonths(month, 3);

  // All non-hidden categories for this vault
  const categories = db.prepare(`
    SELECT c.id FROM categories c
    JOIN category_groups cg ON c.group_id = cg.id
    WHERE cg.vault_id = ? AND c.is_hidden = 0 AND cg.is_hidden = 0
  `).all(ctx.vaultId) as { id: number }[];

  if (categories.length === 0) return NextResponse.json({ updated: 0 });
  const allIds = categories.map(c => c.id);
  const ph = (n: number) => Array(n).fill('?').join(',');

  // Scope filter
  let targetIds = allIds;
  if (scope === 'unfunded') {
    const assigned = db.prepare(
      `SELECT category_id FROM budgets WHERE month = ? AND assigned > 0 AND category_id IN (${ph(allIds.length)})`
    ).all(month, ...allIds) as { category_id: number }[];
    const funded = new Set(assigned.map(r => r.category_id));
    targetIds = allIds.filter(id => !funded.has(id));
  }

  if (targetIds.length === 0) return NextResponse.json({ updated: 0 });
  const tph = ph(targetIds.length);

  // Compute reference values per category
  const valueMap = new Map<number, number>();

  if (source === 'last_assigned') {
    const rows = db.prepare(
      `SELECT category_id, assigned FROM budgets WHERE month = ? AND category_id IN (${tph})`
    ).all(pm1, ...targetIds) as { category_id: number; assigned: number }[];
    for (const r of rows) valueMap.set(r.category_id, r.assigned);

  } else if (source === 'avg_assigned') {
    const rows = db.prepare(
      `SELECT category_id, AVG(assigned) AS avg FROM budgets
       WHERE month IN (${ph(3)}) AND category_id IN (${tph})
       GROUP BY category_id`
    ).all(pm1, pm2, pm3, ...targetIds) as { category_id: number; avg: number }[];
    for (const r of rows) valueMap.set(r.category_id, Math.round(r.avg * 100) / 100);

  } else if (source === 'last_spent') {
    const rows = db.prepare(
      `SELECT t.category_id, ABS(SUM(t.amount)) AS spent
       FROM transactions t
       JOIN accounts a ON t.account_id = a.id
       WHERE t.date >= ? AND t.date < ?
         AND t.amount < 0
         AND a.vault_id = ?
         AND t.category_id IN (${tph})
       GROUP BY t.category_id`
    ).all(`${pm1}-01`, `${month}-01`, ctx.vaultId, ...targetIds) as { category_id: number; spent: number }[];
    for (const r of rows) valueMap.set(r.category_id, Math.round(r.spent * 100) / 100);

  } else {
    // avg_spent: average of monthly outflow across last 3 months
    const rows = db.prepare(
      `SELECT category_id, AVG(ABS(monthly)) AS avg FROM (
         SELECT t.category_id, strftime('%Y-%m', t.date) AS m, SUM(t.amount) AS monthly
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE strftime('%Y-%m', t.date) IN (${ph(3)})
           AND t.amount < 0
           AND a.vault_id = ?
           AND t.category_id IN (${tph})
         GROUP BY t.category_id, m
       ) GROUP BY category_id`
    ).all(pm1, pm2, pm3, ctx.vaultId, ...targetIds) as { category_id: number; avg: number }[];
    for (const r of rows) valueMap.set(r.category_id, Math.round(r.avg * 100) / 100);
  }

  const upsert = db.prepare(
    `INSERT INTO budgets (category_id, month, assigned) VALUES (?, ?, ?)
     ON CONFLICT(category_id, month) DO UPDATE SET assigned = excluded.assigned`
  );

  let updated = 0;
  db.transaction(() => {
    for (const id of targetIds) {
      const value = valueMap.get(id) ?? 0;
      if (value > 0) { upsert.run(id, month, value); updated++; }
    }
  })();

  return NextResponse.json({ updated });
}
