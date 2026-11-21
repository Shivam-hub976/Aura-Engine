import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
  try {
    // Force Node to use Google DNS for SRV lookups locally (bypasses ISP blocking)
    if (env.NODE_ENV !== 'production') {
      dns.setServers(['8.8.8.8', '8.8.4.4']);
    }

    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(
      `✅ MongoDB connected: ${conn.connection.host} (Database: ${conn.connection.name})`
    );
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  await mongoose.connection.close();
  console.log('🔌 MongoDB connection closed.');
};