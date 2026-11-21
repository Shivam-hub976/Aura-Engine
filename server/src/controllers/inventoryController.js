import Product from '../models/Product.js';
import { PRODUCT_CATEGORIES } from '../constants/categories.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  buildInventoryFilter,
  buildInventorySort,
  computeStockStatus,
} from '../utils/queryBuilder.js';
import { invalidateAnalyticsCache } from '../utils/analyticsCache.js';

/**
 * Ensures consistent plain-object response shape across both `.lean()` reads
 * and Mongoose document writes.
 */
const formatProduct = (doc) => {
  const plain = typeof doc.toObject === 'function'
    ? doc.toObject({ virtuals: false })
    : doc;

  return {
    ...plain,
    stockStatus: computeStockStatus(plain.stockQuantity, plain.reorderLevel),
  };
};

/**
 * @desc    Return canonical supported categories
 * @route   GET /api/inventory/categories
 * @access  Public (MVP)
 */
export const getCategories = asyncHandler(async (_req, res) => {
  res.status(200).json({
    success: true,
    data: PRODUCT_CATEGORIES,
  });
});

/**
 * @desc    Fetch paginated, filtered, searched, and sorted inventory
 * @route   GET /api/inventory
 * @access  Public (MVP)
 */
export const getInventory = asyncHandler(async (req, res) => {
  const startTime = performance.now();

  const { page, limit, search, category, stockStatus, sort } =
    req.validatedQuery;

  const filter = buildInventoryFilter({ search, category, stockStatus });
  const sortSpec = buildInventorySort(sort);
  const skip = (page - 1) * limit;
  const isUnfiltered = Object.keys(filter).length === 0;

  const [products, totalRecords] = await Promise.all([
    Product.find(filter)
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .lean(),
    isUnfiltered
      ? Product.estimatedDocumentCount()
      : Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalRecords / limit);
  const queryTimeMs = Number((performance.now() - startTime).toFixed(2));

  res.status(200).json({
    success: true,
    data: products.map(formatProduct),
    pagination: {
      totalRecords,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1 && page <= totalPages,
    },
    meta: {
      queryTimeMs,
      appliedFilters: {
        search: search || null,
        category: category || null,
        stockStatus: stockStatus || null,
        sort,
      },
    },
  });
});

/**
 * @desc    Fetch a single product by MongoDB ObjectId
 * @route   GET /api/inventory/:id
 * @access  Public (MVP)
 */
export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams;
  const product = await Product.findById(id).lean();

  if (!product) {
    throw new AppError(`Product not found with id: ${id}`, 404);
  }

  res.status(200).json({
    success: true,
    data: formatProduct(product),
  });
});

/**
 * @desc    Create a new inventory SKU
 * @route   POST /api/inventory
 * @access  Public (MVP)
 */
export const createProduct = asyncHandler(async (req, res) => {
  const created = await Product.create({
    ...req.body,
    lastUpdated: new Date(),
  });
  invalidateAnalyticsCache();

  res.status(201).json({
    success: true,
    message: 'Product created successfully.',
    data: formatProduct(created),
  });
});

/**
 * @desc    Update an existing inventory SKU with cross-field business rule checks
 * @route   PUT /api/inventory/:id
 * @access  Public (MVP)
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams;
  const existing = await Product.findById(id);

  if (!existing) {
    throw new AppError(`Product not found with id: ${id}`, 404);
  }

  // Enforce price >= cost even on partial updates where only one field is supplied
  const effectivePrice = req.body.price ?? existing.price;
  const effectiveCost = req.body.cost ?? existing.cost;

  if (effectivePrice < effectiveCost) {
    const message = `Business rule violation: product price ($${effectivePrice.toFixed(2)}) cannot be lower than its cost ($${effectiveCost.toFixed(2)})`;
    throw new AppError(message, 400, [
      {
        field: req.body.price !== undefined ? 'price' : 'cost',
        message,
      },
    ]);
  }

  Object.assign(existing, req.body);
  existing.lastUpdated = new Date();
  await existing.save();
  invalidateAnalyticsCache();

  res.status(200).json({
    success: true,
    message: 'Product updated successfully.',
    data: formatProduct(existing),
  });
});

/**
 * @desc    Delete an inventory SKU by ID
 * @route   DELETE /api/inventory/:id
 * @access  Public (MVP)
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams;
  const deleted = await Product.findByIdAndDelete(id).lean();

  if (!deleted) {
    throw new AppError(`Product not found with id: ${id}`, 404);
  }
  invalidateAnalyticsCache();

  res.status(200).json({
    success: true,
    message: `Product "${deleted.sku}" deleted successfully.`,
    data: {
      _id: deleted._id,
      sku: deleted.sku,
      productName: deleted.productName,
    },
  });
});