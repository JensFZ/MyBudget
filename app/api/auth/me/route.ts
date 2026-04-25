import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifySession } from '@/lib/auth';

async function getSession(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  try { return await verifySession(token); } catch { return null; }
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = db.prepare('SELECT id, name, email, totp_enabled, avatar FROM users WHERE id = ?').get(session.userId) as
    | { id: number; name: string; email: string; totp_enabled: number; avatar: string | null }
    | undefined;
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    totpEnabled: user.totp_enabled === 1,
    avatar: user.avatar ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { name, email, avatar } = body;
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), session.userId);
  if (email) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.trim().toLowerCase(), session.userId);
  if (avatar !== undefined) db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, session.userId);
  return NextResponse.json({ ok: true });
}
