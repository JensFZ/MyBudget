import { SignJWT, jwtVerify } from 'jose';
import db from '@/lib/db';

function getSecret(): Uint8Array {
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get('jwt_secret') as { value: string };
  return new TextEncoder().encode(row.value);
}

export interface SessionPayload {
  userId: number;
  name: string;
  email: string;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as SessionPayload;
}

export function isSetupNeeded(): boolean {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return row.count === 0;
}

export function getJwtSecret(): string {
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get('jwt_secret') as { value: string };
  return row.value;
}
