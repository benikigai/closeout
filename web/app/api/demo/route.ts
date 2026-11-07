import { NextResponse } from 'next/server';
import { cases, compare, verifyHeldout, type CaseName } from '@/server/firmware';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !['compare', 'cheat', 'heldout'].includes(body.action)) {
    return NextResponse.json({ error: 'Choose compare, cheat, or heldout.' }, { status: 400 });
  }
  try {
    if (body.action === 'heldout') return NextResponse.json(await verifyHeldout());
    if (body.action === 'cheat') {
      const result = await compare('defective');
      const escapes = result.fixed.uniformity < .24;
      return NextResponse.json({ ...result, attempted_limit: .24, required_limit: .05,
        physical_defect_would_pass: escapes, decision: escapes ? 'blocked_cheat' : 'allowed' });
    }
    if (typeof body.case !== 'string' || !Object.hasOwn(cases, body.case)) {
      return NextResponse.json({ error: 'Unknown unit case.' }, { status: 400 });
    }
    return NextResponse.json(await compare(body.case as CaseName));
  } catch (error) {
    console.error('Firmware demo failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'The firmware run failed. No passing result was recorded.' }, { status: 500 });
  }
}
