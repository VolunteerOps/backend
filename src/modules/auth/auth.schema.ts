import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2, 'Full name is required'),
  role: z.enum(['SUPER_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER', 'admin', 'volunteer']).default('VOLUNTEER'),
  phone_number: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone_number: z.string().optional(),
  avatar_url: z.string().url().optional(),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
  refresh_token: z.string().optional(),
});

