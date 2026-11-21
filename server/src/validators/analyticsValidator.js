import { z } from 'zod';
import {
  PRODUCT_CATEGORIES,
  resolveCanonicalCategory,
} from '../constants/categories.js';

export const analyticsQuerySchema = z.object({
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
  refresh: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});