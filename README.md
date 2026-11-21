# Aura Enterprise Engine

**Aura Enterprise Engine** is a high-throughput inventory and real-time analytics API built with Node.js, Express, and MongoDB. It supports indexed search and filtering across 50,000+ retail SKUs, server-side pagination, inventory CRUD, and MongoDB aggregation-based analytics.

## Features

- Indexed search across product names and SKUs
- Category, stock-status, and whitelisted sorting filters
- Server-side pagination with configurable limits
- Strict Zod request validation
- Recursive XSS and NoSQL injection sanitization
- MongoDB-backed inventory analytics
- Covered-index aggregation and write-invalidated caching
- Graceful server startup and shutdown

## Technology Stack

| Area        | Technology                                 |
| ----------- | ------------------------------------------ |
| Runtime     | Node.js with ES modules                    |
| Framework   | Express 5                                  |
| Database    | MongoDB Atlas                              |
| ODM         | Mongoose 9                                 |
| Validation  | Zod 4                                      |
| Security    | Helmet and CORS                            |
| Performance | Gzip compression and TTL analytics caching |
| Logging     | Morgan                                     |
| Test data   | Faker                                      |

## Project Structure

```text
aura-engine/
├── Prompts.md
├── README.md
└── server/
    ├── scripts/
    │   └── seed.js
    └── src/
        ├── config/       # Environment validation and database configuration
        ├── constants/    # Canonical product categories
        ├── controllers/  # Inventory and analytics business logic
        ├── middlewares/  # Validation, sanitization, and error handling
        ├── models/       # Product schema and MongoDB indexes
        ├── routes/       # Express route definitions
        ├── utils/        # Query builder, cache, and shared helpers
        ├── validators/   # Zod schemas
        ├── app.js        # Express application setup
        └── server.js     # Server bootstrap and shutdown handling
```

## Database Indexing

The Product collection uses six purpose-built indexes to avoid collection scans and in-memory sorting.

| Index                     | Keys                                                                    | Purpose                                                                    |
| ------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `sku_1`                   | `{ sku: 1 }` (unique)                                                   | Enforces SKU uniqueness and accelerates anchored SKU prefix searches       |
| `idx_category_price`      | `{ category: 1, price: -1 }`                                            | Supports category filtering and descending price sorting                   |
| `idx_product_name`        | `{ productName: 1 }`                                                    | Accelerates alphabetical product sorting                                   |
| `idx_product_text_search` | `{ productName: "text", sku: "text" }`                                  | Supports full-text search with SKU weight `10` and product-name weight `5` |
| `idx_last_updated`        | `{ lastUpdated: -1 }`                                                   | Optimizes newest-first pagination                                          |
| `idx_analytics_covered`   | `{ category: 1, price: 1, cost: 1, stockQuantity: 1, reorderLevel: 1 }` | Supports covered inventory aggregations                                    |

## API Reference

### Service

| Method | Endpoint      | Description                                    |
| ------ | ------------- | ---------------------------------------------- |
| `GET`  | `/`           | API metadata and available endpoint map        |
| `GET`  | `/api/health` | Database state, environment, and server uptime |

### Inventory

| Method   | Endpoint                    | Description                            |
| -------- | --------------------------- | -------------------------------------- |
| `GET`    | `/api/inventory`            | Search and list inventory              |
| `GET`    | `/api/inventory/categories` | List supported categories              |
| `GET`    | `/api/inventory/:id`        | Retrieve a product by MongoDB ObjectId |
| `POST`   | `/api/inventory`            | Create a product                       |
| `PUT`    | `/api/inventory/:id`        | Perform a full or partial update       |
| `DELETE` | `/api/inventory/:id`        | Delete a product                       |

#### Inventory Query Parameters

| Parameter     | Default        | Description                                                                                                                                           |
| ------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`        | `1`            | Page number                                                                                                                                           |
| `limit`       | `50`           | Page size; maximum `100`                                                                                                                              |
| `search`      | —              | Search by product name or SKU                                                                                                                         |
| `category`    | —              | Filter by canonical category                                                                                                                          |
| `stockStatus` | —              | `IN_STOCK`, `LOW_STOCK`, or `OUT_OF_STOCK`                                                                                                            |
| `sort`        | `-lastUpdated` | `price`, `-price`, `cost`, `-cost`, `stockQuantity`, `-stockQuantity`, `productName`, `-productName`, `sku`, `-sku`, `lastUpdated`, or `-lastUpdated` |

Example:

```http
GET /api/inventory?page=1&limit=50&search=audio&category=electronics&sort=-price
```

### Validation Rules

The API returns `400 Bad Request` when a payload violates a business rule:

- `price` cannot be lower than `cost`.
- `stockQuantity` and `reorderLevel` cannot be negative.
- `stockQuantity` and `reorderLevel` must be whole integers.
- A duplicate `sku` returns `409 Conflict`.

Partial updates are validated against the existing database record, so cross-field rules remain intact when only `price` or `cost` is supplied.

### Analytics

| Method | Endpoint         | Description                                         |
| ------ | ---------------- | --------------------------------------------------- |
| `GET`  | `/api/analytics` | Compute global and category-level inventory metrics |

The aggregation pipeline calculates:

- Total inventory valuation
- Cost basis
- Gross margin
- Stock-health distribution
- Category-level valuation
- Stockout-risk metrics

#### Analytics Query Parameters

| Parameter  | Default | Description                                     |
| ---------- | ------- | ----------------------------------------------- |
| `category` | —       | Restrict analytics to one category              |
| `refresh`  | `false` | Set to `true` to bypass the 60-second TTL cache |

Example:

```http
GET /api/analytics?refresh=true&category=electronics
```

## Performance

Verified with approximately 50,000 SKUs on MongoDB Atlas:

| Endpoint  | Query                                                            | Measured Latency |
| --------- | ---------------------------------------------------------------- | ---------------- |
| Inventory | `?page=1&limit=50&search=audio&category=electronics&sort=-price` | 113.37 ms        |
| Inventory | `?search=laptop&limit=5`                                         | 188.56 ms        |
| Inventory | `?search=AUR-ELC-00001`                                          | 139.44 ms        |
| Analytics | `Full 50k aggregation, uncached`                                 | 290.61 ms        |
| Analytics | `Category drill-down: category=electronics`                      | 297.78 ms        |
| Analytics | `Write-invalidated cache hit`                                    | 0.29 ms          |

## Local Setup

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Configure the environment

Copy the environment template:

```bash
cp .env.example .env
```

Configure these variables in `.env`:

| Variable      | Description                     | Example                                                 |
| ------------- | ------------------------------- | ------------------------------------------------------- |
| `NODE_ENV`    | Runtime environment             | `development`                                           |
| `PORT`        | HTTP server port                | `5000`                                                  |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://<user>:<password>@<cluster>/aura_engine` |
| `CORS_ORIGIN` | Allowed frontend origin         | `http://localhost:5173`                                 |

### 3. Seed the database

```bash
npm run seed
```

The seeder creates 50,000 realistic SKUs using batched bulk writes.

To remove the seeded product collection, run:

```bash
npm run seed:destroy
```

### 4. Start the server

```bash
npm run dev
```

For a production-style process:

```bash
npm start
```

## npm Scripts

| Script                  | Command                |
| ----------------------- | ---------------------- |
| Development             | `npm run dev`          |
| Production              | `npm start`            |
| Seed 50,000 SKUs        | `npm run seed`         |
| Destroy seeded products | `npm run seed:destroy` |

## Engineering Notes

### Strategic indexing

An Equality–Sort–Range compound index supports category-filtered price sorting directly in index order. A weighted text index handles natural-language searches, while the unique SKU index handles exact and anchored prefix lookups. The query builder routes SKU patterns to an anchored regex instead of an unbounded full-text scan.

### Aggregation performance

The analytics pipeline uses MongoDB aggregation stages to reduce documents into category and KPI buckets before returning results. A covered compound index prevents unnecessary document fetches, while the 60-second TTL cache avoids repeated uncached aggregation work. Product mutations invalidate the cache.

### Request integrity

Payloads are recursively sanitized before Zod parsing. Sanitization removes HTML, script content, control characters, and NoSQL operator keys such as `$gt` and `$ne`. Express 5-compatible storage of validated query and parameter values also keeps route handlers stable.

### Local Windows compatibility

Local development includes a DNS fallback for MongoDB Atlas SRV resolution in networks that block ISP-level SRV lookups. Workspace JavaScript settings exclude `node_modules` so third-party TypeScript configurations do not affect VS Code diagnostics.
