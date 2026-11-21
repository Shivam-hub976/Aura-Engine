const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Detects multi-segment SKU inputs (e.g. "AUR", "AUR-ELC", "AUR-ELC-00001", "SKU-1024")
// without misclassifying product words like "Noise-Canceling", "USB-C", or "2-in-1"
const SKU_PREFIX_PATTERN =
  /^(?:AUR(?:-[A-Z0-9]*)*|(?=[A-Z0-9-]*\d)[A-Z]{2,}-[A-Z0-9-]+)$/i;

/**
 * Builds an index-friendly MongoDB filter object from validated query parameters.
 */
export const buildInventoryFilter = ({ search, category, stockStatus } = {}) => {
  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (search) {
    if (SKU_PREFIX_PATTERN.test(search)) {
      // Case-sensitive anchored prefix regex utilizes the `sku_1` B-Tree index (IXSCAN)
      filter.sku = { $regex: `^${escapeRegex(search.toUpperCase())}` };
    } else {
      // Full-text search utilizes the weighted `idx_product_text_search` index
      filter.$text = { $search: search };
    }
  }

  if (stockStatus === 'OUT_OF_STOCK') {
    filter.stockQuantity = 0;
  } else if (stockStatus === 'LOW_STOCK') {
    filter.stockQuantity = { $gt: 0 };
    filter.$expr = { $lte: ['$stockQuantity', '$reorderLevel'] };
  } else if (stockStatus === 'IN_STOCK') {
    filter.$expr = { $gt: ['$stockQuantity', '$reorderLevel'] };
  }

  return filter;
};

/**
 * Converts a validated sort string (e.g. "-price" or "productName")
 * into a MongoDB sort specification aligned with our compound indexes.
 */
export const buildInventorySort = (sortParam = '-lastUpdated') => {
  const isDescending = sortParam.startsWith('-');
  const field = isDescending ? sortParam.slice(1) : sortParam;
  return { [field]: isDescending ? -1 : 1 };
};

/**
 * Computes stockStatus for plain `.lean()` documents (since lean skips virtuals).
 */
export const computeStockStatus = (stockQuantity, reorderLevel) => {
  if (stockQuantity === 0) return 'OUT_OF_STOCK';
  if (stockQuantity <= reorderLevel) return 'LOW_STOCK';
  return 'IN_STOCK';
};