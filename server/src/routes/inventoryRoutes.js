import { Router } from 'express';
import {
  getCategories,
  getInventory,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/inventoryController.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createProductSchema,
  updateProductSchema,
  objectIdParamSchema,
  inventoryQuerySchema,
} from '../validators/inventoryValidator.js';

const router = Router();

router.get('/categories', getCategories);

router
  .route('/')
  .get(validateRequest({ query: inventoryQuerySchema }), getInventory)
  .post(validateRequest({ body: createProductSchema }), createProduct);

router
  .route('/:id')
  .get(validateRequest({ params: objectIdParamSchema }), getProductById)
  .put(
    validateRequest({
      params: objectIdParamSchema,
      body: updateProductSchema,
    }),
    updateProduct
  )
  .delete(validateRequest({ params: objectIdParamSchema }), deleteProduct);

export default router;