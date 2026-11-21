import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import { notFoundHandler, globalErrorHandler } from './middlewares/errorHandler.js';

const app = express();

// Security & Performance Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);
app.use(compression());

// Body Parsing with payload cap
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP Latency Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Root API Metadata Endpoint (prevents 404 on live deployment URL)
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'Aura Enterprise Engine API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      health: '/api/health',
      inventory: '/api/inventory',
      categories: '/api/inventory/categories',
      analytics: '/api/analytics',
    },
  });
});

// Health Check Endpoint
app.get('/api/health', (_req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbStatus = dbStates[mongoose.connection.readyState] || 'unknown';

  res.status(200).json({
    success: true,
    service: 'Aura Enterprise Engine API',
    environment: env.NODE_ENV,
    database: dbStatus,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Core API Routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 & Centralized Error Handlers (must remain last)
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;