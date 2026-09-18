import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vintage_club';

let isConnected = false;
let reconnectTimer = null;

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  try {
    const opts = {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      autoIndex: true
    };

    const conn = await mongoose.connect(MONGODB_URI, opts);
    isConnected = true;
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
    console.log(`\x1b[32m✔\x1b[0m \x1b[1m[MongoDB]\x1b[0m Veritabanı bağlandı: \x1b[36m${conn.connection.name}\x1b[0m`);
    return conn.connection;
  } catch (error) {
    console.error(`\x1b[31m✖\x1b[0m \x1b[1m[MongoDB]\x1b[0m Bağlantı hatası: ${error.message}`);
    
    // Auto retry connection in background every 5 seconds
    if (!reconnectTimer) {
      reconnectTimer = setInterval(async () => {
        if (mongoose.connection.readyState !== 1) {
          try {
            await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
            isConnected = true;
            clearInterval(reconnectTimer);
            reconnectTimer = null;
            console.log(`\x1b[32m✔\x1b[0m \x1b[1m[MongoDB]\x1b[0m Arka planda yeniden bağlandı.`);
          } catch (e) {
            // keep retrying
          }
        }
      }, 5000);
    }
    return null;
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('\x1b[33m⚠\x1b[0m \x1b[1m[MongoDB]\x1b[0m Bağlantı kesildi.');
});

mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('\x1b[32m✔\x1b[0m \x1b[1m[MongoDB]\x1b[0m Bağlantı aktif.');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('\x1b[32m✔\x1b[0m \x1b[1m[MongoDB]\x1b[0m Yeniden bağlandı.');
});

export default connectToDatabase;
