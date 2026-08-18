const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const XLSX = require('xlsx-js-style');
const path = require('path');
const fs = require('fs');
const { ZipArchive } = require('archiver');
const PDFDocument = require('pdfkit');
const emailService = require('../notifications/emailService');

const { authenticateToken, requireEventRole } = require('../auth/authMiddleware');

const Event = mongoose.model('Event');
const Team = mongoose.model('Team');
const TeamMember = mongoose.model('TeamMember');
const User = mongoose.model('User');
const MerchandiseRecord = mongoose.model('MerchandiseRecord');

/**
 * Logic tự động tính size áo từ chiều cao và cân nặng.
 */
function suggestShirtSize(height, weight) {
  if (!height || !weight) return 'N/A';
  if (height <= 155 && weight <= 50) return 'S';
  if (height <= 165 && weight <= 60) return 'M';
  if (height <= 175 && weight <= 70) return 'L';
  if (height <= 180 && weight <= 80) return 'XL';
  if (height <= 185 && weight <= 90) return 'XXL';
  return '3XL';
}

/**
 * Helper to fetch all active event participants (confirmed team members).
 */
async function getEventParticipants(eventId) {
  const confirmedTeams = await Team.find({ eventId, status: 'confirmed' });
  const teamIds = confirmedTeams.map(t => t._id);

  const teamMembers = await TeamMember.find({
    teamId: { $in: teamIds },
    confirmStatus: 'confirmed'
  }).populate('userId', 'fullName studentId email gender height weight university');

  // Build a map of teamId to teamName for easy lookup
  const teamMap = {};
  confirmedTeams.forEach(t => {
    teamMap[t._id.toString()] = t.name;
  });

  return teamMembers
    .filter(m => m.userId) // Ensure User object exists
    .map(m => ({
      userId: m.userId._id,
      fullName: m.userId.fullName,
      studentId: m.userId.studentId || 'N/A',
      email: m.userId.email,
      gender: m.userId.gender || 'N/A',
      height: m.userId.height || null,
      weight: m.userId.weight || null,
      university: m.userId.university || 'N/A',
      teamName: teamMap[m.teamId.toString()] || 'N/A',
      suggestedSize: suggestShirtSize(m.userId.height, m.userId.weight)
    }));
}

/**
 * @route   GET /api/ctsv/events/:eventId/merchandise/stats
 * @desc    Thống kê tổng lượng size áo cần chuẩn bị
 * @access  Private (Coordinator or Student Assistant)
 */
router.get('/events/:eventId/merchandise/stats', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId } = req.params;

  try {
    const participants = await getEventParticipants(eventId);
    const userIds = participants.map(p => p.userId);

    // Get actual distributed records
    const distributedRecords = await MerchandiseRecord.find({
      eventId,
      userId: { $in: userIds },
      itemType: 'shirt'
    });

    const recordMap = {};
    distributedRecords.forEach(r => {
      recordMap[r.userId.toString()] = r;
    });

    const stats = {
      S: { required: 0, distributed: 0 },
      M: { required: 0, distributed: 0 },
      L: { required: 0, distributed: 0 },
      XL: { required: 0, distributed: 0 },
      XXL: { required: 0, distributed: 0 },
      '3XL': { required: 0, distributed: 0 },
      'N/A': { required: 0, distributed: 0 }
    };

    let totalRequired = 0;
    let totalDistributed = 0;

    participants.forEach(p => {
      const record = recordMap[p.userId.toString()];
      const isDistributed = record ? record.isDistributed : false;
      const sizeUsed = (record && record.isDistributed) ? record.size : p.suggestedSize;

      // Increment stats for required size
      if (stats[sizeUsed] !== undefined) {
        stats[sizeUsed].required++;
        if (isDistributed) {
          stats[sizeUsed].distributed++;
        }
      } else {
        stats['N/A'].required++;
        if (isDistributed) {
          stats['N/A'].distributed++;
        }
      }

      totalRequired++;
      if (isDistributed) totalDistributed++;
    });

    res.json({
      stats,
      totalRequired,
      totalDistributed,
      totalPending: totalRequired - totalDistributed
    });
  } catch (error) {
    console.error('Get Merchandise Stats Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải thống kê quần áo.' });
  }
});

/**
 * @route   GET /api/ctsv/events/:eventId/merchandise/list
 * @desc    Danh sách thí sinh và tình trạng phát quần áo
 * @access  Private (Coordinator or Student Assistant)
 */
router.get('/events/:eventId/merchandise/list', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId } = req.params;

  try {
    const participants = await getEventParticipants(eventId);
    const userIds = participants.map(p => p.userId);

    const records = await MerchandiseRecord.find({
      eventId,
      userId: { $in: userIds },
      itemType: 'shirt'
    }).populate('distributedBy', 'fullName');

    const recordMap = {};
    records.forEach(r => {
      recordMap[r.userId.toString()] = r;
    });

    const result = participants.map(p => {
      const record = recordMap[p.userId.toString()];
      return {
        ...p,
        merchandiseRecord: record ? {
          isDistributed: record.isDistributed,
          size: record.size,
          distributedAt: record.distributedAt,
          distributedBy: record.distributedBy ? record.distributedBy.fullName : null,
          distributionHistory: record.distributionHistory
        } : {
          isDistributed: false,
          size: null,
          distributedAt: null,
          distributedBy: null,
          distributionHistory: []
        }
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get Merchandise List Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải danh sách quần áo.' });
  }
});

/**
 * @route   PUT /api/ctsv/events/:eventId/merchandise/:userId/distribute
 * @desc    Thực hiện phát áo cho thí sinh (lưu size thực tế phát)
 * @access  Private (Coordinator or Student Assistant)
 */
router.put('/events/:eventId/merchandise/:userId/distribute', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId, userId } = req.params;
  const { size } = req.body;

  if (!size) {
    return res.status(400).json({ message: 'Size áo là bắt buộc.' });
  }

  try {
    let record = await MerchandiseRecord.findOne({ eventId, userId, itemType: 'shirt' });

    // Check if it has been distributed before by looking at history
    const hadBeenDistributed = record && record.distributionHistory && record.distributionHistory.some(h => h.action === 'distributed' || h.action === 'exchanged');

    const historyEntry = {
      action: 'distributed',
      size,
      performedBy: req.user._id,
      performedAt: new Date(),
      reason: hadBeenDistributed ? 'Phát lại áo' : 'Phát áo lần đầu'
    };

    if (record) {
      record.isDistributed = true;
      record.size = size;
      record.distributedAt = new Date();
      record.distributedBy = req.user._id;
      record.distributionHistory.push(historyEntry);
    } else {
      record = new MerchandiseRecord({
        eventId,
        userId,
        itemType: 'shirt',
        isDistributed: true,
        size,
        distributedAt: new Date(),
        distributedBy: req.user._id,
        distributionHistory: [historyEntry]
      });
    }

    await record.save();
    res.json({ message: 'Ghi nhận phát áo thành công.', record });
  } catch (error) {
    console.error('Distribute Merchandise Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi phát áo.' });
  }
});

/**
 * @route   PUT /api/ctsv/events/:eventId/merchandise/:userId/revoke
 * @desc    Thu hồi áo của thí sinh
 * @access  Private (Coordinator or Student Assistant)
 */
router.put('/events/:eventId/merchandise/:userId/revoke', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId, userId } = req.params;
  const { reason } = req.body;

  try {
    const record = await MerchandiseRecord.findOne({ eventId, userId, itemType: 'shirt' });
    if (!record || !record.isDistributed) {
      return res.status(400).json({ message: 'Thí sinh này chưa được phát áo để thu hồi.' });
    }

    const historyEntry = {
      action: 'revoked',
      size: record.size,
      performedBy: req.user._id,
      performedAt: new Date(),
      reason: reason || 'Thu hồi áo'
    };

    record.isDistributed = false;
    record.size = null;
    record.distributedAt = null;
    record.distributedBy = req.user._id;
    record.distributionHistory.push(historyEntry);

    await record.save();
    res.json({ message: 'Thu hồi áo thành công.', record });
  } catch (error) {
    console.error('Revoke Merchandise Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi thu hồi áo.' });
  }
});

/**
 * @route   PUT /api/ctsv/events/:eventId/merchandise/:userId/exchange
 * @desc    Đổi size áo mới cho thí sinh
 * @access  Private (Coordinator or Student Assistant)
 */
router.put('/events/:eventId/merchandise/:userId/exchange', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId, userId } = req.params;
  const { size, reason } = req.body;

  if (!size) {
    return res.status(400).json({ message: 'Size áo mới là bắt buộc.' });
  }

  try {
    const record = await MerchandiseRecord.findOne({ eventId, userId, itemType: 'shirt' });
    if (!record) {
      return res.status(400).json({ message: 'Bản ghi phát áo chưa tồn tại. Vui lòng phát áo trước.' });
    }

    const oldSize = record.size;
    const historyEntry = {
      action: 'exchanged',
      size,
      performedBy: req.user._id,
      performedAt: new Date(),
      reason: reason || `Đổi size từ ${oldSize} sang ${size}`
    };

    record.isDistributed = true;
    record.size = size;
    record.distributedAt = new Date();
    record.distributedBy = req.user._id;
    record.distributionHistory.push(historyEntry);

    await record.save();
    res.json({ message: 'Đổi size áo thành công.', record });
  } catch (error) {
    console.error('Exchange Merchandise Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi đổi size áo.' });
  }
});

/**
 * @route   GET /api/ctsv/events/:eventId/merchandise/:userId/history
 * @desc    Lấy lịch sử phát/thu hồi/đổi size của 1 thí sinh
 * @access  Private (Coordinator or Student Assistant)
 */
router.get('/events/:eventId/merchandise/:userId/history', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId, userId } = req.params;

  try {
    const record = await MerchandiseRecord.findOne({ eventId, userId, itemType: 'shirt' })
      .populate('distributionHistory.performedBy', 'fullName');

    if (!record) {
      return res.json({ history: [] });
    }

    res.json({ history: record.distributionHistory });
  } catch (error) {
    console.error('Get Merchandise History Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải lịch sử phát áo.' });
  }
});

/**
 * @route   GET /api/ctsv/events/:eventId/merchandise/export
 * @desc    Xuất danh sách phân phối quần áo ra Excel
 * @access  Private (Coordinator or Student Assistant)
 */
router.get('/events/:eventId/merchandise/export', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event không tồn tại.' });

    const participants = await getEventParticipants(eventId);
    const userIds = participants.map(p => p.userId);

    const records = await MerchandiseRecord.find({
      eventId,
      userId: { $in: userIds },
      itemType: 'shirt'
    }).populate('distributedBy', 'fullName');

    const recordMap = {};
    records.forEach(r => {
      recordMap[r.userId.toString()] = r;
    });

    const wb = XLSX.utils.book_new();
    const wsData = [
      [`DANH SÁCH SIZE ÁO & PHÁT ĐỒ - ${event.name.toUpperCase()}`],
      [`Kỳ học: Kỳ ${event.semester} ${event.year}`],
      [],
      ["STT", "MSSV", "Họ và Tên", "Chiều cao (cm)", "Cân nặng (kg)", "Đội thi", "Size Áo", "Trạng Thái", "Ngày Phát", "Người Phát"]
    ];

    participants.forEach((p, idx) => {
      const record = recordMap[p.userId.toString()];
      const isDistributed = record ? record.isDistributed : false;
      const sizeUsed = record ? record.size : '';
      const formattedDate = (record && record.distributedAt) ? new Date(record.distributedAt).toLocaleString('vi-VN') : '';
      const distributorName = (record && record.distributedBy) ? record.distributedBy.fullName : '';

      let statusText = 'Chưa phát';
      if (record) {
        if (record.isDistributed) statusText = 'Đã phát';
        else if (record.distributionHistory.some(h => h.action === 'revoked')) statusText = 'Đã thu hồi';
      }

      wsData.push([
        idx + 1,
        p.studentId,
        p.fullName,
        p.height || 'N/A',
        p.weight || 'N/A',
        p.teamName,
        sizeUsed || 'N/A',
        statusText,
        formattedDate,
        distributorName || 'N/A'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }
    ];

    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 12 }, // MSSV
      { wch: 25 }, // Họ tên
      { wch: 15 }, // Chiều cao
      { wch: 15 }, // Cân nặng
      { wch: 25 }, // Đội thi
      { wch: 12 }, // Size Áo
      { wch: 12 }, // Trạng thái
      { wch: 20 }, // Ngày phát
      { wch: 20 }  // Người phát
    ];

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = range.s.r; r <= range.e.r; ++r) {
      for (let c = range.s.c; c <= range.e.c; ++c) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;

        const cell = ws[cellRef];
        cell.s = cell.s || {};

        if (r === 0) {
          cell.s.font = { bold: true, size: 14, name: 'Calibri', color: { rgb: '0F172A' } };
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        } else if (r === 1) {
          cell.s.font = { italic: true, size: 11, name: 'Calibri', color: { rgb: '475569' } };
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        } else if (r === 3) {
          cell.s.font = { bold: true, name: 'Calibri', color: { rgb: 'FFFFFF' } };
          cell.s.fill = { patternType: 'solid', fgColor: { rgb: 'F27024' } }; // SEAL Orange header
          cell.s.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
          cell.s.border = {
            top: { style: 'medium', color: { rgb: 'F27024' } },
            bottom: { style: 'medium', color: { rgb: 'F27024' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          };
        } else if (r > 3) {
          cell.s.font = { name: 'Calibri', size: 10 };
          cell.s.alignment = {
            vertical: 'center',
            horizontal: c === 0 || c === 1 || c === 3 || c === 7 || c === 8 || c === 9 ? 'center' : 'left',
            wrapText: true
          };
          cell.s.border = {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          };
          if (r % 2 === 1) {
            cell.s.fill = { patternType: 'solid', fgColor: { rgb: 'FFF8F4' } }; // Light orange tint
          }
        }
      }
    }

    ws['!rows'] = [];
    ws['!rows'][0] = { hpx: 30 };
    ws['!rows'][1] = { hpx: 20 };
    ws['!rows'][3] = { hpx: 26 };

    XLSX.utils.book_append_sheet(wb, ws, 'Merchandise');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Danh_Sach_Size_Ao_${event.name.replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Export Merchandise Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi xuất file Excel size áo.' });
  }
});

/**
 * @route   GET /api/ctsv/events/:eventId/awards
 * @desc    Lấy danh sách giải thưởng và trạng thái trao giải
 * @access  Private (Coordinator or Student Assistant)
 */
router.get('/events/:eventId/awards', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId } = req.params;
  const Prize = mongoose.model('Prize');

  try {
    const awards = await Prize.find({ eventId })
      .populate('teamId', 'name')
      .populate('disbursedBy', 'fullName')
      .sort({ rank: 1 });

    res.json(awards);
  } catch (error) {
    console.error('Get Awards Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải danh sách giải thưởng.' });
  }
});

/**
 * @route   PUT /api/ctsv/events/:eventId/awards/:prizeId/confirm
 * @desc    Xác nhận đã trao giải thưởng cho đội thi
 * @access  Private (Coordinator or Student Assistant)
 */
router.put('/events/:eventId/awards/:prizeId/confirm', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId, prizeId } = req.params;
  const { notes } = req.body;
  const Prize = mongoose.model('Prize');

  try {
    const prize = await Prize.findOne({ _id: prizeId, eventId });
    if (!prize) {
      return res.status(404).json({ message: 'Không tìm thấy giải thưởng tương ứng.' });
    }

    prize.disbursementStatus = 'delivered';
    prize.disbursedAt = new Date();
    prize.disbursedBy = req.user._id;
    if (notes !== undefined) {
      prize.notes = notes;
    }

    await prize.save();
    res.json({ message: 'Xác nhận đã trao giải thành công.', prize });
  } catch (error) {
    console.error('Confirm Award Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi xác nhận trao giải.' });
  }
});

/**
 * @route   PUT /api/ctsv/events/:eventId/awards/:prizeId/revoke
 * @desc    Hủy xác nhận đã trao giải thưởng
 * @access  Private (Coordinator or Student Assistant)
 */
router.put('/events/:eventId/awards/:prizeId/revoke', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId, prizeId } = req.params;
  const Prize = mongoose.model('Prize');

  try {
    const prize = await Prize.findOne({ _id: prizeId, eventId });
    if (!prize) {
      return res.status(404).json({ message: 'Không tìm thấy giải thưởng tương ứng.' });
    }

    prize.disbursementStatus = 'pending';
    prize.disbursedAt = undefined;
    prize.disbursedBy = undefined;
    prize.notes = undefined;

    await prize.save();
    res.json({ message: 'Đã hủy xác nhận trao giải.', prize });
  } catch (error) {
    console.error('Revoke Award Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi hủy xác nhận trao giải.' });
  }
});

// Helper to generate the certificate PDF as a Buffer
function generateCertificatePDF(fullName, teamName, prizeTitle, prizeValue, eventName) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 0, left: 0, bottom: 0, right: 0 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // Draw background
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFDFB');

      // Double border
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(4).stroke('#F27024');
      doc.rect(26, 26, doc.page.width - 52, doc.page.height - 52).lineWidth(1).stroke('#E05E1B');

      // Unicode Font candidates
      let resolvedFont = null;
      const fontCandidates = [
        'C:/Windows/Fonts/times.ttf',
        'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/calibri.ttf'
      ];
      for (const p of fontCandidates) {
        if (fs.existsSync(p)) {
          resolvedFont = p;
          break;
        }
      }
      
      if (resolvedFont) {
        doc.font(resolvedFont);
      } else {
        doc.font('Times-Roman');
      }

      // Embed SEAL Logo
      const sealLogoPath = path.join(__dirname, '../../../client/public/shield_seal.png');
      if (fs.existsSync(sealLogoPath)) {
        doc.image(sealLogoPath, (doc.page.width - 80) / 2, 45, { width: 80 });
      }

      // Title/Header
      doc.fillColor('#475569')
         .fontSize(11)
         .text('BAN TỔ CHỨC CUỘC THI HACKATHON', 0, 140, { align: 'center', characterSpacing: 1.5 });

      doc.fillColor('#F27024')
         .fontSize(32)
         .text('GIẤY CHỨNG NHẬN / BẰNG KHEN', 0, 165, { align: 'center', characterSpacing: 1 });

      // Body text
      doc.fillColor('#64748B')
         .fontSize(13)
         .text('Quyết định trao tặng cho Đội thi:', 0, 220, { align: 'center' });

      doc.fillColor('#0F172A')
         .fontSize(22)
         .text(teamName, 0, 245, { align: 'center' });

      doc.fillColor('#64748B')
         .fontSize(13)
         .text('Thành viên / Thí sinh chính thức:', 0, 285, { align: 'center' });

      doc.fillColor('#E05E1B')
         .fontSize(24)
         .text(fullName, 0, 310, { align: 'center' });

      doc.fillColor('#64748B')
         .fontSize(13)
         .text('Đã xuất sắc đạt danh hiệu:', 0, 355, { align: 'center' });

      doc.fillColor('#0F172A')
         .fontSize(18)
         .text(`${prizeTitle} (${prizeValue})`, 0, 375, { align: 'center' });

      doc.fillColor('#475569')
         .fontSize(12)
         .text(`Tại giải đấu: ${eventName}`, 0, 415, { align: 'center' });

      const fptLogoPath = path.join(__dirname, '../../../client/src/assets/logo-fpt.png');
      if (fs.existsSync(fptLogoPath)) {
        doc.image(fptLogoPath, 60, 465, { width: 130 });
      }

      doc.fillColor('#94A3B8')
         .fontSize(10)
         .text('Powered by FPT University', 60, 525);

      // Representative Signature Section
      doc.fillColor('#334155')
         .fontSize(11)
         .text('Trưởng Ban Tổ Chức', doc.page.width - 250, 460, { width: 200, align: 'center' });

      doc.fillColor('#94A3B8')
         .fontSize(9.5)
         .text('(Đã ký điện tử)', doc.page.width - 250, 478, { width: 200, align: 'center' });

      doc.fillColor('#475569')
         .fontSize(11)
         .text('SEAL Hackathon Committee', doc.page.width - 250, 515, { width: 200, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * @route   GET /api/ctsv/events/:eventId/awards/export
 * @desc    Xuất danh sách phôi bằng khen dạng file ZIP chứa các bản PDF
 * @access  Private (Coordinator or Student Assistant)
 */
router.get('/events/:eventId/awards/export', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId } = req.params;
  const Prize = mongoose.model('Prize');

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy cuộc thi.' });

    const prizes = await Prize.find({ eventId }).populate('teamId');
    if (prizes.length === 0) {
      return res.status(400).json({ message: 'Chưa có giải thưởng nào được tạo cho cuộc thi này.' });
    }

    // Initialize zip archiver
    const archive = new ZipArchive({ zlib: { level: 9 } });
    res.setHeader('Content-Disposition', `attachment; filename=Bang_Khen_${event.name.replace(/\s+/g, '_')}.zip`);
    res.setHeader('Content-Type', 'application/zip');
    archive.pipe(res);

    for (const prize of prizes) {
      if (!prize.teamId) continue;
      
      // Find all confirmed team members for this winning team
      const members = await TeamMember.find({ 
        teamId: prize.teamId._id, 
        confirmStatus: 'confirmed' 
      }).populate('userId');

      for (const member of members) {
        if (!member.userId) continue;
        const fullName = member.userId.fullName || 'Thí sinh';
        const teamName = prize.teamId.name || 'Đội thi';
        
        const pdfBuffer = await generateCertificatePDF(
          fullName, 
          teamName, 
          prize.title, 
          prize.value || 'N/A', 
          event.name
        );

        const filename = `Bang_Khen_${prize.title.replace(/\s+/g, '_')}_${fullName.replace(/\s+/g, '_')}.pdf`;
        archive.append(pdfBuffer, { name: filename });
      }
    }

    archive.finalize();
  } catch (error) {
    console.error('Export Certificate ZIP Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Lỗi hệ thống khi tạo file ZIP bằng khen.' });
    }
  }
});

/**
 * @route   POST /api/ctsv/events/:eventId/awards/email
 * @desc    Gửi email bằng khen hàng loạt cho toàn bộ thành viên của các đội đạt giải
 * @access  Private (Coordinator or Student Assistant)
 */
router.post('/events/:eventId/awards/email', authenticateToken, requireEventRole(['student_assistant']), async (req, res) => {
  const { eventId } = req.params;
  const Prize = mongoose.model('Prize');

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy cuộc thi.' });

    const prizes = await Prize.find({ eventId }).populate('teamId');
    if (prizes.length === 0) {
      return res.status(400).json({ message: 'Chưa có giải thưởng nào được tạo cho cuộc thi này.' });
    }

    let emailCount = 0;

    for (const prize of prizes) {
      if (!prize.teamId) continue;
      
      const members = await TeamMember.find({ 
        teamId: prize.teamId._id, 
        confirmStatus: 'confirmed' 
      }).populate('userId');

      for (const member of members) {
        if (!member.userId || !member.userId.email) continue;
        const fullName = member.userId.fullName || 'Thí sinh';
        const teamName = prize.teamId.name || 'Đội thi';

        const pdfBuffer = await generateCertificatePDF(
          fullName,
          teamName,
          prize.title,
          prize.value || 'N/A',
          event.name
        );

        await emailService.sendCertificateEmail(
          member.userId.email,
          fullName,
          pdfBuffer,
          prize.title,
          event.name
        );
        emailCount++;
      }
    }

    res.json({ message: `Đã gửi hàng loạt ${emailCount} email bằng khen thành công!` });
  } catch (error) {
    console.error('Email Certificate Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi gửi email bằng khen.' });
  }
});

module.exports = router;
