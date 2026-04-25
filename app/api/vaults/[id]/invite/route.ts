import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { hasVaultAccess } from '@/lib/vault';

async function getUserId(req: NextRequest): Promise<number | null> {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  try { return (await verifySession(token)).userId; } catch { return null; }
}

// POST /api/vaults/[id]/invite — generate invite link
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const vaultId = parseInt(id, 10);
  if (!hasVaultAccess(userId, vaultId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO vault_invites (vault_id, invited_by, token, expires_at) VALUES (?, ?, ?, ?)'
  ).run(vaultId, userId, token, expiresAt);

  const origin = req.headers.get('origin') ?? `http://localhost:3000`;
  return NextResponse.json({ token, link: `${origin}/join?token=${token}` });
}
