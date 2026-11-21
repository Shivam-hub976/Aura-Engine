import { Router } from 'express';
import { getInventoryAnalytics } from '../controllers/analyticsController.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { analyticsQuerySchema } from '../validators/analyticsValidator.js';

const router = Router();

router.get(
  '/',
  validateRequest({ query: analyticsQuerySchema }),
  getInventoryAnalytics
);

export default router;