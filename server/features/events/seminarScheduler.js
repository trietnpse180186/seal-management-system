const mongoose = require('mongoose');
const emailService = require('../notifications/emailService');

let schedulerInterval = null;

function startSeminarScheduler() {
  if (schedulerInterval) return;

  console.log('[SEMINAR SCHEDULER] Background service started. Checking every 2 minutes...');

  schedulerInterval = setInterval(async () => {
    try {
      if (mongoose.connection.readyState !== 1) return;
      const Event = mongoose.model('Event');
      const TeamMember = mongoose.model('TeamMember');

      const now = new Date();
      // Find events where seminar is scheduled, scheduledAt <= now, and email not sent yet
      const events = await Event.find({
        'seminar.scheduledAt': { $exists: true, $ne: null, $lte: now },
        'seminar.isEmailSent': { $ne: true },
        'seminar.meetUrl': { $exists: true, $ne: '' }
      });

      if (events.length === 0) return;

      console.log(`[SEMINAR SCHEDULER] Found ${events.length} event(s) requiring automatic seminar email dispatch.`);

      for (const event of events) {
        console.log(`[SEMINAR SCHEDULER] Processing event: "${event.name}"...`);
        const members = await TeamMember.find({ eventId: event._id, role: 'leader' }).populate('userId', 'email fullName');
        
        const recipientMap = new Map();
        members.forEach(m => {
          if (m.userId && m.userId.email) {
            recipientMap.set(m.userId.email.toLowerCase(), {
              email: m.userId.email,
              name: m.userId.fullName || 'Thí sinh'
            });
          }
        });

        const recipients = Array.from(recipientMap.values());

        if (recipients.length > 0) {
          let successCount = 0;
          for (const rec of recipients) {
            try {
              await emailService.sendSeminarInvitation(rec.email, rec.name, event.name, event.seminar, event._id);
              successCount++;
            } catch (err) {
              console.error(`[SEMINAR SCHEDULER] Failed email to ${rec.email}:`, err.message);
            }
          }
          console.log(`[SEMINAR SCHEDULER] Successfully dispatched emails to ${successCount}/${recipients.length} contestants for event "${event.name}".`);
        } else {
          console.log(`[SEMINAR SCHEDULER] No contestants registered yet for event "${event.name}".`);
        }

        event.seminar.isEmailSent = true;
        event.seminar.emailSentAt = new Date();
        await event.save();
      }
    } catch (error) {
      console.error('[SEMINAR SCHEDULER] Error running background check:', error.message);
    }
  }, 2 * 60 * 1000); // 2 minutes
}

module.exports = {
  startSeminarScheduler
};
