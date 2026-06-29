module.paths.push('c:/Users/Triet/MyProject/seal-management-system/server/node_modules');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

async function clearDatabase() {
  console.log("=== SEAL HACKATHON DATABASE CLEANUP ===");

  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/seal-hackathon";
  console.log(`Connecting to database: ${mongoUri}`);
  
  await mongoose.connect(mongoUri);
  console.log("Connected. Retrieving collections dynamically...");

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(`Found ${collections.length} collections. Clearing...`);

  for (const col of collections) {
    const name = col.name;
    // Skip system collections
    if (name.startsWith('system.')) continue;

    if (name === 'users') {
      const result = await mongoose.connection.db.collection(name).deleteMany({ email: { $ne: 'admin@seal.com' } });
      console.log(`Cleared 'users' collection (deleted ${result.deletedCount} items, kept admin@seal.com).`);
    } else {
      const result = await mongoose.connection.db.collection(name).deleteMany({});
      console.log(`Cleared '${name}' collection (deleted ${result.deletedCount} items).`);
    }
  }

  console.log('=== DATABASE CLEANUP COMPLETED ===');
  await mongoose.disconnect();
}

clearDatabase().catch((err) => {
  console.error("\n❌ DATABASE CLEANUP FAILED:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
