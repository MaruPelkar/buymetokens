import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { SlugSchema } from '@/types/schemas';

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug') ?? '';

  const parsed = SlugSchema.safeParse(slug);
  if (!parsed.success) {
    return NextResponse.json({
      available: false,
      valid: false,
      error: parsed.error.errors[0]?.message ?? 'Invalid slug',
    });
  }

  const result = await query('SELECT 1 FROM profiles WHERE slug = $1', [slug]);
  return NextResponse.json({ available: result.rows.length === 0, valid: true });
}
