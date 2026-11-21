export const PRODUCT_CATEGORIES = Object.freeze([
  'Electronics',
  'Audio & Accessories',
  'Computers & Laptops',
  'Home & Kitchen',
  'Office Supplies',
  'Apparel & Footwear',
  'Sports & Outdoors',
  'Tools & Hardware',
  'Automotive',
  'Health & Personal Care',
]);

/**
 * Resolves a case-insensitive category input (e.g. "electronics")
 * to its canonical indexed value (e.g. "Electronics").
 * Returns null if the category does not match any valid entry.
 */
export const resolveCanonicalCategory = (input) => {
  if (!input || typeof input !== 'string') return null;
  const normalized = input.trim().toLowerCase();
  return (
    PRODUCT_CATEGORIES.find((cat) => cat.toLowerCase() === normalized) || null
  );
};