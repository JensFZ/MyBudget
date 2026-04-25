import { NextResponse } from 'next/server';
import { isSetupNeeded } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ setupNeeded: isSetupNeeded() });
}
