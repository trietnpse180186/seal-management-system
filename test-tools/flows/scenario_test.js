const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

async function clearDatabase() {
  console.log("=== SEAL HACKATHON DATABASE CLEANUP (SELECTIVE) ===");

  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/seal-hackathon";
  console.log(`Connecting to database: ${mongoUri}`);
  
  await mongoose.connect(mongoUri);
  console.log("Connected. Retrieving collections dynamically...");

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(`Found ${collections.length} collections. Pre-fetching IDs to keep...`);

  const eventIdStr = "6a452b9d524138065697f312";
  const eventObjectId = new mongoose.Types.ObjectId(eventIdStr);

  // Helper function to fetch IDs safely
  const getIds = async (colName, filter, idField = '_id') => {
    try {
      const colExists = collections.some(c => c.name === colName);
      if (!colExists) return [];
      const items = await mongoose.connection.db.collection(colName).find(filter).toArray();
      return items.map(item => item[idField]);
    } catch (err) {
      console.log(`Warning: Failed to fetch IDs from '${colName}':`, err.message);
      return [];
    }
  };

  // Pre-fetch related IDs
  const trackIds = await getIds('tracks', { eventId: eventObjectId });
  const roundIds = await getIds('rounds', { eventId: eventObjectId });
  const rubricIds = await getIds('rubrics', { eventId: eventObjectId });
  const teamIds = await getIds('teams', { eventId: eventObjectId });
  const repositoryIds = await getIds('githubrepositories', { eventId: eventObjectId });
  const scoreIds = await getIds('scores', { eventId: eventObjectId });
  const chatRoomIds = await getIds('chatrooms', { eventId: eventObjectId });

  // Users to keep (those with roles in the event, or members of teams in the event)
  const eventRoles = await getIds('eventroles', { eventId: eventObjectId }, 'userId');
  const teamMembers = await getIds('teammembers', { eventId: eventObjectId }, 'userId');
  
  const keptUserIdsSet = new Set([
    ...eventRoles.map(id => id.toString()),
    ...teamMembers.map(id => id.toString())
  ]);

  // Keep admin@seal.com
  try {
    const adminUser = await mongoose.connection.db.collection('users').findOne({ email: 'admin@seal.com' });
    if (adminUser) {
      keptUserIdsSet.add(adminUser._id.toString());
    }
  } catch (err) {
    console.log("Warning: Failed to query admin user:", err.message);
  }
  const keptUserIds = Array.from(keptUserIdsSet).map(id => new mongoose.Types.ObjectId(id));

  console.log(`Pre-fetched relationship mappings. Clearing collections...`);

  for (const col of collections) {
    const name = col.name;
    if (name.startsWith('system.')) continue;

    let deleteFilter = {};
    let desc = '';

    switch (name) {
      case 'events':
        deleteFilter = { _id: { $ne: eventObjectId } };
        desc = `kept event ${eventIdStr}`;
        break;
      case 'tracks':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept tracks for event ${eventIdStr}`;
        break;
      case 'rounds':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept rounds for event ${eventIdStr}`;
        break;
      case 'rubrics':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept rubrics for event ${eventIdStr}`;
        break;
      case 'criteria':
      case 'criterions':
        deleteFilter = { rubricId: { $nin: rubricIds } };
        desc = `kept criteria for rubrics (${rubricIds.length} items)`;
        break;
      case 'teams':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept teams for event ${eventIdStr}`;
        break;
      case 'teammembers':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept teammembers for event ${eventIdStr}`;
        break;
      case 'githubrepositories':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept githubrepositories for event ${eventIdStr}`;
        break;
      case 'repositorysnapshots':
        deleteFilter = { roundId: { $nin: roundIds } };
        desc = `kept repositorysnapshots for rounds (${roundIds.length} items)`;
        break;
      case 'commits':
        deleteFilter = { teamId: { $nin: teamIds } };
        desc = `kept commits for teams (${teamIds.length} items)`;
        break;
      case 'commitfiles':
        deleteFilter = { repositoryId: { $nin: repositoryIds } };
        desc = `kept commitfiles for repos (${repositoryIds.length} items)`;
        break;
      case 'aianalyses':
        deleteFilter = { teamId: { $nin: teamIds } };
        desc = `kept aianalyses for teams (${teamIds.length} items)`;
        break;
      case 'scores':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept scores for event ${eventIdStr}`;
        break;
      case 'scoredetails':
        deleteFilter = { scoreId: { $nin: scoreIds } };
        desc = `kept scoredetails for scores (${scoreIds.length} items)`;
        break;
      case 'rankings':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept rankings for event ${eventIdStr}`;
        break;
      case 'prizes':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept prizes for event ${eventIdStr}`;
        break;
      case 'chatrooms':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept chatrooms for event ${eventIdStr}`;
        break;
      case 'chatmessages':
        deleteFilter = { roomId: { $nin: chatRoomIds } };
        desc = `kept chatmessages for rooms (${chatRoomIds.length} items)`;
        break;
      case 'tasks':
        deleteFilter = { teamId: { $nin: teamIds } };
        desc = `kept tasks for teams (${teamIds.length} items)`;
        break;
      case 'eventlogs':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept eventlogs for event ${eventIdStr}`;
        break;
      case 'users':
        deleteFilter = { _id: { $nin: keptUserIds } };
        desc = `kept ${keptUserIds.length} event-related users`;
        break;
      case 'eventroles':
        deleteFilter = { eventId: { $ne: eventObjectId } };
        desc = `kept eventroles for event ${eventIdStr}`;
        break;
      case 'notifications':
        deleteFilter = { userId: { $nin: keptUserIds } };
        desc = `kept notifications for event-related users`;
        break;
      case 'auditlogs':
        const keptTargetIds = [
          eventIdStr,
          ...trackIds.map(id => id.toString()),
          ...roundIds.map(id => id.toString()),
          ...rubricIds.map(id => id.toString()),
          ...teamIds.map(id => id.toString()),
          ...repositoryIds.map(id => id.toString()),
          ...keptUserIds.map(id => id.toString())
        ];
        deleteFilter = { targetId: { $nin: keptTargetIds } };
        desc = `kept auditlogs for event-related targets`;
        break;
      default:
        // Clear all documents for any other collections
        deleteFilter = {};
        desc = `cleared completely`;
        break;
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
