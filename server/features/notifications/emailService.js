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
  const isMailjetApi = !!(process.env.MJ_APIKEY_PUBLIC && process.env.MJ_APIKEY_PRIVATE);

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

  // Parse BCC list if provided
  let bccList = [];
  if (mailOptions.bcc) {
    if (Array.isArray(mailOptions.bcc)) {
      bccList = mailOptions.bcc;
    } else if (typeof mailOptions.bcc === 'string') {
      bccList = mailOptions.bcc.split(',').map(e => e.trim());
    }
  }

  if (isMailjetApi) {
    console.log('[EMAIL] Detected Mailjet API keys. Routing mail through Mailjet HTTP API (v3.1)...');
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

      const message = {
        From: { Email: senderEmail, Name: senderName },
        To: [{ Email: recipientEmail, Name: recipientName || undefined }],
        Subject: mailOptions.subject,
        HTMLPart: mailOptions.html
      };
      if (bccList.length > 0) {
        message.Bcc = bccList.map(email => {
          const match = email.match(/^(?:"?([^"]*)"?\s)?(?:<(.+)>)$/);
          if (match) {
            return { Email: match[2], Name: match[1] || undefined };
          }
          return { Email: email };
        });
      }
      // Support attachments (e.g. certificate PDFs)
      if (mailOptions.attachments && mailOptions.attachments.length > 0) {
        message.Attachments = mailOptions.attachments.map(att => ({
          ContentType: att.contentType || 'application/octet-stream',
          Filename: att.filename,
          Base64Content: Buffer.from(att.content).toString('base64')
        }));
      }

      // Mailjet uses Basic Auth: base64(API_KEY:SECRET_KEY)
      const authToken = Buffer.from(
        `${process.env.MJ_APIKEY_PUBLIC}:${process.env.MJ_APIKEY_PRIVATE}`
      ).toString('base64');

      const response = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Messages: [message] })
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          // Auth errors (401/403) use top-level ErrorMessage; send errors use nested Messages[].Errors[]
          errMsg = errData.ErrorMessage
            || errData.Messages?.[0]?.Errors?.[0]?.ErrorMessage
            || errMsg;
        } catch (_) { /* non-JSON response */ }
        if (response.status === 401) {
          console.error('[EMAIL] Mailjet 401 Unauthorized — vui lòng kiểm tra MJ_APIKEY_PUBLIC và MJ_APIKEY_PRIVATE trong .env');
        }
        throw new Error(errMsg);
      }

      const resData = await response.json();
      const messageId = resData.Messages?.[0]?.To?.[0]?.MessageID;
      console.log(`[EMAIL] Mailjet HTTP API Success! Message ID: ${messageId}`);
      return { messageId: String(messageId) };
    } catch (apiErr) {
      console.error(`[EMAIL] Mailjet HTTP API failed: ${apiErr.message}.`);
      throw apiErr;
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

      const payload = {
        from: `SEAL Hackathon <${senderEmail}>`,
        to: [recipientEmail],
        subject: mailOptions.subject,
        html: mailOptions.html
      };
      if (bccList.length > 0) {
        payload.bcc = bccList.map(email => {
          const match = email.match(/^(?:"?([^"]*)"?\s)?(?:<(.+)>)$/);
          return match ? match[2] : email;
        });
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EMAIL_PASS}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
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

      const personalization = {
        to: [{
          email: recipientEmail,
          name: recipientName || undefined
        }]
      };
      if (bccList.length > 0) {
        personalization.bcc = bccList.map(email => {
          const match = email.match(/^(?:"?([^"]*)"?\s)?(?:<(.+)>)$/);
          if (match) {
            return { email: match[2], name: match[1] || undefined };
          }
          return { email };
        });
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EMAIL_PASS}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [personalization],
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

      const payload = {
        sender: { name: senderName, email: senderEmail },
        to: [toField],
        subject: mailOptions.subject,
        htmlContent: mailOptions.html
      };
      if (bccList.length > 0) {
        payload.bcc = bccList.map(email => {
          const match = email.match(/^(?:"?([^"]*)"?\s)?(?:<(.+)>)$/);
          if (match) {
            return { email: match[2], name: match[1] || undefined };
          }
          return { email };
        });
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.EMAIL_PASS,
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
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

const FPT_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/vi/2/2d/Logo_Tr%C6%B0%E1%BB%9Dng_%C4%90%E1%BA%A1i_h%E1%BB%8Dc_FPT.svg';

/**
 * Standardized, professional HTML email wrapper with balanced layout and FPT footer logo.
 */
function buildBaseEmailTemplate({ headerTitle, contentHtml }) {
  return `
    <div style="background-color: #f8fafc; margin: 0; padding: 40px 16px; font-family: 'Inter', Arial, Helvetica, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.06);">
        <!-- Top Accent Line -->
        <div style="height: 6px; background-color: #F27024; width: 100%;"></div>
        
        <!-- Header -->
        <div style="padding: 36px 32px 16px 32px; text-align: center;">
          <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin: 0; line-height: 1.4;">${headerTitle}</h2>
        </div>

        <!-- Main Content -->
        <div style="padding: 16px 32px 36px 32px; font-size: 15px; line-height: 1.7; color: #334155;">
          ${contentHtml}
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #f1f5f9; padding: 24px 32px; background-color: #fafafa; text-align: center;">
          <div style="margin-bottom: 12px;">
            <span style="font-size: 12px; color: #64748b; vertical-align: middle; margin-right: 8px;">Powered by</span>
            <img src="${FPT_LOGO_URL}" alt="FPT University Logo" style="height: 36px; max-width: 160px; vertical-align: middle; border: 0;" />
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">
            Hệ thống Quản lý SEAL Hackathon &copy; 2026. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Sends a registration/join invitation email to a team member.
 * @param {string} email - Recipient email
 * @param {string} teamName - Name of the team they are invited to join
 * @param {string} inviteLink - Confirmation link URL containing the token
 * @param {string} [leaderName] - Optional full name of the team leader
 * @param {string} [leaderEmail] - Optional email address of the team leader
 * @param {string} [eventName] - Optional full name of the event/competition
 * @returns {Promise<boolean>}
 */
async function sendTeamInvitation(email, teamName, inviteLink, leaderName = null, leaderEmail = null, eventName = null, role = 'member', seminar = null, recipientName = null) {
  const displayEventName = eventName || 'SEAL Hackathon';
  const isLeader = leaderEmail && email.toLowerCase() === leaderEmail.toLowerCase();
  // Look up candidate's full name from DB
  let displayName = 'Thí sinh';
  try {
    const mongoose = require('mongoose');
    const User = mongoose.model('User');
    const u = await User.findOne({ email: email.toLowerCase() });
    if (u && u.fullName) {
      displayName = u.fullName;
    }
  } catch (dbErr) {
    console.error('[EMAIL] Failed to fetch user fullName for greeting:', dbErr.message);
  }

  const contentHtml = `
    <p style="margin-top: 0; font-family: sans-serif; font-size: 14px; color: #334155;">Xin chào thí sinh <strong>${displayName}</strong>,</p>
    <p style="font-family: sans-serif; font-size: 14px; color: #334155; margin-bottom: 12px; font-weight: bold;">Ban tổ chức xin thông báo</p>
    <p style="font-family: sans-serif; font-size: 14px; color: #334155; margin-bottom: 16px;">Bạn có lời mời tham gia đội thi</p>
    <p style="font-family: sans-serif; font-size: 14px; color: #334155; margin-bottom: 24px; padding-left: 12px; border-left: 3px solid #F27024; line-height: 1.6;">
      <strong>Cuộc thi:</strong> ${displayEventName}<br/>
      <strong>Đội thi:</strong> "${teamName}"
    </p>
    <p style="font-family: sans-serif; font-size: 13px; color: #334155; line-height: 1.6;">Để hoàn tất thủ tục đăng ký và chính thức tham gia cùng các đồng đội, vui lòng xác nhận bằng cách nhấn vào nút dưới đây:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${inviteLink}" style="background-color: #F27024; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block; box-shadow: 0 8px 20px rgba(242,112,36,0.25); text-transform: uppercase; font-size: 13px; letter-spacing: 0.8px;">XÁC NHẬN THAM GIA ĐỘI THI</a>
    </div>
    <div style="font-size: 13px; color: #64748b; line-height: 1.6; border: 1px solid #fed7aa; padding: 16px; background-color: #fff7ed; border-radius: 10px; font-family: sans-serif;">
      <strong>Lưu ý quan trọng:</strong> Tất cả các thành viên được mời đều phải xác nhận tham gia trước ngày 15/08/2026 để đội thi được công nhận chính thức.
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Lời mời tham gia đội thi "${teamName}"`,
    html: buildBaseEmailTemplate({
      headerTitle: 'SEAL Hackathon Summer 2026',
      contentHtml
    })
  };

  if (isMock) {
    console.log('\n--- [EMAIL MOCK SERVICE] ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Confirmation Link: ${inviteLink}`);
    if (leaderName) console.log(`Leader: ${leaderName} (${leaderEmail})`);
    console.log('----------------------------\n');
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending email via Ethereal/SMTP:', error);
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
  const contentHtml = `
    <p style="margin-top: 0;">Kính gửi <strong>${fullName}</strong>,</p>
    <p>Cảm ơn bạn đã đăng ký tài khoản trên hệ thống Quản lý SEAL Hackathon.</p>
    <p>Để hoàn tất quy trình kích hoạt tài khoản và sẵn sàng tham gia các hoạt động của cuộc thi, vui lòng xác nhận địa chỉ email bằng cách nhấn vào nút dưới đây:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verifyLink}" style="background-color: #F27024; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block; box-shadow: 0 8px 20px rgba(242,112,36,0.25); text-transform: uppercase; font-size: 13px; letter-spacing: 0.8px;">KÍCH HOẠT TÀI KHOẢN</a>
    </div>
    <div style="font-size: 13px; color: #64748b; line-height: 1.6; border: 1px solid #fed7aa; padding: 16px; background-color: #fff7ed; border-radius: 10px;">
      <strong>Lưu ý:</strong> Liên kết kích hoạt có hiệu lực trong vòng 24 giờ. Sau thời gian này, các tài khoản chưa xác thực sẽ bị hủy để giải phóng dữ liệu.
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Xác thực địa chỉ email kích hoạt tài khoản`,
    html: buildBaseEmailTemplate({
      headerTitle: 'Kích Hoạt Tài Khoản',
      contentHtml
    })
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
  const clientUrl = process.env.CLIENT_URL || 'https://seal-management-staging.vercel.app';
  const contentHtml = `
    <p style="margin-top: 0;">Kính gửi <strong>${fullName}</strong>,</p>
    <p>Ban Tổ chức SEAL Hackathon xin trân trọng thông báo một sự kiện/cuộc thi mới đã chính thức khởi động trên hệ thống:</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #F27024; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a;">${eventName}</p>
      <p style="margin: 6px 0 0 0; font-size: 14px; color: #64748b;">Học kỳ: <strong style="color: #F27024;">${semester} ${year}</strong></p>
    </div>
    <p>Hiện tại cổng đăng ký đã chính thức mở. Bạn có thể đăng nhập vào hệ thống để tìm kiếm đồng đội và đăng ký đội thi.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${clientUrl}/register-team" style="background-color: #F27024; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block; box-shadow: 0 8px 20px rgba(242,112,36,0.25); text-transform: uppercase; font-size: 13px; letter-spacing: 0.8px;">ĐĂNG KÝ ĐỘI THI NGAY</a>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Thông báo công bố sự kiện mới: ${eventName}`,
    html: buildBaseEmailTemplate({
      headerTitle: 'Sự Kiện Hackathon Mới',
      contentHtml
    })
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

/**
 * Send Seminar Invitation with Google Meet Link to contestant
 */
async function sendSeminarInvitation(email, recipientName, eventName, seminarData, eventId) {
  const startTimeStr = seminarData.scheduledAt ? new Date(seminarData.scheduledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa xác định';
  const endTimeStr = seminarData.scheduledEnd ? new Date(seminarData.scheduledEnd).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
  const formattedTime = endTimeStr ? `${startTimeStr} - ${endTimeStr}` : startTimeStr;
  const clientUrl = process.env.CLIENT_URL || 'https://seal-management-staging.vercel.app';
  const teamAreaUrl = eventId ? `${clientUrl}/team-area?eventId=${eventId}` : `${clientUrl}/team-area`;
  const senderEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@seal-hackathon.com';

  const contentHtml = `
    <p style="margin-top: 0;">Kính gửi <strong>${recipientName || 'Thí sinh'}</strong>,</p>
    <p>Ban Tổ chức cuộc thi <strong>${eventName}</strong> trân trọng kính mời bạn tham dự buổi Seminar hướng dẫn, giải đáp thắc mắc và phổ biến thể lệ cuộc thi.</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #F27024; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 10px 0; font-weight: 700; color: #0f172a; font-size: 15px;">Thông tin chi tiết buổi Seminar:</p>
      <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.8; color: #334155;">
        <li style="margin-bottom: 6px;">Thời gian: <strong style="color: #F27024;">${formattedTime}</strong></li>
        <li style="margin-bottom: 6px;">Chủ đề: <strong>${seminarData.title || 'Seminar Hướng Dẫn & Giải Đáp Thắc Mắc'}</strong></li>
        ${seminarData.description ? `<li>Mô tả nội dung: ${seminarData.description}</li>` : ''}
      </ul>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${teamAreaUrl}" target="_blank" style="background-color: #F27024; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block; box-shadow: 0 8px 20px rgba(242,112,36,0.25); text-transform: uppercase; font-size: 13px; letter-spacing: 0.8px;">XÁC NHẬN THAM GIA SEMINAR</a>
    </div>
  `;

  const mailOptions = {
    from: `"SEAL Hackathon Platform" <${senderEmail}>`,
    to: senderEmail,
    bcc: email,
    subject: `[SEAL Hackathon] Thư mời tham dự buổi Seminar: ${eventName}`,
    html: buildBaseEmailTemplate({
      headerTitle: 'Thư Mời Tham Dự Seminar',
      contentHtml
    })
  };

  if (isMock) {
    console.log('\n--- [EMAIL MOCK SERVICE: SEMINAR INVITATION] ---');
    console.log(`To: ${mailOptions.to}`);
    console.log(`Bcc: ${mailOptions.bcc}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Meet URL: ${seminarData.meetUrl}`);
    console.log('----------------------------------------------\n');
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Seminar email sent (BCC to ${email}): ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error sending seminar email (BCC to ${email}):`, error);
    throw error;
  }
}

/**
 * Sends welcome/provisioning email with temporary password.
 */
async function sendAccountProvisionEmail(email, fullName, password, roleLabel = 'Thành viên') {
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const contentHtml = `
    <p style="margin-top: 0;">Kính gửi <strong>${fullName}</strong>,</p>
    <p>Ban Tổ chức SEAL Hackathon xin thông báo: Tài khoản của bạn đã được khởi tạo thành công trên hệ thống với vai trò: <strong style="color: #F27024;">${roleLabel}</strong>.</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0; font-family: monospace;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #0f172a;">Email đăng nhập: <strong>${email}</strong></p>
      <p style="margin: 0; font-size: 14px; color: #0f172a;">Mật khẩu tạm thời: <strong style="color: #F27024;">${password}</strong></p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${loginUrl}" style="background-color: #F27024; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block; box-shadow: 0 8px 20px rgba(242,112,36,0.25); text-transform: uppercase; font-size: 13px; letter-spacing: 0.8px;">ĐĂNG NHẬP HỆ THỐNG</a>
    </div>
    <div style="font-size: 13px; color: #64748b; line-height: 1.6; border: 1px solid #fed7aa; padding: 16px; background-color: #fff7ed; border-radius: 10px;">
      <strong>Lưu ý bảo mật:</strong> Vui lòng đăng nhập và tiến hành đổi mật khẩu ngay trong lần sử dụng đầu tiên để bảo vệ tài khoản của bạn.
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Thông báo khởi tạo tài khoản hệ thống`,
    html: buildBaseEmailTemplate({
      headerTitle: 'Khởi Tạo Tài Khoản',
      contentHtml
    })
  };

  if (isMock) {
    console.log('\n--- [EMAIL MOCK SERVICE: ACCOUNT PROVISION] ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Password: ${password}`);
    console.log('----------------------------------------------\n');
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Provision email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending provision email:', error);
    throw error;
  }
}

/**
 * Sends a password reset email to the user.
 */
async function sendPasswordResetEmail(email, fullName, resetLink) {
  const contentHtml = `
    <p style="margin-top: 0;">Kính gửi <strong>${fullName}</strong>,</p>
    <p>Hệ thống Quản lý SEAL Hackathon đã nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.</p>
    <p>Để hoàn tất việc thiết lập mật khẩu mới, vui lòng nhấn vào nút xác nhận dưới đây:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetLink}" style="background-color: #F27024; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block; box-shadow: 0 8px 20px rgba(242,112,36,0.25); text-transform: uppercase; font-size: 13px; letter-spacing: 0.8px;">ĐẶT LẠI MẬT KHẨU</a>
    </div>
    <div style="font-size: 13px; color: #64748b; line-height: 1.6; border: 1px solid #e2e8f0; padding: 16px; background-color: #f8fafc; border-radius: 10px;">
      <strong>Lưu ý:</strong> Liên kết này chỉ có hiệu lực trong vòng 1 giờ. Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email và mật khẩu của bạn sẽ không bị thay đổi.
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Yêu cầu khôi phục mật khẩu tài khoản`,
    html: buildBaseEmailTemplate({
      headerTitle: 'Khôi Phục Mật Khẩu',
      contentHtml
    })
  };

  if (isMock) {
    console.log('\n--- [EMAIL MOCK SERVICE: PASSWORD RESET] ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log('--------------------------------------------\n');
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Password reset email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

/**
 * Sends a certificate PDF email to the participant.
 */
async function sendCertificateEmail(email, fullName, certificatePdfBuffer, prizeTitle, eventName) {
  const contentHtml = `
    <div style="text-align: center; margin-bottom: 24px;">
      <h3 style="color: #F27024; font-size: 18px; text-transform: uppercase; margin: 0 0 4px 0;">CHÚC MỪNG BẠN ĐẠT GIẢI!</h3>
      <p style="font-size: 13px; color: #64748b; margin: 0;">Mùa giải: ${eventName}</p>
    </div>
    <p style="margin-top: 0;">Kính gửi <strong>${fullName}</strong>,</p>
    <p>Ban Tổ chức cuộc thi SEAL Hackathon xin trân trọng chúc mừng bạn và đội thi đã xuất sắc đạt thành tích: <strong style="color: #F27024;">${prizeTitle}</strong>.</p>
    <p>Ban Tổ chức xin gửi kèm file Bằng khen / Giấy chứng nhận điện tử (định dạng PDF) trong phần đính kèm của email này để ghi nhận những nỗ lực và kết quả tuyệt vời của bạn.</p>
    <p>Chúc bạn luôn giữ vững nhiệt huyết đam mê và tiếp tục đạt được nhiều thành công hơn nữa trên con đường học tập và sự nghiệp!</p>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Trân trọng gửi Giấy chứng nhận / Bằng khen - ${eventName}`,
    html: buildBaseEmailTemplate({
      headerTitle: 'Giấy Chứng Nhận Điện Tử',
      contentHtml
    }),
    attachments: [
      {
        filename: `Bang_Khen_${fullName.replace(/\s+/g, '_')}.pdf`,
        content: certificatePdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  if (isMock) {
    console.log('\n--- [EMAIL MOCK SERVICE: CERTIFICATE PDF] ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Recipient: ${fullName} - Prize: ${prizeTitle}`);
    console.log('--------------------------------------------\n');
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Certificate email successfully sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending certificate email:', error);
    throw error;
  }
}

async function sendSupportReplyEmail(email, fullName, requestCode, title, message, statusLabel) {
  const safe = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const contentHtml = `
    <p>Kính gửi <strong>${safe(fullName || email)}</strong>,</p>
    <p>Coordinator đã cập nhật yêu cầu hỗ trợ <strong>${safe(requestCode)}</strong>.</p>
    <div style="padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff7ed;margin:20px 0;">
      <p style="margin:0 0 8px;color:#F27024;font-weight:700;">${safe(title)}</p>
      ${statusLabel ? `<p style="margin:0 0 8px;color:#64748b;">Trạng thái: ${safe(statusLabel)}</p>` : ''}
      ${message ? `<p style="margin:0;white-space:pre-wrap;color:#334155;">${safe(message)}</p>` : ''}
    </div>
    <p>Đây là email thông báo tự động từ hệ thống SEAL Hackathon.</p>`;
  return sendMailHelper({
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Phản hồi yêu cầu hỗ trợ ${requestCode}`,
    html: buildBaseEmailTemplate({ headerTitle: 'Phản Hồi Hỗ Trợ', contentHtml })
  });
}

module.exports = {
  sendTeamInvitation,
  sendEmailVerification,
  sendEventCreationNotification,
  sendSeminarInvitation,
  sendAccountProvisionEmail,
  sendPasswordResetEmail,
  sendCertificateEmail,
  sendSupportReplyEmail
};
