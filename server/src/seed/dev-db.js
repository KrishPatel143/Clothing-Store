// Starts an in-memory MongoDB for local development when no real MongoDB is
// installed. Prints the URI to use in MONGODB_URI and keeps running.
//   node src/seed/dev-db.js
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, dbName: 'clothing-store' },
});
console.log(`[dev-db] in-memory MongoDB running at ${mongod.getUri()}`);
console.log('[dev-db] data is lost when this process exits. Press Ctrl+C to stop.');

process.on('SIGINT', async () => {
  await mongod.stop();
  process.exit(0);
});
