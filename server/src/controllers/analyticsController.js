import Product from '../models/Product.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getCachedAnalytics,
  setCachedAnalytics,
} from '../utils/analyticsCache.js';

const EMPTY_OVERVIEW = {
  totalSkus: 0,
  totalCategories: 0,
  totalUnitsInStock: 0,
  totalValuation: 0,
  totalCostValue: 0,
  potentialProfit: 0,
  overallMarginPercent: 0,
  inStockCount: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  stockoutRatePercent: 0,
};

/**
 * @desc    Compute real-time inventory valuation, margins, and stock health via MongoDB Aggregation
 * @route   GET /api/analytics
 * @access  Public (MVP)
 */
export const getInventoryAnalytics = asyncHandler(async (req, res) => {
  const startTime = performance.now();
  const { category, refresh } = req.validatedQuery;
  const cacheKey = category || 'ALL';

  if (!refresh) {
    const cached = getCachedAnalytics(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        meta: {
          aggregationTimeMs: Number((performance.now() - startTime).toFixed(2)),
          filteredCategory: cacheKey,
          cacheStatus: 'HIT',
          generatedAt: new Date().toISOString(),
        },
      });
    }
  }

  // Stage 1: $match aligns directly with `idx_analytics_covered` prefix (`category: 1`)
  const matchStage = category
    ? { category }
    : { category: { $exists: true } };

  const pipeline = [
    { $match: matchStage },

    // Stage 2: Single-pass $group over covered index entries (zero document disk fetches)
    {
      $group: {
        _id: '$category',
        skuCount: { $sum: 1 },
        totalUnits: { $sum: '$stockQuantity' },
        totalValuation: { $sum: {$multiply: ['$price', '$stockQuantity'] } },
        totalCostValue: { $sum: {$multiply: ['$cost', '$stockQuantity'] } },
        avgPrice: { $avg: '$price' },
        outOfStockCount: {
          $sum: {$cond: [{ $eq: ['$stockQuantity', 0] }, 1, 0] },
        },
        lowStockCount: {
          $sum: {$cond: [
              {
                $and: [
                  { $gt: ['$stockQuantity', 0] }, {$lte: ['$stockQuantity', '$reorderLevel'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        inStockCount: {
          $sum: { $cond: [{$gt: ['$stockQuantity', '$reorderLevel'] }, 1, 0] },
        },
      },
    },

    // Stage 3: $project shapes chart-ready metrics with rounding & divide-by-zero guards
    {
      $project: {
        _id: 0,
        category: '$_id',
        skuCount: 1,
        totalUnits: 1,
        totalValuation: { $round: ['$totalValuation', 2] },
        totalCostValue: { $round: ['$totalCostValue', 2] },
        potentialProfit: {
          $round: [{$subtract: ['$totalValuation', '$totalCostValue'] }, 2],
        },
        grossMarginPercent: {
          $round: [
            {
              $cond: [
                { $gt: ['$totalValuation', 0] }, {$multiply: [
                    {
                      $divide: [
                        { $subtract: ['$totalValuation', '$totalCostValue'] },
                        '$totalValuation',
                      ],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
            2,
          ],
        },
        averagePrice: { $round: ['$avgPrice', 2] },
        inStockCount: 1,
        lowStockCount: 1,
        outOfStockCount: 1,
        stockoutRiskRate: {
          $round: [
            {
              $cond: [
                { $gt: ['$skuCount', 0] }, {$multiply: [
                    {
                      $divide: [
                        { $add: ['$outOfStockCount', '$lowStockCount'] },
                        '$skuCount',
                      ],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
            2,
          ],
        },
      },
    },

    // Stage 4: $facet operates on <= 10 category summaries to build chart series + global KPIs
    {
      $facet: {
        categoryBreakdown: [{ $sort: { totalValuation: -1 } }],
        overview: [
          {
            $group: {
              _id: null,
              totalSkus: { $sum: '$skuCount' },
              totalCategories: { $sum: 1 },
              totalUnitsInStock: { $sum: '$totalUnits' },
              totalValuation: { $sum: '$totalValuation' },
              totalCostValue: { $sum: '$totalCostValue' },
              inStockCount: { $sum: '$inStockCount' },
              lowStockCount: { $sum: '$lowStockCount' },
              outOfStockCount: { $sum: '$outOfStockCount' },
            },
          },
          {
            $project: {
              _id: 0,
              totalSkus: 1,
              totalCategories: 1,
              totalUnitsInStock: 1,
              totalValuation: { $round: ['$totalValuation', 2] },
              totalCostValue: { $round: ['$totalCostValue', 2] },
              potentialProfit: {
                $round: [
                  { $subtract: ['$totalValuation', '$totalCostValue'] },
                  2,
                ],
              },
              overallMarginPercent: {
                $round: [
                  {
                    $cond: [
                      { $gt: ['$totalValuation', 0] }, {$multiply: [
                          {
                            $divide: [
                              {
                                $subtract: [
                                  '$totalValuation',
                                  '$totalCostValue',
                                ],
                              },
                              '$totalValuation',
                            ],
                          },
                          100,
                        ],
                      },
                      0,
                    ],
                  },
                  2,
                ],
              },
              inStockCount: 1,
              lowStockCount: 1,
              outOfStockCount: 1,
              stockoutRatePercent: {
                $round: [
                  {
                    $cond: [
                      { $gt: ['$totalSkus', 0] }, {$multiply: [
                          { $divide: ['$outOfStockCount', '$totalSkus'] },
                          100,
                        ],
                      },
                      0,
                    ],
                  },
                  2,
                ],
              },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Product.aggregate(pipeline);
  const categoryBreakdown = result?.categoryBreakdown || [];
  const overview = result?.overview?.[0] || EMPTY_OVERVIEW;

  const stockHealthDistribution = [
    {
      status: 'IN_STOCK',
      label: 'In Stock',
      count: overview.inStockCount,
      percentage:
        overview.totalSkus > 0
          ? Number(((overview.inStockCount / overview.totalSkus) * 100).toFixed(2))
          : 0,
    },
    {
      status: 'LOW_STOCK',
      label: 'Low Stock (Reorder Alert)',
      count: overview.lowStockCount,
      percentage:
        overview.totalSkus > 0
          ? Number(((overview.lowStockCount / overview.totalSkus) * 100).toFixed(2))
          : 0,
    },
    {
      status: 'OUT_OF_STOCK',
      label: 'Out of Stock',
      count: overview.outOfStockCount,
      percentage:
        overview.totalSkus > 0
          ? Number(((overview.outOfStockCount / overview.totalSkus) * 100).toFixed(2))
          : 0,
    },
  ];

  const data = {
    overview,
    stockHealthDistribution,
    categoryBreakdown,
  };

  setCachedAnalytics(cacheKey, data);

  const aggregationTimeMs = Number((performance.now() - startTime).toFixed(2));

  res.status(200).json({
    success: true,
    data,
    meta: {
      aggregationTimeMs,
      filteredCategory: cacheKey,
      cacheStatus: 'MISS',
      generatedAt: new Date().toISOString(),
    },
  });
});