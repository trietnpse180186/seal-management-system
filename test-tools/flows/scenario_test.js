const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

async function clearDatabase() {
  console.log("=== SEAL HACKATHON DATABASE CLEANUP (ALL EXCEPT ADMIN) ===");

  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/seal-hackathon";
  console.log(`Connecting to database: ${mongoUri}`);
  
  await mongoose.connect(mongoUri);
  console.log("Connected. Retrieving collections dynamically...");

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(`Found ${collections.length} collections.`);

  // Find admin user to preserve
  let adminId = null;
  try {
    const adminUser = await mongoose.connection.db.collection('users').findOne({ email: 'admin@seal.com' });
    if (adminUser) {
      adminId = adminUser._id;
      console.log(`Found admin user: admin@seal.com (ID: ${adminId})`);
    } else {
      console.log("Warning: Admin user 'admin@seal.com' not found.");
    }
  } catch (err) {
    console.log("Warning: Failed to query admin user:", err.message);
  }

  console.log(`Clearing all collections...`);

  for (const col of collections) {
    const name = col.name;
    if (name.startsWith('system.')) continue;

    let deleteFilter = {};
    let desc = 'cleared completely';

    if (name === 'users') {
      deleteFilter = adminId ? { _id: { $ne: adminId } } : {};
      desc = adminId ? 'kept admin@seal.com' : 'cleared completely';
    }

    const result = await mongoose.connection.db.collection(name).deleteMany(deleteFilter);
    console.log(`Cleared '${name}' collection (deleted ${result.deletedCount} items, ${desc}).`);
  }

  console.log('=== DATABASE CLEANUP COMPLETED ===');
  await mongoose.disconnect();
}

clearDatabase().catch((err) => {
  console.error("\n❌ DATABASE CLEANUP FAILED:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
