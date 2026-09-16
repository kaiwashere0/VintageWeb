import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vintage_club';

let isConnected = false;

export async function connectToDatabase() {
  if (isConnected) {
    return mongoose.connection;
  }

  try {
    const opts = {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    };

    const conn = await mongoose.connect(MONGODB_URI, opts);
    isConnected = true;
    console.log(`\x1b[32m✔\x1b[0m \x1b[1m[MongoDB]\x1b[0m Veritabanı bağlandı: \x1b[36m${conn.connection.name}\x1b[0m`);
    return conn.connection;
  } catch (error) {
    console.error(`\x1b[31m✖\x1b[0m \x1b[1m[MongoDB]\x1b[0m Bağlantı hatası: ${error.message}`);
    // Don't crash process, allow retry
    return null;
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('\x1b[33m⚠\x1b[0m \x1b[1m[MongoDB]\x1b[0m Bağlantı kesildi.');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('\x1b[32m✔\x1b[0m \x1b[1m[MongoDB]\x1b[0m Yeniden bağlandı.');
});

export default connectToDatabase;
