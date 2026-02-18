import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import pool from '@/lib/db/client';
import { z } from 'zod';

const updateProfileSchema = z.object({
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/).optional(),
  bio: z.string().max(500).optional(),
  tagline: z.string().max(255).optional(),
  social_links: z
    .object({
      twitter: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      website: z.string().url().optional(),
      youtube: z.string().url().optional(),
    })
    .optional(),
  donation_message: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const session = await requireAuth();

    const result = await pool.query(
      `SELECT p.*, u.github_username, u.avatar_url, u.display_name
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1`,
      [session.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = updateProfileSchema.parse(body);

    // Check if slug is already taken (if changing slug)
    if (validatedData.slug) {
      const slugCheck = await pool.query(
        'SELECT id FROM profiles WHERE slug = $1 AND user_id != $2',
        [validatedData.slug, session.userId]
      );

      if (slugCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'Slug already taken' },
          { status: 400 }
        );
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (validatedData.slug !== undefined) {
      updateFields.push(`slug = $${paramIndex++}`);
      updateValues.push(validatedData.slug);
    }

    if (validatedData.bio !== undefined) {
      updateFields.push(`bio = $${paramIndex++}`);
      updateValues.push(validatedData.bio);
      updateFields.push(`bio_edited = true`);
    }

    if (validatedData.tagline !== undefined) {
      updateFields.push(`tagline = $${paramIndex++}`);
      updateValues.push(validatedData.tagline);
    }

    if (validatedData.social_links !== undefined) {
      updateFields.push(`social_links = $${paramIndex++}`);
      updateValues.push(JSON.stringify(validatedData.social_links));
    }

    if (validatedData.donation_message !== undefined) {
      updateFields.push(`donation_message = $${paramIndex++}`);
      updateValues.push(validatedData.donation_message);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updateValues.push(session.userId);

    const result = await pool.query(
      `UPDATE profiles
       SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    // Mark onboarding as completed if this is first update
    await pool.query(
      'UPDATE users SET onboarding_completed = true WHERE id = $1',
      [session.userId]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
