import { z } from 'zod';

export const createProductSchema = z.object({
  name: z
    .string({ required_error: 'Product name is required' })
    .trim()
    .min(2, 'Product name must be at least 2 characters')
    .max(150, 'Product name must not exceed 150 characters'),
  brandName: z
    .string({ required_error: 'Brand name is required' })
    .trim()
    .min(1, 'Brand name is required')
    .max(100, 'Brand name must not exceed 100 characters'),
  manufacturerName: z
    .string({ required_error: 'Manufacturer name is required' })
    .trim()
    .min(1, 'Manufacturer name is required')
    .max(150, 'Manufacturer name must not exceed 150 characters'),
  categoryId: z
    .string({ required_error: 'Category ID is required' })
    .uuid('Invalid category ID format'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional(),
});

export const productQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val >= 1, { message: 'page must be a positive integer' }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, { message: 'limit must be between 1 and 100' }),
  search: z.string().trim().optional(),
  categoryId: z.string().uuid('Invalid category ID format').optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
