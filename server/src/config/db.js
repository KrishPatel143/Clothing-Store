import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clothing-store';
  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err.message);
  });
  await mongoose.connect(uri);
  console.log(`[db] connected to ${mongoose.connection.name}`);
}
