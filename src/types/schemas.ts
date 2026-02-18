import { z } from 'zod';

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'explore', 'dashboard', 'badge',
  'manage-subscription', 'login', 'logout', 'privacy',
  'terms', 'u', 'proxy', 'cron', 'webhooks',
]);

export const SlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
  .refine((s) => !RESERVED_SLUGS.has(s), { message: 'This slug is reserved' });

export const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  slug: SlugSchema.optional(),
  tagline: z.string().max(255).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  donation_message: z.string().max(500).optional(),
  minimum_donation: z.number().min(1).max(1000).optional(),
  suggested_amounts: z.array(z.number().min(1).max(10000)).max(6).optional(),
  onboarding_completed: z.boolean().optional(),
});

export const CreatePaymentIntentSchema = z.object({
  amount: z.number().min(1).max(10000),  // USD
  recipientSlug: z.string().min(1),
  donorEmail: z.string().email().optional().nullable(),
  donorName: z.string().max(100).optional().nullable(),
  message: z.string().max(500).optional().nullable(),
  isAnonymous: z.boolean().default(false),
});

export const SlugCheckSchema = z.object({
  slug: SlugSchema,
});

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100).default('Default'),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type CreatePaymentIntentInput = z.infer<typeof CreatePaymentIntentSchema>;
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
