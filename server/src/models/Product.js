import mongoose from 'mongoose';
import { PRODUCT_CATEGORIES } from '../constants/categories.js';

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [160, 'Product name cannot exceed 160 characters'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true, // Automatically creates a unique B-tree index on sku
      trim: true,
      uppercase: true,
      maxlength: [40, 'SKU cannot exceed 40 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      enum: {
        values: PRODUCT_CATEGORIES,
        message: 'Category "{VALUE}" is not supported',
      },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    cost: {
      type: Number,
      required: [true, 'Cost is required'],
      min: [0, 'Cost cannot be negative'],
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Stock quantity must be a whole integer',
      },
    },
    reorderLevel: {
      type: Number,
      required: [true, 'Reorder level is required'],
      min: [0, 'Reorder level cannot be negative'],
      default: 15,
      validate: {
        validator: Number.isInteger,
        message: 'Reorder level must be a whole integer',
      },
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual stock status helper for API consumers (not persisted in DB)
productSchema.virtual('stockStatus').get(function () {
  if (this.stockQuantity === 0) return 'OUT_OF_STOCK';
  if (this.stockQuantity <= this.reorderLevel) return 'LOW_STOCK';
  return 'IN_STOCK';
});

// Defense-in-depth business rule on document creation/save (primary enforcement in Zod middleware)
productSchema.pre('validate', function () {
  if (
    typeof this.price === 'number' &&
    typeof this.cost === 'number' &&
    this.price < this.cost
  ) {
    this.invalidate(
      'price',
      `Product price (${this.price}) cannot be lower than its cost (${this.cost})`
    );
  }
});

// Automatically refresh lastUpdated when a document is modified
productSchema.pre('save', async function () {
  if (this.isModified() && !this.isModified('lastUpdated')) {
    this.lastUpdated = new Date();
  }
});

productSchema.pre('findOneAndUpdate', async function () {
  this.set({ lastUpdated: new Date() });
});

// --- Performance Indexes ---
// 1. Unique index on `sku` is already declared via `unique: true` above.
// 2. Compound ESR index for category filtering + price sorting (and category aggregations)
productSchema.index({ category: 1, price: -1 }, { name: 'idx_category_price' });

// 3. B-Tree index on productName for alphabetical sorting and prefix lookups
productSchema.index({ productName: 1 }, { name: 'idx_product_name' });

// 4. Weighted Full-Text index for sub-50ms keyword search across 50,000 SKUs
productSchema.index(
  { productName: 'text', sku: 'text' },
  {
    name: 'idx_product_text_search',
    weights: { sku: 10, productName: 5 },
  }
);

// 5. Default sort index for newest-updated pagination
productSchema.index({ lastUpdated: -1 }, { name: 'idx_last_updated' });

// 6. Covered index for GET /api/analytics aggregation (avoids disk document fetches)
productSchema.index(
  { category: 1, price: 1, cost: 1, stockQuantity: 1, reorderLevel: 1 },
  { name: 'idx_analytics_covered' }
);

const Product = mongoose.model('Product', productSchema);

export default Product;