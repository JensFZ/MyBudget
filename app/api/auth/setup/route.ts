import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { signSession, isSetupNeeded } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!isSetupNeeded()) {
    return NextResponse.json({ error: 'Already set up' }, { status: 400 });
  }

  const { name, email, password } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password too short' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  const user = db.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id, name, email'
  ).get(name.trim(), email.trim().toLowerCase(), hash) as { id: number; name: string; email: string };

  // Create personal vault for new user
  const vaultName = `${user.name}s Budget`;
  const vaultId = db.prepare('INSERT INTO vaults (name) VALUES (?)').run(vaultName).lastInsertRowid;
  db.prepare('INSERT INTO vault_members (vault_id, user_id, role) VALUES (?, ?, ?)').run(vaultId, user.id, 'owner');

  const token = await signSession({ userId: user.id, name: user.name, email: user.email });

  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
  res.cookies.set('vault_id', String(vaultId), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
