const nodemailer = require('nodemailer');
const fetch = globalThis.fetch || require('node-fetch');

const isMock = process.env.EMAIL_SERVICE_MOCK === 'true';

// Transporter configuration
let transporter;
if (!isMock) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

/**
 * Unified email sending helper supporting both Brevo HTTP API and standard Nodemailer SMTP
 */
async function sendMailHelper(mailOptions) {
  const isBrevoApi = process.env.EMAIL_PASS && (process.env.EMAIL_PASS.startsWith('xsmtpsib-') || process.env.EMAIL_PASS.startsWith('xkeysib-'));
  const isResendApi = process.env.EMAIL_PASS && process.env.EMAIL_PASS.startsWith('re_');
  const isSendGridApi = process.env.EMAIL_PASS && process.env.EMAIL_PASS.startsWith('SG.');

  // Parse recipient format: "Name" <email@domain.com> or email@domain.com
  let recipientEmail = mailOptions.to;
  let recipientName = '';
  if (typeof recipientEmail === 'string') {
    const toMatch = recipientEmail.match(/^(?:"?([^"]*)"?\s)?(?:<(.+)>)$/);
    if (toMatch) {
      recipientName = toMatch[1] || '';
      recipientEmail = toMatch[2];
    }
  }

  if (isResendApi) {
    console.log('[EMAIL] Detected Resend API key. Routing mail through secure Resend HTTP API (Port 443)...');
    try {
      let senderEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
      // Resend sandbox only allows sending from onboarding@resend.dev if domain is not verified
      if (senderEmail.includes('gmail.com') || senderEmail.includes('fpt.edu.vn') || senderEmail.includes('domain.com')) {
        senderEmail = 'onboarding@resend.dev';
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EMAIL_PASS}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `SEAL Hackathon <${senderEmail}>`,
          to: [recipientEmail],
          subject: mailOptions.subject,
          html: mailOptions.html
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `HTTP ${response.status}`);
      }

      const resData = await response.json();
      console.log(`[EMAIL] Resend HTTP API Success! Message ID: ${resData.id}`);
      return { messageId: resData.id };
    } catch (apiErr) {
      console.error(`[EMAIL] Resend HTTP API failed: ${apiErr.message}. Falling back to standard SMTP.`);
      throw apiErr;
    }
  }

  if (isSendGridApi) {
    console.log('[EMAIL] Detected SendGrid API key. Routing mail through secure SendGrid HTTP API (Port 443)...');
    try {
      let senderName = 'SEAL Hackathon';
      let senderEmail = process.env.EMAIL_FROM || 'no-reply@domain.com';

      // Parse sender format: "Name" <email@domain.com>
      const fromMatch = senderEmail.match(/^(?:"?([^"]*)"?\s)?(?:<(.+)>)$/);
      if (fromMatch) {
        senderName = fromMatch[1] || senderName;
        senderEmail = fromMatch[2];
      } else if (senderEmail.includes('@')) {
        senderName = senderEmail.split('@')[0];
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EMAIL_PASS}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{
              email: recipientEmail,
              name: recipientName || undefined
            }]
          }],
          from: {
            email: senderEmail,
            name: senderName
          },
          subject: mailOptions.subject,
          content: [{
            type: 'text/html',
            value: mailOptions.html
          }]
        })
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.errors && errData.errors.length > 0) {
            errMsg = errData.errors.map(e => e.message).join(', ');
          }
        } catch (e) {
          // Non-JSON response
        }
        throw new Error(errMsg);
      }

      console.log(`[EMAIL] SendGrid HTTP API Success!`);
      return { messageId: `sg-${Date.now()}` };
    } catch (apiErr) {
      console.error(`[EMAIL] SendGrid HTTP API failed: ${apiErr.message}. Falling back to standard SMTP.`);
      throw apiErr;
    }
  }

  if (isBrevoApi) {
    console.log('[EMAIL] Detected Brevo API key. Routing mail through secure HTTP API (Port 443)...');
    try {
      let senderName = 'SEAL Hackathon';
      let senderEmail = process.env.EMAIL_FROM || 'no-reply@domain.com';

      // Parse sender format: "Name" <email@domain.com>
      const fromMatch = senderEmail.match(/^(?:"?([^"]*)"?\s)?(?:<(.+)>)$/);
      if (fromMatch) {
        senderName = fromMatch[1] || senderName;
        senderEmail = fromMatch[2];
      } else if (senderEmail.includes('@')) {
        senderName = senderEmail.split('@')[0];
      }

      const toField = { email: recipientEmail };
      if (recipientName) {
        toField.name = recipientName;
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.EMAIL_PASS,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [toField],
          subject: mailOptions.subject,
          htmlContent: mailOptions.html
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `HTTP ${response.status}`);
      }

      const resData = await response.json();
      console.log(`[EMAIL] Brevo HTTP API Success! Message ID: ${resData.messageId}`);
      return { messageId: resData.messageId };
    } catch (apiErr) {
      console.error(`[EMAIL] Brevo HTTP API failed: ${apiErr.message}. Falling back to standard SMTP.`);
      throw apiErr;
    }
  }

  // Fallback to SMTP
  return await transporter.sendMail(mailOptions);
}

/**
 * Sends a registration/join invitation email to a team member.
 * @param {string} email - Recipient email
 * @param {string} teamName - Name of the team they are invited to join
 * @param {string} inviteLink - Confirmation link URL containing the token
 * @returns {Promise<boolean>}
 */
async function sendTeamInvitation(email, teamName, inviteLink) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Confirm your participation in team "${teamName}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4f46e5; text-align: center;">SEAL Hackathon Team Invitation</h2>
        <p>Hello,</p>
        <p>You have been invited to join the team <strong>"${teamName}"</strong> for the upcoming SEAL Hackathon event.</p>
        <p>To participate in this team, you must confirm your email registration by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Confirm Invitation</a>
        </div>
        <p style="color: #666; font-size: 14px;">If the button above does not work, copy and paste this URL into your browser:</p>
        <p style="color: #4f46e5; font-size: 14px; word-break: break-all;">${inviteLink}</p>
        <p style="margin-top: 30px; font-size: 14px; color: #888;">Note: All team members must confirm their participation before the registration deadline or before the maximum capacity is reached for the team to be official.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px; margin-bottom: 20px;">
        <p style="font-size: 12px; color: #aaa; text-align: center;">SEAL Hackathon Platform &copy; 2026</p>
      </div>
    `
  };

  if (isMock) {
    console.log('\n--- [EMAIL MOCK SERVICE] ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Confirmation Link: ${inviteLink}`);
    console.log('----------------------------\n');
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending email via Ethereal/SMTP:', error);
    // Fall back to console print if real fails, so app doesn't break
    console.log('\n--- [EMAIL MOCK FALLBACK] ---');
    console.log(`To: ${email}`);
    console.log(`Confirmation Link: ${inviteLink}`);
    console.log('-----------------------------\n');
    throw error;
  }
}

/**
 * Sends an email verification link to a newly registered user.
 * @param {string} email - Recipient email
 * @param {string} fullName - Recipient full name
 * @param {string} verifyLink - Verification link URL containing the token
 * @returns {Promise<boolean>}
 */
async function sendEmailVerification(email, fullName, verifyLink) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Kích hoạt tài khoản của bạn`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #00f0ff; background-color: #0a141d; text-align: center; padding: 15px; border-radius: 6px; font-family: 'JetBrains Mono', monospace;">SEAL_PROTOCOL // ACTIVATE_NODE</h2>
        <p>Xin chào <strong>${fullName}</strong>,</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản trên hệ thống Quản lý SEAL Hackathon.</p>
        <p>Để kích hoạt tài khoản và tham gia cuộc thi, vui lòng nhấn vào nút xác thực dưới đây:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyLink}" style="background-color: #00f0ff; color: #0a141d; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);">KÍCH HOẠT TÀI KHOẢN</a>
        </div>
        <p style="color: #666; font-size: 14px;">Nếu nút trên không hoạt động, bạn có thể copy và paste đường link sau vào trình duyệt:</p>
        <p style="color: #00f0ff; font-size: 14px; word-break: break-all;">${verifyLink}</p>
        <p style="margin-top: 30px; font-size: 14px; color: #888;">Đường link này có hiệu lực trong vòng 24 giờ. Sau thời gian này, tài khoản chưa kích hoạt sẽ cần được đăng ký lại.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px; margin-bottom: 20px;">
        <p style="font-size: 12px; color: #aaa; text-align: center;">SEAL Hackathon Platform &copy; 2026</p>
      </div>
    `
  };

  if (isMock) {
    console.log('\n--- [EMAIL MOCK SERVICE: VERIFICATION] ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Verification Link: ${verifyLink}`);
    console.log('-----------------------------------------\n');
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Verification email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    console.log('\n--- [EMAIL VERIFICATION FALLBACK] ---');
    console.log(`To: ${email}`);
    console.log(`Verification Link: ${verifyLink}`);
    console.log('-------------------------------------\n');
    throw error;
  }
}

/**
 * Sends a notification email to a member when a new event is created.
 * @param {string} email - Recipient email
 * @param {string} fullName - Recipient full name
 * @param {string} eventName - Name of the new event
 * @param {string} semester - Semester of the event (e.g. Summer)
 * @param {number} year - Year of the event (e.g. 2026)
 * @returns {Promise<boolean>}
 */
async function sendEventCreationNotification(email, fullName, eventName, semester, year) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Cuộc thi mới đã được khởi tạo: ${eventName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4f46e5; text-align: center; font-family: 'JetBrains Mono', monospace;">SEAL_PROTOCOL // NEW_EVENT</h2>
        <p>Xin chào <strong>${fullName}</strong>,</p>
        <p>Hệ thống SEAL Hackathon trân trọng thông báo một cuộc thi mới đã được khởi tạo:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4f46e5;">
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">${eventName}</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563;">Học kỳ: <strong>${semester} ${year}</strong></p>
        </div>
        <p>Bạn đã có thể đăng nhập vào hệ thống và bắt đầu đăng ký đội thi của mình ngay hôm nay!</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:5173/register-team" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(79,70,229,0.2);">Đăng ký Nhóm ngay</a>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px; margin-bottom: 20px;">
        <p style="font-size: 12px; color: #aaa; text-align: center;">SEAL Hackathon Platform &copy; 2026</p>
      </div>
    `
  };

  if (isMock) {
    console.log('\n--- [EMAIL MOCK SERVICE: EVENT NOTIFICATION] ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log('----------------------------------------------\n');
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Event notification email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error sending event notification email to ${email}:`, error);
    throw error;
  }
}

module.exports = {
  sendTeamInvitation,
  sendEmailVerification,
  sendEventCreationNotification
};
