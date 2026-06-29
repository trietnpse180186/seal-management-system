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
    subject: `[SEAL Hackathon] Xác nhận tham gia đội thi "${teamName}"`,
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #1e293b; border-radius: 12px; background-color: #0b1329; color: #f1f5f9; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h2 style="color: #00f0ff; text-align: center; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 1.5px; text-shadow: 0 0 15px rgba(0, 240, 255, 0.4); margin-bottom: 25px; font-size: 20px;">LỜI MỜI THAM GIA ĐỘI THI</h2>
        <p style="font-size: 15px; line-height: 1.6;">Xin chào,</p>
        <p style="font-size: 15px; line-height: 1.6;">Bạn đã được mời tham gia đội thi <strong>"${teamName}"</strong> để tham dự sự kiện SEAL Hackathon sắp tới.</p>
        <p style="font-size: 15px; line-height: 1.6;">Để hoàn tất đăng ký và tham gia cùng các đồng đội, vui lòng nhấn vào nút xác nhận dưới đây:</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${inviteLink}" style="background-color: #00f0ff; color: #0b1329; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 0 20px rgba(0, 240, 255, 0.5); text-transform: uppercase; font-size: 13px; letter-spacing: 1px; transition: all 0.3s ease;">XÁC NHẬN THAM GIA</a>
        </div>
        <p style="margin-top: 30px; font-size: 13px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #1e293b; padding-top: 20px;">* Lưu ý: Tất cả các thành viên được mời đều phải xác nhận tham gia trước khi hết hạn đăng ký hoặc khi số lượng đội đạt giới hạn tối đa để đội thi được công nhận chính thức.</p>
        <hr style="border: 0; border-top: 1px solid #1e293b; margin-top: 30px; margin-bottom: 20px;">
        <p style="font-size: 12px; color: #64748b; text-align: center;">Hệ thống Quản lý SEAL Hackathon &copy; 2026</p>
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
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #1e293b; border-radius: 12px; background-color: #0b1329; color: #f1f5f9; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h2 style="color: #00f0ff; text-align: center; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 1.5px; text-shadow: 0 0 15px rgba(0, 240, 255, 0.4); margin-bottom: 25px; font-size: 20px;">KÍCH HOẠT TÀI KHOẢN</h2>
        <p style="font-size: 15px; line-height: 1.6;">Xin chào <strong>${fullName}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6;">Cảm ơn bạn đã đăng ký tài khoản trên hệ thống Quản lý SEAL Hackathon.</p>
        <p style="font-size: 15px; line-height: 1.6;">Để kích hoạt tài khoản và bắt đầu tham gia cuộc thi, vui lòng nhấn vào nút xác thực dưới đây:</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${verifyLink}" style="background-color: #00f0ff; color: #0b1329; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 0 20px rgba(0, 240, 255, 0.5); text-transform: uppercase; font-size: 13px; letter-spacing: 1px; transition: all 0.3s ease;">KÍCH HOẠT NGAY</a>
        </div>
        <p style="margin-top: 30px; font-size: 13px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #1e293b; padding-top: 20px;">* Lưu ý: Đường link kích hoạt này có hiệu lực trong vòng 24 giờ. Sau thời gian này, tài khoản chưa được kích hoạt sẽ tự động bị hủy và cần đăng ký lại.</p>
        <hr style="border: 0; border-top: 1px solid #1e293b; margin-top: 30px; margin-bottom: 20px;">
        <p style="font-size: 12px; color: #64748b; text-align: center;">Hệ thống Quản lý SEAL Hackathon &copy; 2026</p>
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
  const clientUrl = process.env.CLIENT_URL || 'https://www.seal-hackathon.io.vn';
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Cuộc thi mới đã được khởi tạo: ${eventName}`,
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #1e293b; border-radius: 12px; background-color: #0b1329; color: #f1f5f9; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h2 style="color: #00f0ff; text-align: center; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 1.5px; text-shadow: 0 0 15px rgba(0, 240, 255, 0.4); margin-bottom: 25px; font-size: 20px;">SỰ KIỆN HACKATHON MỚI</h2>
        <p style="font-size: 15px; line-height: 1.6;">Xin chào <strong>${fullName}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6;">Ban tổ chức SEAL Hackathon xin trân trọng thông báo một sự kiện/cuộc thi mới vừa được khởi tạo trên hệ thống:</p>
        <div style="background-color: #0d1e3d; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #1e293b; border-left: 4px solid #00f0ff;">
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #ffffff;">${eventName}</p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #94a3b8;">Học kỳ: <strong>${semester} ${year}</strong></p>
        </div>
        <p style="font-size: 15px; line-height: 1.6;">Hiện tại cổng đăng ký đã mở. Bạn đã có thể đăng nhập vào hệ thống và tiến hành đăng ký đội thi của mình!</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${clientUrl}/register-team" style="background-color: #00f0ff; color: #0b1329; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 0 20px rgba(0, 240, 255, 0.5); text-transform: uppercase; font-size: 13px; letter-spacing: 1px; transition: all 0.3s ease;">Đăng ký Đội ngay</a>
        </div>
        <hr style="border: 0; border-top: 1px solid #1e293b; margin-top: 30px; margin-bottom: 20px;">
        <p style="font-size: 12px; color: #64748b; text-align: center;">Hệ thống Quản lý SEAL Hackathon &copy; 2026</p>
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

/**
 * Sends a notification email to a member when track topics/materials are distributed.
 * @param {string} email - Recipient email
 * @param {string} fullName - Recipient full name
 * @param {string} trackName - Name of the track
 * @param {Array} attachments - List of attachments with fileName and fileUrl
 * @returns {Promise<boolean>}
 */
async function sendTrackTopicDistribution(email, fullName, trackName, attachments) {
  const fileLinks = attachments.map((att, idx) => {
    return `<li style="margin: 8px 0;"><a href="${att.fileUrl}" style="color: #00f0ff; text-decoration: underline;" target="_blank">${att.fileName || `Tài liệu ${idx + 1}`}</a></li>`;
  }).join('');

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Đề thi bảng đấu "${trackName}" đã chính thức được mở!`,
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #1e293b; border-radius: 12px; background-color: #0b1329; color: #f1f5f9; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h2 style="color: #00f0ff; text-align: center; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 1.5px; text-shadow: 0 0 15px rgba(0, 240, 255, 0.4); margin-bottom: 25px; font-size: 20px;">ĐỀ THI & TÀI LIỆU ĐÃ ĐƯỢC MỞ</h2>
        <p style="font-size: 15px; line-height: 1.6;">Xin chào <strong>${fullName}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6;">Thời gian làm bài thi của bảng đấu <strong>"${trackName}"</strong> đã bắt đầu. Ban tổ chức đã mở liên kết đề bài và tài liệu học tập của bảng đấu này.</p>
        <p style="font-size: 15px; line-height: 1.6;">Bạn có thể truy cập danh sách tài liệu trực tiếp dưới đây hoặc đăng nhập vào hệ thống để bắt đầu làm bài:</p>
        
        <div style="background-color: #0d1e3d; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #1e293b;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #ffffff;">Tài liệu đính kèm:</p>
          <ul style="margin: 0; padding-left: 20px;">
            ${fileLinks || '<li style="color: #94a3b8;">Không có liên kết tài liệu đính kèm nào.</li>'}
          </ul>
        </div>
        
        <div style="text-align: center; margin: 35px 0;">
          <a href="${process.env.CLIENT_URL || 'https://www.seal-hackathon.io.vn'}" style="background-color: #00f0ff; color: #0b1329; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 0 20px rgba(0, 240, 255, 0.5); text-transform: uppercase; font-size: 13px; letter-spacing: 1px;">Vào Dashboard Làm Bài</a>
        </div>
        <hr style="border: 0; border-top: 1px solid #1e293b; margin-top: 30px; margin-bottom: 20px;">
        <p style="font-size: 12px; color: #64748b; text-align: center;">Hệ thống Quản lý SEAL Hackathon &copy; 2026</p>
      </div>
    `
  };

  if (isMock) {
    console.log('\n--- [EMAIL MOCK SERVICE: TOPIC DISTRIBUTION] ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log('----------------------------------------------\n');
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Topic email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error sending topic email to ${email}:`, error);
    throw error;
  }
}

async function sendRoundExamOpened(email, fullName, roundName) {
  const clientUrl = process.env.CLIENT_URL || 'https://www.seal-hackathon.io.vn';
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SEAL Hackathon" <no-reply@domain.com>',
    to: email,
    subject: `[SEAL Hackathon] Đề thi vòng "${roundName}" đã chính thức được mở!`,
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #1e293b; border-radius: 12px; background-color: #0b1329; color: #f1f5f9;">
        <h2 style="color: #00f0ff; text-align: center; font-family: 'JetBrains Mono', monospace;">ĐỀ THI ĐÃ MỞ</h2>
        <p style="font-size: 15px; line-height: 1.6;">Xin chào <strong>${fullName}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6;">Vòng thi <strong>"${roundName}"</strong> đã bắt đầu. Hãy đăng nhập hệ thống SEAL → <strong>Khu vực đội</strong> → bấm <strong>Mở đề & tài liệu</strong>.</p>
        <p style="font-size: 13px; color: #94a3b8;">Bạn cần đăng nhập Google bằng <strong>cùng email đã đăng ký</strong> trên hệ thống để xem file trên Drive.</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${clientUrl}/team-area" style="background-color: #00f0ff; color: #0b1329; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Vào Khu vực đội</a>
        </div>
      </div>
    `
  };

  if (isMock) {
    console.log(`\n--- [EMAIL MOCK: ROUND EXAM OPENED] To: ${email} ---\n`);
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Round exam email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error sending round exam email to ${email}:`, error);
    throw error;
  }
}

/**
 * Send Seminar Invitation with Google Meet Link to contestant
 */
async function sendSeminarInvitation(email, recipientName, eventName, seminarData) {
  const startTimeStr = seminarData.scheduledAt ? new Date(seminarData.scheduledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa xác định';
  const endTimeStr = seminarData.scheduledEnd ? new Date(seminarData.scheduledEnd).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
  const formattedTime = endTimeStr ? `${startTimeStr} - ${endTimeStr}` : startTimeStr;
  const mailOptions = {
    from: `"SEAL Hackathon Platform" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@seal-hackathon.com'}>`,
    to: email,
    subject: `[SEAL HACKATHON] Thư Mời Tham Gia Buổi Seminar: ${eventName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0b1329; color: #e2e8f0; border-radius: 12px; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #00f0ff; font-size: 24px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">THƯ MỜI THAM GIA SEMINAR</h1>
          <p style="color: #94a3b8; font-size: 14px;">Cuộc Thi: <strong style="color: #ffffff;">${eventName}</strong></p>
        </div>

        <div style="background-color: #131c35; padding: 20px; border-radius: 8px; border-left: 4px solid #00f0ff; margin-bottom: 20px;">
          <p style="font-size: 15px; margin-top: 0;">Xin chào <strong style="color: #00f0ff;">${recipientName || 'Thí sinh'}</strong>,</p>
          <p style="line-height: 1.6; color: #cbd5e1;">
            Ban tổ chức cuộc thi <strong>${eventName}</strong> trân trọng kính mời bạn tham gia buổi Seminar hướng dẫn, giải đáp thắc mắc và phổ biến thể lệ chi tiết.
          </p>
        </div>

        <div style="background-color: #0f172a; padding: 18px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 25px;">
          <h3 style="margin-top: 0; color: #38bdf8; font-size: 16px;">📌 Thông Tin Buổi Seminar:</h3>
          <ul style="list-style: none; padding-left: 0; margin-bottom: 0; line-height: 1.8; font-size: 14px;">
            <li>⏰ <strong>Thời gian:</strong> <span style="color: #f59e0b; font-weight: bold;">${formattedTime}</span></li>
            <li>📋 <strong>Chủ đề:</strong> ${seminarData.title || 'Seminar Hướng Dẫn & Giải Đáp Thắc Mắc'}</li>
            ${seminarData.description ? `<li>📝 <strong>Mô tả:</strong> ${seminarData.description}</li>` : ''}
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0 10px 0;">
          <a href="${seminarData.meetUrl || '#'}" target="_blank" style="background-color: #22c55e; color: #ffffff; padding: 15px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 0 20px rgba(34, 197, 94, 0.4); text-transform: uppercase; font-size: 14px; letter-spacing: 1px;">👉 Tham Gia Google Meet Ngay</a>
        </div>
      </div>
    `
  };

  if (isMock) {
    console.log('\n--- [EMAIL MOCK SERVICE: SEMINAR INVITATION] ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Meet URL: ${seminarData.meetUrl}`);
    console.log('----------------------------------------------\n');
    return true;
  }

  try {
    const info = await sendMailHelper(mailOptions);
    console.log(`Seminar email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error sending seminar email to ${email}:`, error);
    throw error;
  }
}

module.exports = {
  sendTeamInvitation,
  sendEmailVerification,
  sendEventCreationNotification,
  sendTrackTopicDistribution,
  sendRoundExamOpened,
  sendSeminarInvitation
};
