import { z } from 'zod';
import {
  PRODUCT_CATEGORIES,
  resolveCanonicalCategory,
} from '../constants/categories.js';

export const ALLOWED_SORT_FIELDS = Object.freeze([
  'price',
  '-price',
  'cost',
  '-cost',
  'stockQuantity',
  '-stockQuantity',
  'productName',
  '-productName',
  'sku',
  '-sku',
  'lastUpdated',
  '-lastUpdated',
]);

const categorySchema = z
  .string()
  .trim()
  .min(1, 'Category is required')
  .transform((val, ctx) => {
    const canonical = resolveCanonicalCategory(val);
    if (!canonical) {
      ctx.addIssue({
        code: 'custom',
        message: `Invalid category "${val}". Allowed values: ${PRODUCT_CATEGORIES.join(', ')}`,
      });
      return z.NEVER;
    }
    return canonical;
  });

const skuSchema = z
  .string()
  .trim()
  .min(3, 'SKU must be at least 3 characters')
  .max(40, 'SKU cannot exceed 40 characters')
  .transform((val) => val.toUpperCase())
  .refine((val) => /^[A-Z0-9_-]+$/.test(val), {
    message: 'SKU may only contain uppercase letters, numbers, hyphens, and underscores',
  });

const productNameSchema = z
  .string()
  .trim()
  .min(2, 'Product name must be at least 2 characters')
  .max(160, 'Product name cannot exceed 160 characters');

const priceSchema = z
  .number()
  .finite('Price must be a valid finite number')
  .min(0, 'Price cannot be negative')
  .transform((val) => Number(val.toFixed(2)));

const costSchema = z
  .number()
  .finite('Cost must be a valid finite number')
  .min(0, 'Cost cannot be negative')
  .transform((val) => Number(val.toFixed(2)));

const stockQuantitySchema = z
  .number()
  .int('Stock quantity must be a whole integer')
  .min(0, 'Stock quantity cannot be negative');

const reorderLevelSchema = z
  .number()
  .int('Reorder level must be a whole integer')
  .min(0, 'Reorder level cannot be negative');

/**
 * POST /api/inventory — Strict creation contract
 */
export const createProductSchema = z
  .object({
    productName: productNameSchema,
    sku: skuSchema,
    category: categorySchema,
    price: priceSchema,
    cost: costSchema,
    stockQuantity: stockQuantitySchema,
    reorderLevel: reorderLevelSchema.default(15),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.price < data.cost) {
      ctx.addIssue({
        code: 'custom',
        path: ['price'],
        message: `Business rule violation: product price ($${data.price.toFixed(2)}) cannot be lower than its cost ($${data.cost.toFixed(2)})`,
      });
    }
  });

/**
 * PUT /api/inventory/:id — Supports full or partial updates.
 * Note: When only one of `price` or `cost` is sent, the controller also
 * cross-checks against the existing database record to prevent rule bypass.
 */
export const updateProductSchema = z
  .object({
    productName: productNameSchema.optional(),
    sku: skuSchema.optional(),
    category: categorySchema.optional(),
    price: priceSchema.optional(),
    cost: costSchema.optional(),
    stockQuantity: stockQuantitySchema.optional(),
    reorderLevel: reorderLevelSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: [],
        message: 'Update payload must include at least one valid field',
      });
      return;
    }

    if (
      typeof data.price === 'number' &&
      typeof data.cost === 'number' &&
      data.price < data.cost
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['price'],
        message: `Business rule violation: product price ($${data.price.toFixed(2)}) cannot be lower than its cost ($${data.cost.toFixed(2)})`,
      });
    }
  });

/**
 * Route param validation for /:id endpoints
 */
export const objectIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID format'),
});

/**
 * GET /api/inventory — Query string validation & safety caps
 */
export const inventoryQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100 records per request')
    .default(50),
  search: z
    .string()
    .trim()
    .max(100, 'Search query cannot exceed 100 characters')
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  category: z
    .string()
    .trim()
    .optional()
    .transform((val, ctx) => {
      if (!val || val.toLowerCase() === 'all') return undefined;
      const canonical = resolveCanonicalCategory(val);
      if (!canonical) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid category filter "${val}". Allowed values: ${PRODUCT_CATEGORIES.join(', ')}`,
        });
        return z.NEVER;
      }
      return canonical;
    }),
  stockStatus: z
    .string()
    .trim()
    .optional()
    .transform((val, ctx) => {
      if (!val || val.toLowerCase() === 'all') return undefined;
      const normalized = val.toUpperCase();
      const allowed = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'];
      if (!allowed.includes(normalized)) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid stockStatus "${val}". Allowed values: ${allowed.join(', ')}`,
        });
        return z.NEVER;
      }
      return normalized;
    }),
  sort: z
    .string()
    .trim()
    .default('-lastUpdated')
    .refine((val) => ALLOWED_SORT_FIELDS.includes(val), {
      message: `Invalid sort option. Allowed values: ${ALLOWED_SORT_FIELDS.join(', ')}`,
    }),
});