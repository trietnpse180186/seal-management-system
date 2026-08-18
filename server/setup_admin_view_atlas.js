const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
console.log('Connecting to MONGO_URI:', MONGO_URI);

mongoose.connect(MONGO_URI).then(async () => {
  const UserSchema = new mongoose.Schema({}, { strict: false });
  const User = mongoose.model('User', UserSchema, 'users');

  const EventRoleSchema = new mongoose.Schema({}, { strict: false });
  const EventRole = mongoose.model('EventRole', EventRoleSchema, 'eventroles');

  const EventSchema = new mongoose.Schema({}, { strict: false });
  const Event = mongoose.model('Event', EventSchema, 'events');

  const email = 'adminview@seal.com';
  const rawPassword = '123';

  // 1. Create or Update user with isApproved: true
  let user = await User.findOne({ email });
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  if (!user) {
    user = new User({
      email,
      fullName: 'Admin Viewer (Read-only)',
      passwordHash,
      isActive: true,
      isApproved: true,
      createdAt: new Date(),
      isSystemAdmin: false
    });
  } else {
    user.passwordHash = passwordHash;
    user.isApproved = true;
    user.isActive = true;
  }
  await user.save();
  console.log('Created/Updated User in DB. Password matches "123".');

  // 2. Find Event
  const latestEvent = await Event.findOne().sort({ createdAt: -1 });
  if (!latestEvent) {
    console.log('No event found in DB.');
    process.exit(1);
  }

  console.log('Using Event:', latestEvent.name, 'ID:', latestEvent._id);

  // 3. Upsert EventRole with status: 'active'
  await EventRole.deleteOne({
    userId: user._id,
    eventId: latestEvent._id,
    role: 'admin_view'
  });

  const eventRole = new EventRole({
    userId: user._id,
    eventId: latestEvent._id,
    role: 'admin_view',
    status: 'active'
  });
  await eventRole.save();

  console.log('Assigned EventRole status = active successfully.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
