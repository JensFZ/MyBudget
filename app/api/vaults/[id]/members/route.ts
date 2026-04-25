import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { hasVaultAccess } from '@/lib/vault';

async function getUserId(req: NextRequest): Promise<number | null> {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  try { return (await verifySession(token)).userId; } catch { return null; }
}

// GET /api/vaults/[id]/members
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const vaultId = parseInt(id, 10);
  if (!hasVaultAccess(userId, vaultId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, vm.role, vm.joined_at
    FROM vault_members vm
    JOIN users u ON u.id = vm.user_id
    WHERE vm.vault_id = ?
    ORDER BY vm.role DESC, vm.joined_at ASC
  `).all(vaultId);

  return NextResponse.json(members);
}

// DELETE /api/vaults/[id]/members?userId=X — remove a member (owner only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const vaultId = parseInt(id, 10);

  const isOwner = db.prepare(
    "SELECT 1 FROM vault_members WHERE vault_id = ? AND user_id = ? AND role = 'owner'"
  ).get(vaultId, userId);
  if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const targetId = parseInt(new URL(req.url).searchParams.get('userId') ?? '', 10);
  if (!targetId || targetId === userId) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  db.prepare('DELETE FROM vault_members WHERE vault_id = ? AND user_id = ?').run(vaultId, targetId);
  return NextResponse.json({ ok: true });
}
