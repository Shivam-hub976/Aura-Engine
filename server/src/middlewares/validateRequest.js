import { AppError } from '../utils/AppError.js';
import { sanitizePayload } from '../utils/sanitize.js';

const formatZodIssues = (issues) =>
  issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'payload',
    message: issue.message,
  }));

/**
 * Reusable Express middleware factory for request sanitization + Zod validation.
 * Usage: validateRequest({ body: createProductSchema, params: objectIdParamSchema })
 */
export const validateRequest = ({ body, query, params } = {}) => {
  return (req, _res, next) => {
    const collectedErrors = [];

    if (params) {
      const sanitizedParams = sanitizePayload(req.params);
      const parsed = params.safeParse(sanitizedParams);
      if (!parsed.success) {
        collectedErrors.push(...formatZodIssues(parsed.error.issues));
      } else {
        req.validatedParams = parsed.data;
      }
    }

    if (query) {
      const sanitizedQuery = sanitizePayload(req.query);
      const parsed = query.safeParse(sanitizedQuery);
      if (!parsed.success) {
        collectedErrors.push(...formatZodIssues(parsed.error.issues));
      } else {
        req.validatedQuery = parsed.data;
      }
    }

    if (body) {
      const sanitizedBody = sanitizePayload(req.body ?? {});
      const parsed = body.safeParse(sanitizedBody);
      if (!parsed.success) {
        collectedErrors.push(...formatZodIssues(parsed.error.issues));
      } else {
        req.body = parsed.data;
      }
    }

    if (collectedErrors.length > 0) {
      const primaryMessage =
        collectedErrors.length === 1
          ? collectedErrors[0].message
          : `Validation failed with ${collectedErrors.length} error(s): ${collectedErrors[0].message}`;

      return next(new AppError(primaryMessage, 400, collectedErrors));
    }

    return next();
  };
};