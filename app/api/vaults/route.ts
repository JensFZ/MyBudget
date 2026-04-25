import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifySession } from '@/lib/auth';

async function getUserId(req: NextRequest): Promise<number | null> {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  try { return (await verifySession(token)).userId; } catch { return null; }
}

// GET /api/vaults — list all vaults the current user belongs to
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const vaults = db.prepare(`
    SELECT v.id, v.name, vm.role, v.created_at
    FROM vaults v
    JOIN vault_members vm ON vm.vault_id = v.id
    WHERE vm.user_id = ?
    ORDER BY vm.joined_at ASC
  `).all(userId);

  return NextResponse.json(vaults);
}

// POST /api/vaults — create a new vault, set vault_id cookie
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const vaultId = db.prepare('INSERT INTO vaults (name) VALUES (?)').run(name.trim()).lastInsertRowid;
  db.prepare('INSERT INTO vault_members (vault_id, user_id, role) VALUES (?, ?, ?)').run(vaultId, userId, 'owner');

  const res = NextResponse.json({ id: vaultId, name: name.trim() });
  res.cookies.set('vault_id', String(vaultId), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
