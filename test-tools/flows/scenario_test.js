const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

async function clearDatabase() {
  console.log("=== SEAL HACKATHON DATABASE CLEANUP (ALL EXCEPT PRESERVED EVENT & DATA) ===");

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

  const targetEventIdStr = "6a4da8421241535a3a01892a";
  const targetEventId = new mongoose.Types.ObjectId(targetEventIdStr);
  const targetEventIdRaw = new mongoose.mongo.ObjectId(targetEventIdStr);

  console.log(`Fetching IDs related to preserved event ${targetEventIdStr}...`);

  // Query related IDs to preserve
  let roundIds = [], roundIdsStr = [];
  let trackIds = [], trackIdsStr = [];
  let rubricIds = [], rubricIdsStr = [];
  let teamIds = [], teamIdsStr = [];
  let chatRoomIds = [], chatRoomIdsStr = [];
  const relatedUserIds = new Set();
  if (adminId) relatedUserIds.add(adminId.toString());

  try {
    const roundsCol = mongoose.connection.db.collection('rounds');
    const roundsDocs = await roundsCol.find({ eventId: { $in: [targetEventIdStr, targetEventId, targetEventIdRaw] } }).toArray();
    roundIds = roundsDocs.map(doc => doc._id);
    roundIdsStr = roundsDocs.map(doc => doc._id.toString());
  } catch (e) {}

  try {
    const tracksCol = mongoose.connection.db.collection('tracks');
    const tracksDocs = await tracksCol.find({ eventId: { $in: [targetEventIdStr, targetEventId, targetEventIdRaw] } }).toArray();
    trackIds = tracksDocs.map(doc => doc._id);
    trackIdsStr = tracksDocs.map(doc => doc._id.toString());
  } catch (e) {}

  try {
    const rubricsCol = mongoose.connection.db.collection('rubrics');
    const rubricsDocs = await rubricsCol.find({ eventId: { $in: [targetEventIdStr, targetEventId, targetEventIdRaw] } }).toArray();
    rubricIds = rubricsDocs.map(doc => doc._id);
    rubricIdsStr = rubricsDocs.map(doc => doc._id.toString());
  } catch (e) {}

  try {
    const teamsCol = mongoose.connection.db.collection('teams');
    const teamsDocs = await teamsCol.find({ eventId: { $in: [targetEventIdStr, targetEventId, targetEventIdRaw] } }).toArray();
    teamIds = teamsDocs.map(doc => doc._id);
    teamIdsStr = teamsDocs.map(doc => doc._id.toString());
    for (const team of teamsDocs) {
      if (team.leaderId) relatedUserIds.add(team.leaderId.toString());
      if (team.mentorId) relatedUserIds.add(team.mentorId.toString());
    }
  } catch (e) {}

  try {
    const chatroomsCol = mongoose.connection.db.collection('chatrooms');
    const chatroomsDocs = await chatroomsCol.find({ eventId: { $in: [targetEventIdStr, targetEventId, targetEventIdRaw] } }).toArray();
    chatRoomIds = chatroomsDocs.map(doc => doc._id);
    chatRoomIdsStr = chatroomsDocs.map(doc => doc._id.toString());
  } catch (e) {}

  try {
    const eventRolesCol = mongoose.connection.db.collection('eventroles');
    const eventRolesDocs = await eventRolesCol.find({ eventId: { $in: [targetEventIdStr, targetEventId, targetEventIdRaw] } }).toArray();
    for (const r of eventRolesDocs) {
      if (r.userId) relatedUserIds.add(r.userId.toString());
    }
  } catch (e) {}

  try {
    if (teamIds.length > 0) {
      const teamMembersCol = mongoose.connection.db.collection('team_members');
      const allSearchTeamIds = [];
      teamIds.forEach(id => {
        allSearchTeamIds.push(id);
        allSearchTeamIds.push(new mongoose.mongo.ObjectId(id.toString()));
        allSearchTeamIds.push(id.toString());
      });
      const teamMembersDocs = await teamMembersCol.find({ teamId: { $in: allSearchTeamIds } }).toArray();
      for (const m of teamMembersDocs) {
        if (m.userId) relatedUserIds.add(m.userId.toString());
      }
    }
  } catch (e) {}

  console.log(`Related counts fetched:
  - Rounds: ${roundIds.length}
  - Tracks: ${trackIds.length}
  - Rubrics: ${rubricIds.length}
  - Teams: ${teamIds.length}
  - ChatRooms: ${chatRoomIds.length}
  - Preserved Users: ${relatedUserIds.size}`);

  console.log(`Clearing all collections with filters...`);

  for (const col of collections) {
    const name = col.name;
    if (name.startsWith('system.')) continue;

    if (name === 'galleryphotos') {
      console.log(`Skipped '${name}' collection (deleted 0 items, kept all gallery photo data).`);
      continue;
    }

    let deleteFilter = {};
    let desc = 'cleared completely';

    if (name === 'events') {
      deleteFilter = { _id: { $nin: [targetEventId, targetEventIdRaw, targetEventIdStr] } };
      desc = `kept event ${targetEventIdStr}`;
    } else if (['rounds', 'tracks', 'rubrics', 'teams', 'github_repositories', 'scores', 'rankings', 'prizes', 'eventroles', 'event_roles', 'chatrooms', 'eventlogs'].includes(name)) {
      deleteFilter = { eventId: { $nin: [targetEventId, targetEventIdRaw, targetEventIdStr] } };
      desc = `kept items for event ${targetEventIdStr}`;
    } else if (name === 'chatmessages') {
      const allChatRoomIds = [];
      chatRoomIds.forEach(id => {
        allChatRoomIds.push(id);
        allChatRoomIds.push(new mongoose.mongo.ObjectId(id.toString()));
        allChatRoomIds.push(id.toString());
      });
      deleteFilter = allChatRoomIds.length > 0 ? { roomId: { $nin: allChatRoomIds } } : {};
      desc = `kept messages for preserved chatrooms`;
    } else if (['team_members', 'team_member', 'repository_snapshots', 'repositorysnapshots', 'commits', 'ai_analyses', 'aianalyses', 'grades'].includes(name)) {
      const allTeamIds = [];
      teamIds.forEach(id => {
        allTeamIds.push(id);
        allTeamIds.push(new mongoose.mongo.ObjectId(id.toString()));
        allTeamIds.push(id.toString());
      });
      deleteFilter = allTeamIds.length > 0 ? { teamId: { $nin: allTeamIds } } : {};
      desc = `kept items for preserved teams`;
    } else if (name === 'criteria') {
      const allRubricIds = [];
      rubricIds.forEach(id => {
        allRubricIds.push(id);
        allRubricIds.push(new mongoose.mongo.ObjectId(id.toString()));
        allRubricIds.push(id.toString());
      });
      deleteFilter = allRubricIds.length > 0 ? { rubricId: { $nin: allRubricIds } } : {};
      desc = `kept criteria for preserved rubrics`;
    } else if (name === 'users') {
      const allPreserved = [];
      Array.from(relatedUserIds).forEach(id => {
        allPreserved.push(new mongoose.Types.ObjectId(id));
        allPreserved.push(new mongoose.mongo.ObjectId(id));
        allPreserved.push(id);
      });
      deleteFilter = { _id: { $nin: allPreserved } };
      desc = `kept admin and users related to event ${targetEventIdStr}`;
    } else if (name === 'notifications') {
      const allPreserved = [];
      Array.from(relatedUserIds).forEach(id => {
        allPreserved.push(new mongoose.Types.ObjectId(id));
        allPreserved.push(new mongoose.mongo.ObjectId(id));
        allPreserved.push(id);
      });
      deleteFilter = { userId: { $nin: allPreserved } };
      desc = `kept notifications for preserved users`;
    } else if (name === 'auditlogs' || name === 'audit_logs') {
      const allPreserved = [];
      Array.from(relatedUserIds).forEach(id => {
        allPreserved.push(new mongoose.Types.ObjectId(id));
        allPreserved.push(new mongoose.mongo.ObjectId(id));
        allPreserved.push(id);
      });
      deleteFilter = { actorId: { $nin: allPreserved } };
      desc = `kept audit logs for preserved users`;
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
