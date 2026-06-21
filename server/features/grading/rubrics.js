const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const XLSX = require("xlsx-js-style");
const fs = require("fs");
const path = require("path");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)"), false);
    }
  },
});

const Rubric = mongoose.model("Rubric");
const Criterion = mongoose.model("Criterion");
const Round = mongoose.model("Round");
const Track = mongoose.model("Track");
const EventRole = mongoose.model("EventRole");
const { authenticateToken } = require("../auth/authMiddleware");

function toNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

async function canManageRubric(req, eventId) {
  if (req.user.isSystemAdmin) return true;

  const role = await EventRole.findOne({
    userId: req.user._id,
    eventId,
    role: "coordinator",
    status: "active",
  });

  return !!role;
}

async function loadRubricOr404(rubricId, res) {
  const rubric = await Rubric.findById(rubricId);
  if (!rubric) {
    res.status(404).json({ message: "Rubric not found." });
    return null;
  }
  return rubric;
}

async function getCriteriaSum(rubricId) {
  const criteria = await Criterion.find({ rubricId });
  return criteria.reduce(
    (sum, criterion) => sum + Number(criterion.weight || 0),
    0,
  );
}

function styleWorksheet(ws) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  
  // Expand range to 100 rows (index 99) and 9 columns (index 8) to allow editing
  range.e.r = Math.max(range.e.r, 99);
  range.e.c = Math.max(range.e.c, 8);
  ws['!ref'] = XLSX.utils.encode_range(range);
  
  for (let r = range.s.r; r <= range.e.r; ++r) {
    for (let c = range.s.c; c <= range.e.c; ++c) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) {
        ws[cellRef] = { t: 's', v: '' };
      }
      
      const cell = ws[cellRef];
      const isHeader = r < 2;
      
      cell.s = {
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        },
        alignment: {
          vertical: 'center',
          horizontal: isHeader || c === 2 ? 'center' : 'left',
          wrapText: true
        }
      };
      
      if (isHeader) {
        cell.s.font = { bold: true, name: 'Calibri' };
        cell.s.fill = {
          patternType: 'solid',
          fgColor: { rgb: 'EAEAEA' }
        };
      } else {
        cell.s.font = { name: 'Calibri' };
      }
    }
  }
}

/**
 * GET /api/rubrics
 * Query: eventId, trackId, roundId, isActive
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const filter = {};
    if (req.query.eventId) filter.eventId = req.query.eventId;
    if (req.query.trackId) filter.trackId = req.query.trackId;
    if (req.query.roundId) filter.roundId = req.query.roundId;
    if (req.query.isActive !== undefined)
      filter.isActive = req.query.isActive === "true";

    const rubrics = await Rubric.find(filter).sort({ createdAt: -1 });
    res.json(rubrics);
  } catch (error) {
    console.error("List Rubrics Error:", error.message);
    res.status(500).json({ message: "Server error retrieving rubrics." });
  }
});

/**
 * POST /api/rubrics
 * Tạo rubric cho một round
 */
router.post("/", authenticateToken, async (req, res) => {
  const {
    eventId,
    trackId,
    roundId,
    name,
    description,
    totalWeight,
    maxCriterionScore,
  } = req.body;

  if (!eventId || !roundId || !name) {
    return res
      .status(400)
      .json({
        message: "Event ID, Round ID, and Rubric name are required.",
      });
  }

  try {
    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ message: "Round not found." });

    if (round.eventId.toString() !== eventId.toString()) {
      return res
        .status(400)
        .json({
          message: "Round does not belong to the provided event.",
        });
    }

    if (trackId) {
      const track = await Track.findById(trackId);
      if (!track) return res.status(404).json({ message: "Track not found." });

      if (track.roundId.toString() !== roundId.toString()) {
        return res
          .status(400)
          .json({
            message: "Track does not belong to the provided round.",
          });
      }
    }

    if (!(await canManageRubric(req, eventId))) {
      return res
        .status(403)
        .json({ message: "Unauthorized. Coordinator role required." });
    }

    const existingActive = await Rubric.findOne({ roundId, isActive: true });
    if (existingActive) {
      return res
        .status(400)
        .json({ message: "An active rubric already exists for this round." });
    }

    const rubricTotalWeight = toNumber(totalWeight, 100);
    if (rubricTotalWeight > 100) {
      return res
        .status(400)
        .json({ message: "Rubric totalWeight cannot exceed 100." });
    }

    const rubric = new Rubric({
      eventId,
      trackId,
      roundId,
      name: String(name).trim(),
      description,
      totalWeight: rubricTotalWeight,
      maxCriterionScore: toNumber(maxCriterionScore, 10),
      createdBy: req.user._id,
    });

    await rubric.save();

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'create_rubric',
      details: `Tạo Rubric mới: ${rubric.name} cho vòng thi ID: ${roundId}`
    });
    await newLog.save();

    res.status(201).json(rubric);
  } catch (error) {
    console.error("Create Rubric Error:", error.message);
    res.status(500).json({ message: "Server error creating rubric." });
  }
});

/**
 * GET /api/rubrics/round/:roundId
 * Lấy rubric active của round kèm danh sách criteria
 */
router.get("/round/:roundId", authenticateToken, async (req, res) => {
  try {
    const rubric = await Rubric.findOne({
      roundId: req.params.roundId,
      isActive: true,
    });
    if (!rubric) {
      return res
        .status(404)
        .json({ message: "No active rubric found for this round." });
    }

    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({
      order: 1,
      createdAt: 1,
    });
    res.json({ rubric, criteria });
  } catch (error) {
    console.error("Fetch Rubric Error:", error.message);
    res.status(500).json({ message: "Server error retrieving rubric." });
  }
});

/**
 * GET /api/rubrics/:rubricId
 * Lấy chi tiết rubric theo ID
 */
router.get("/:rubricId", authenticateToken, async (req, res) => {
  try {
    const rubric = await Rubric.findById(req.params.rubricId);
    if (!rubric) {
      return res.status(404).json({ message: "Rubric not found." });
    }

    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({
      order: 1,
      createdAt: 1,
    });
    res.json({ rubric, criteria });
  } catch (error) {
    console.error("Fetch Rubric By ID Error:", error.message);
    res.status(500).json({ message: "Server error retrieving rubric." });
  }
});

/**
 * PUT /api/rubrics/:rubricId
 * Sửa rubric
 */
router.put("/:rubricId", authenticateToken, async (req, res) => {
  try {
    const rubric = await loadRubricOr404(req.params.rubricId, res);
    if (!rubric) return;

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    if (rubric.isLocked) {
      return res
        .status(400)
        .json({ message: "Rubric is locked. It cannot be edited." });
    }

    const { name, description, totalWeight, maxCriterionScore, isActive } =
      req.body;

    if (name !== undefined) rubric.name = String(name).trim();
    if (description !== undefined) rubric.description = description;

    if (totalWeight !== undefined) {
      const parsedTotalWeight = toNumber(totalWeight, rubric.totalWeight);
      if (parsedTotalWeight > 100) {
        return res
          .status(400)
          .json({ message: "Rubric totalWeight cannot exceed 100." });
      }

      const criteriaSum = await getCriteriaSum(rubric._id);
      if (criteriaSum > parsedTotalWeight) {
        return res.status(400).json({
          message: `Cannot reduce rubric totalWeight below current criteria sum (${criteriaSum}).`,
        });
      }

      rubric.totalWeight = parsedTotalWeight;
    }

    if (maxCriterionScore !== undefined) {
      rubric.maxCriterionScore = toNumber(
        maxCriterionScore,
        rubric.maxCriterionScore,
      );
    }

    if (isActive !== undefined) {
      rubric.isActive = !!isActive;
    }

    await rubric.save();

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'update_rubric',
      details: `Cập nhật Rubric: ${rubric.name}`
    });
    await newLog.save();

    res.json(rubric);
  } catch (error) {
    console.error("Update Rubric Error:", error.message);
    res.status(500).json({ message: "Server error updating rubric." });
  }
});

/**
 * DELETE /api/rubrics/:rubricId
 * Xóa mềm rubric
 */
router.delete("/:rubricId", authenticateToken, async (req, res) => {
  try {
    const rubric = await loadRubricOr404(req.params.rubricId, res);
    if (!rubric) return;

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    if (rubric.isLocked) {
      return res
        .status(400)
        .json({ message: "Rubric is locked and cannot be deleted." });
    }

    rubric.isActive = false;
    await rubric.save();

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'delete_rubric',
      details: `Hủy kích hoạt Rubric: ${rubric.name}`
    });
    await newLog.save();

    res.json({ message: "Rubric deactivated successfully." });
  } catch (error) {
    console.error("Delete Rubric Error:", error.message);
    res.status(500).json({ message: "Server error deleting rubric." });
  }
});

/**
 * POST /api/rubrics/:rubricId/lock
 * Khóa rubric sau khi hoàn tất criteria
 */
router.post("/:rubricId/lock", authenticateToken, async (req, res) => {
  try {
    const rubric = await loadRubricOr404(req.params.rubricId, res);
    if (!rubric) return;

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    const criteria = await Criterion.find({ rubricId: rubric._id });
    const weightSum = criteria.reduce(
      (sum, criterion) => sum + Number(criterion.weight || 0),
      0,
    );

    if (Math.abs(weightSum - rubric.totalWeight) > 0.01) {
      return res.status(400).json({
        message: `Cannot lock rubric. The sum of criteria weights (${weightSum}) must match the rubric totalWeight (${rubric.totalWeight}).`,
      });
    }

    rubric.isLocked = true;
    rubric.lockedBy = req.user._id;
    rubric.lockedAt = new Date();
    await rubric.save();

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'lock_rubric',
      details: `Khóa Rubric: ${rubric.name}`
    });
    await newLog.save();

    res.json({ message: "Rubric locked and ready for grading.", rubric });
  } catch (error) {
    console.error("Lock Rubric Error:", error.message);
    res.status(500).json({ message: "Server error locking rubric." });
  }
});

/**
 * POST /api/rubrics/:rubricId/criteria
 * Thêm hoặc liên kết criterion mới trực tiếp qua rubric (Legacy URL support)
 */
router.post("/:rubricId/criteria", authenticateToken, async (req, res) => {
  const {
    code,
    name,
    description,
    weight,
    maxScore,
    excellentDescription,
    goodDescription,
    passedDescription,
    failedDescription,
    order,
    gradingLevels,
  } = req.body;

  if (!code || !name || weight === undefined) {
    return res
      .status(400)
      .json({ message: "Criterion code, name, and weight are required." });
  }

  try {
    const rubric = await loadRubricOr404(req.params.rubricId, res);
    if (!rubric) return;

    if (rubric.isLocked) {
      return res
        .status(400)
        .json({ message: "Rubric is locked. Criteria cannot be modified." });
    }

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    const duplicate = await Criterion.findOne({
      rubricId: rubric._id,
      code: String(code).trim().toUpperCase(),
    });

    if (duplicate) {
      return res
        .status(400)
        .json({
          message: "A criterion with this code already exists in this rubric.",
        });
    }

    const parsedWeight = Number(weight);
    if (Number.isNaN(parsedWeight)) {
      return res
        .status(400)
        .json({ message: "Criterion weight must be a number." });
    }

    const criteriaSum = await getCriteriaSum(rubric._id);
    if (criteriaSum + parsedWeight > rubric.totalWeight) {
      return res.status(400).json({
        message: `Cannot add criterion. Current weight sum (${criteriaSum}) plus new weight (${parsedWeight}) exceeds rubric totalWeight (${rubric.totalWeight}).`,
      });
    }

    let levels = [];
    if (Array.isArray(gradingLevels)) {
      levels = gradingLevels.map((lvl) => ({
        label: String(lvl.label || "").trim(),
        minScore: Number(lvl.minScore),
        maxScore: Number(lvl.maxScore),
        description: String(lvl.description || "").trim(),
      }));
    }

    const criterion = new Criterion({
      rubricId: rubric._id,
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      description,
      weight: parsedWeight,
      maxScore: maxScore !== undefined ? Number(maxScore) : 10,
      excellentDescription,
      goodDescription,
      passedDescription,
      failedDescription,
      order: order !== undefined ? parseInt(order, 10) : undefined,
      gradingLevels: levels,
    });

    await criterion.save();
    res.status(201).json(criterion);
  } catch (error) {
    console.error("Create Criterion Legacy Error:", error.message);
    res.status(500).json({ message: "Server error creating criterion." });
  }
});

/**
 * @route   GET /api/rubrics
 * @desc    Get all active rubrics with their criteria
 * @access  Private (Coordinator or Admin)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rubrics = await Rubric.find({ isActive: true })
      .populate('eventId', 'name')
      .populate('trackId', 'name')
      .populate('roundId', 'name');
    
    // Fetch criteria for each rubric
    const rubricsWithCriteria = await Promise.all(
      rubrics.map(async (r) => {
        const criteria = await Criterion.find({ rubricId: r._id }).sort({ order: 1 });
        return {
          ...r.toObject(),
          criteria
        };
      })
    );
    
    res.json(rubricsWithCriteria);
  } catch (error) {
    console.error('Fetch All Rubrics Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving rubrics.' });
  }
});

/**
 * @route   POST /api/rubrics/clone
 * @desc    Clone an existing rubric to a new event round
 * @access  Private (Coordinator or Admin)
 */
router.post('/clone', authenticateToken, async (req, res) => {
  const { fromRubricId, eventId, trackId, roundId, name } = req.body;

  if (!fromRubricId || !eventId || !roundId || !name) {
    return res.status(400).json({ message: 'From Rubric ID, Event ID, Round ID, and New Rubric Name are required.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: 'coordinator',
        status: 'active'
      });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
    }

    // Check if rubric already exists for this target round
    const existing = await Rubric.findOne({ roundId, isActive: true });
    if (existing) {
      return res.status(400).json({ message: 'An active rubric already exists for this round.' });
    }

    // Find source rubric
    const sourceRubric = await Rubric.findById(fromRubricId);
    if (!sourceRubric) {
      return res.status(404).json({ message: 'Source rubric not found.' });
    }

    // Create new rubric
    const newRubric = new Rubric({
      eventId,
      trackId: trackId || undefined,
      roundId,
      name,
      description: sourceRubric.description,
      totalWeight: sourceRubric.totalWeight,
      maxCriterionScore: sourceRubric.maxCriterionScore,
      createdBy: req.user._id
    });

    await newRubric.save();

    // Find source criteria and clone them
    const sourceCriteria = await Criterion.find({ rubricId: fromRubricId });
    const newCriteria = sourceCriteria.map(c => new Criterion({
      rubricId: newRubric._id,
      code: c.code,
      name: c.name,
      description: c.description,
      weight: c.weight,
      maxScore: c.maxScore,
      excellentDescription: c.excellentDescription,
      goodDescription: c.goodDescription,
      passedDescription: c.passedDescription,
      failedDescription: c.failedDescription,
      order: c.order
    }));

    await Criterion.insertMany(newCriteria);

    res.status(201).json({
      message: 'Rubric cloned successfully!',
      rubric: newRubric,
      criteria: newCriteria
    });

  } catch (error) {
    console.error('Clone Rubric Error:', error.message);
    res.status(500).json({ message: 'Server error cloning rubric.' });
  }
});

/**
/**
 * @route   GET /api/rubrics/:rubricId/export
 * @desc    Export a rubric and its criteria as JSON
 * @access  Private (Coordinator or Admin)
 */
router.get('/:rubricId/export', authenticateToken, async (req, res) => {
  try {
    const rubric = await Rubric.findById(req.params.rubricId);
    if (!rubric) return res.status(404).json({ message: 'Rubric not found.' });

    // Auth check
    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });

    const exportData = {
      name: rubric.name,
      description: rubric.description,
      totalWeight: rubric.totalWeight,
      maxCriterionScore: rubric.maxCriterionScore,
      criteria: criteria.map(c => ({
        code: c.code,
        name: c.name,
        description: c.description,
        weight: c.weight,
        maxScore: c.maxScore,
        excellentDescription: c.excellentDescription,
        goodDescription: c.goodDescription,
        passedDescription: c.passedDescription,
        failedDescription: c.failedDescription,
        order: c.order,
        gradingLevels: c.gradingLevels ? c.gradingLevels.map(lvl => ({
          label: lvl.label,
          minScore: lvl.minScore,
          maxScore: lvl.maxScore,
          description: lvl.description
        })) : []
      }))
    };

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'export_rubric',
      details: `Xuất cấu hình Rubric: ${rubric.name} thành file JSON`
    });
    await newLog.save();

    res.setHeader('Content-disposition', `attachment; filename=rubric-${rubric._id}.json`);
    res.setHeader('Content-type', 'application/json');
    res.json(exportData);

  } catch (error) {
    console.error('Export Rubric Error:', error.message);
    res.status(500).json({ message: 'Server error exporting rubric.' });
  }
});

/**
 * GET /api/rubrics/template/download
 * Download file Excel template mẫu cho import criteria
 */
router.get('/template/download', authenticateToken, async (req, res) => {
  try {
    const wb = XLSX.utils.book_new();

    // Header row 1 + row 2 matching Template_Criteria (1).xlsx exactly
    const headers = [
      ["Mã tiêu chí", "Tiêu chí", "Trọng số (%)", "Các mức độ chấm điểm", "", "", ""],
      ["", "", "", "Xuất sắc (9.0 - 10.0)", "Tốt (7.0 - 8.9)", "Đạt (5.0 - 6.9)", "Chưa đạt (0.0 - 4.9)"]
    ];

    // Data rows matching Template_Criteria (1).xlsx exactly
    const sampleData = [
      [
        "R1_01",
        "Tính đúng đắn & Hoàn thiện chức năng",
        30,
        "Hoàn thành đầy đủ, kết quả đúng, hệ thống chạy ổn định",
        "Hoàn thành phần lớn, ít lỗi nhỏ, kết quả cơ bản đúng",
        "Hoàn thành một phần, còn lỗi, kết quả chưa ổn định",
        "Không chạy được hoặc sai lệch nhiều"
      ],
      [
        "R1_02",
        "Ứng dụng AI trong giải pháp",
        25,
        "AI tích hợp hợp lý, có giá trị rõ ràng trong SDLC",
        "Có ứng dụng AI nhưng còn hạn chế về chiều sâu",
        "Ứng dụng AI ở mức cơ bản, chưa thể hiện vai trò rõ",
        "Không có ứng dụng AI hoặc chỉ dừng ở hình thức"
      ],
      [
        "R1_03",
        "Thiết kế & Kiến trúc phần mềm",
        15,
        "Kiến trúc rõ ràng, có sơ đồ minh họa, dễ mở rộng",
        "Kiến trúc hợp lý nhưng chưa tối ưu",
        "Có kiến trúc nhưng rời rạc, thiếu minh họa",
        "Không có thiết kế/khó hiểu"
      ],
      [
        "R1_04",
        "Thuyết trình & Demo",
        20,
        "Trình bày rõ ràng, demo mượt, trả lời phản biện xuất sắc",
        "Trình bày tốt, demo chạy được, trả lời khá tốt",
        "Thuyết trình cơ bản, demo hạn chế, trả lời chưa thuyết phục",
        "Thuyết trình rời rạc, demo thất bại"
      ],
      [
        "R1_05",
        "Teamwork & Tinh thần làm việc",
        10,
        "Phân công hợp lý, teamwork mượt mà",
        "Có phối hợp nhưng chưa thật sự đồng đều",
        "Teamwork ở mức tối thiểu, chưa thể hiện sự ăn ý",
        "Không phối hợp, chỉ 1–2 người làm chính"
      ]
    ];

    const wsData = [...headers, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set merged cells for header
    ws['!merges'] = [
      // "Các mức độ chấm điểm" merged across D1:G1
      { s: { r: 0, c: 3 }, e: { r: 0, c: 6 } },
      // "Mã tiêu chí" merged A1:A2
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      // "Tiêu chí" merged B1:B2
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      // "Trọng số (%)" merged C1:C2
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
    ];

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // A - Mã tiêu chí
      { wch: 30 }, // B - Tiêu chí
      { wch: 14 }, // C - Trọng số
      { wch: 25 }, // D - Xuất sắc
      { wch: 25 }, // E - Tốt
      { wch: 25 }, // F - Đạt
      { wch: 25 }, // G - Chưa đạt
    ];

    styleWorksheet(ws);

    XLSX.utils.book_append_sheet(wb, ws, 'R1_Rubrics');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=Template_Criteria.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Download Template Error:', error.message);
    res.status(500).json({ message: 'Server error generating template.' });
  }
});

/**
 * @route   POST /api/rubrics/import
 * @desc    Import a rubric from JSON
 * @access  Private (Coordinator or Admin)
 */
router.post('/import', authenticateToken, async (req, res) => {
  const { eventId, trackId, roundId, rubricData } = req.body;

  if (!eventId || !roundId || !rubricData) {
    return res.status(400).json({ message: 'Event ID, Round ID, and Rubric data are required.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: 'coordinator',
        status: 'active'
      });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
    }

    // Check if rubric already exists for this target round
    const existing = await Rubric.findOne({ roundId, isActive: true });
    if (existing) {
      return res.status(400).json({ message: 'An active rubric already exists for this round.' });
    }

    // Create new rubric
    const newRubric = new Rubric({
      eventId,
      trackId: trackId || undefined,
      roundId,
      name: rubricData.name || 'Imported Rubric',
      description: rubricData.description || '',
      totalWeight: rubricData.totalWeight || 100,
      maxCriterionScore: rubricData.maxCriterionScore || 10,
      createdBy: req.user._id
    });

    await newRubric.save();

    // Create criteria
    const criteriaList = [];
    if (Array.isArray(rubricData.criteria)) {
      for (const c of rubricData.criteria) {
        const criterion = new Criterion({
          rubricId: newRubric._id,
          code: String(c.code).trim().toUpperCase(),
          name: String(c.name).trim(),
          description: c.description || '',
          weight: Number(c.weight || 0),
          maxScore: c.maxScore !== undefined ? Number(c.maxScore) : 10,
          excellentDescription: c.excellentDescription || '',
          goodDescription: c.goodDescription || '',
          passedDescription: c.passedDescription || '',
          failedDescription: c.failedDescription || '',
          order: c.order,
          gradingLevels: Array.isArray(c.gradingLevels) ? c.gradingLevels.map(lvl => ({
            label: String(lvl.label || '').trim(),
            minScore: Number(lvl.minScore || 0),
            maxScore: Number(lvl.maxScore || 0),
            description: String(lvl.description || '').trim()
          })) : []
        });
        criteriaList.push(criterion);
      }
      await Criterion.insertMany(criteriaList);
    }

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'import_rubric',
      details: `Nhập cấu hình Rubric mới từ file JSON: ${newRubric.name}`
    });
    await newLog.save();

    res.status(201).json({
      message: 'Rubric imported successfully!',
      rubric: newRubric,
      criteria: criteriaList
    });

  } catch (error) {
    console.error('Import Rubric Error:', error.message);
    res.status(500).json({ message: 'Server error importing rubric.' });
  }
});

/**
 * POST /api/rubrics/:rubricId/import-criteria
 * Import và đồng bộ hóa criteria từ file Excel upload
 * Hỗ trợ Thêm mới, Cập nhật tiêu chí trùng mã, và Xóa tiêu chí bị thiếu trong file Excel
 */
router.post('/:rubricId/import-criteria', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    // 1. Load and validate rubric
    const rubric = await Rubric.findById(req.params.rubricId);
    if (!rubric) {
      return res.status(404).json({ message: 'Rubric not found.' });
    }

    if (rubric.isLocked) {
      return res.status(400).json({ message: 'Rubric đã bị khóa. Không thể thay đổi tiêu chí.' });
    }

    // Check permissions
    if (!req.user.isSystemAdmin) {
      const role = await EventRole.findOne({
        userId: req.user._id,
        eventId: rubric.eventId,
        role: 'coordinator',
        status: 'active',
      });
      if (!role) {
        return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
      }
    }

    // 2. Check file
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng upload file Excel (.xlsx).' });
    }

    // 3. Parse Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ message: 'File Excel không có sheet nào.' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawData.length < 3) {
      return res.status(400).json({
        message: 'File Excel phải có ít nhất 2 hàng header và 1 hàng dữ liệu.',
      });
    }

    // 4. Parse grading levels from row 2 (index 1)
    const headerRow2 = rawData[1];
    const gradingLevelDefs = [];
    const gradingLevelRegex = /^(.+?)\s*\(\s*([\d.]+)\s*-\s*([\d.]+)\s*\)$/;

    for (let col = 3; col < headerRow2.length; col++) {
      const headerVal = String(headerRow2[col] || '').trim();
      if (!headerVal) continue; // skip empty columns

      const match = headerVal.match(gradingLevelRegex);
      if (!match) {
        return res.status(400).json({
          message: `Cột ${String.fromCharCode(65 + col)} header mức chấm không đúng format. Yêu cầu: "Tên mức (min - max)", ví dụ: "Xuất sắc (9.0 - 10.0)". Giá trị hiện tại: "${headerVal}"`,
        });
      }

      gradingLevelDefs.push({
        colIndex: col,
        label: match[1].trim(),
        minScore: parseFloat(match[2]),
        maxScore: parseFloat(match[3]),
      });
    }

    // 5. Parse data rows (from row 3 onward, index 2+)
    const existingCriteria = await Criterion.find({ rubricId: rubric._id });

    const toImport = [];
    const errors = [];
    let newWeightSum = 0;
    let nextOrder = 1;

    for (let rowIdx = 2; rowIdx < rawData.length; rowIdx++) {
      const row = rawData[rowIdx];
      const rowNum = rowIdx + 1; // 1-based for user display

      const code = String(row[0] || '').trim().toUpperCase();
      const name = String(row[1] || '').trim();
      const weightRaw = row[2];

      // Skip completely empty rows
      if (!code && !name && (weightRaw === '' || weightRaw === undefined)) {
        continue;
      }

      // Validate required fields
      if (!code) {
        errors.push(`Dòng ${rowNum}: Thiếu mã tiêu chí (cột A).`);
        continue;
      }
      if (!name) {
        errors.push(`Dòng ${rowNum}: Thiếu tên tiêu chí (cột B).`);
        continue;
      }

      const weight = Number(weightRaw);
      if (isNaN(weight) || weight <= 0) {
        errors.push(`Dòng ${rowNum}: Trọng số không hợp lệ (cột C). Giá trị: "${weightRaw}"`);
        continue;
      }

      // Check duplicate within import file
      if (toImport.some((item) => item.code === code)) {
        errors.push(`Dòng ${rowNum}: Mã "${code}" bị trùng trong file import.`);
        continue;
      }

      // Build grading levels for this row and validate none are empty
      let missingLevel = false;
      const gradingLevels = [];
      for (const def of gradingLevelDefs) {
        const desc = String(row[def.colIndex] || '').trim();
        if (!desc) {
          errors.push(`Dòng ${rowNum}: Thiếu mô tả cho mức chấm điểm "${def.label}" (Cột ${String.fromCharCode(65 + def.colIndex)}).`);
          missingLevel = true;
        }
        gradingLevels.push({
          label: def.label,
          minScore: def.minScore,
          maxScore: def.maxScore,
          description: desc,
        });
      }

      if (missingLevel) {
        continue;
      }

      newWeightSum += weight;

      toImport.push({
        rubricId: rubric._id,
        code,
        name,
        weight,
        maxScore: rubric.maxCriterionScore || 10,
        order: nextOrder++,
        gradingLevels,
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Có lỗi dữ liệu trong file Excel.',
        errors,
        imported: 0,
      });
    }

    if (toImport.length === 0) {
      return res.status(400).json({
        message: 'Không có tiêu chí hợp lệ nào trong file Excel.',
        errors,
        imported: 0,
      });
    }

    // 6. Validate total weight
    if (newWeightSum > rubric.totalWeight) {
      return res.status(400).json({
        message: `Không thể import. Tổng trọng số của file Excel (${newWeightSum}%) vượt quá giới hạn của Rubric (${rubric.totalWeight}%).`,
        errors,
        imported: 0,
      });
    }

    // 7. Sync logic: Determine adds, updates, deletes
    const importCodes = new Set(toImport.map((item) => item.code));
    const toDeleteIds = existingCriteria
      .filter((c) => !importCodes.has(c.code.toUpperCase()))
      .map((c) => c._id);

    // Delete missing criteria
    if (toDeleteIds.length > 0) {
      await Criterion.deleteMany({ _id: { $in: toDeleteIds } });
    }

    // Insert new / Update existing
    let insertedCount = 0;
    let updatedCount = 0;
    const toInsert = [];

    for (const item of toImport) {
      const existing = existingCriteria.find((c) => c.code.toUpperCase() === item.code);
      if (existing) {
        existing.name = item.name;
        existing.weight = item.weight;
        existing.gradingLevels = item.gradingLevels;
        existing.maxScore = item.maxScore;
        existing.order = item.order;
        await existing.save();
        updatedCount++;
      } else {
        toInsert.push(item);
      }
    }

    if (toInsert.length > 0) {
      const inserted = await Criterion.insertMany(toInsert);
      insertedCount = inserted.length;
    }

    // Return the final list of criteria
    const finalCriteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });

    res.status(201).json({
      message: `Đồng bộ tiêu chí thành công!`,
      imported: insertedCount,
      updated: updatedCount,
      deleted: toDeleteIds.length,
      errorCount: errors.length,
      errors,
      criteria: finalCriteria,
    });
  } catch (error) {
    console.error('Import Criteria Error:', error.message);
    if (error.message === 'Chỉ chấp nhận file Excel (.xlsx, .xls)') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error importing criteria.' });
  }
});

/**
 * GET /api/rubrics/:rubricId/export-criteria
 * Xuất danh sách criteria hiện tại ra file Excel để chỉnh sửa / xóa
 */
router.get('/:rubricId/export-criteria', authenticateToken, async (req, res) => {
  try {
    // 1. Load rubric
    const rubric = await Rubric.findById(req.params.rubricId);
    if (!rubric) {
      return res.status(404).json({ message: 'Rubric not found.' });
    }

    // Check permissions
    if (!req.user.isSystemAdmin) {
      const role = await EventRole.findOne({
        userId: req.user._id,
        eventId: rubric.eventId,
        role: 'coordinator',
        status: 'active',
      });
      if (!role) {
        return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
      }
    }

    // 2. Load criteria
    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });

    // 3. Extract grading level definitions
    let gradingLevelDefs = [];
    const firstWithLevels = criteria.find(c => c.gradingLevels && c.gradingLevels.length > 0);
    if (firstWithLevels) {
      gradingLevelDefs = firstWithLevels.gradingLevels.map(lvl => ({
        label: lvl.label,
        minScore: lvl.minScore,
        maxScore: lvl.maxScore
      }));
    } else {
      // Default fallback grading levels definitions
      gradingLevelDefs = [
        { label: 'Xuất sắc', minScore: 9.0, maxScore: 10.0 },
        { label: 'Tốt', minScore: 7.0, maxScore: 8.9 },
        { label: 'Đạt', minScore: 5.0, maxScore: 6.9 },
        { label: 'Chưa đạt', minScore: 0.0, maxScore: 4.9 }
      ];
    }

    // 4. Create Workbook & Worksheet
    const wb = XLSX.utils.book_new();

    // Headers Construction
    const row1 = ['Mã tiêu chí', 'Tiêu chí', 'Trọng số (%)', 'Các mức độ chấm điểm'];
    for (let i = 1; i < gradingLevelDefs.length; i++) {
      row1.push(''); // spacing for merges
    }

    const row2 = ['', '', ''];
    for (const def of gradingLevelDefs) {
      row2.push(`${def.label} (${def.minScore.toFixed(1)} - ${def.maxScore.toFixed(1)})`);
    }

    const headers = [row1, row2];

    // Data rows
    const dataRows = [];
    for (const c of criteria) {
      const row = [c.code, c.name, c.weight];
      for (const def of gradingLevelDefs) {
        const match = c.gradingLevels && c.gradingLevels.find(
          lvl => lvl.label === def.label &&
                 Math.abs(lvl.minScore - def.minScore) < 0.01 &&
                 Math.abs(lvl.maxScore - def.maxScore) < 0.01
        );
        row.push(match ? match.description : '');
      }
      dataRows.push(row);
    }

    const wsData = [...headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Dynamic Merging rules
    ws['!merges'] = [
      { s: { r: 0, c: 3 }, e: { r: 0, c: 3 + gradingLevelDefs.length - 1 } }, // merging "Các mức độ chấm điểm" header
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // "Mã tiêu chí" header merge
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // "Tiêu chí" header merge
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // "Trọng số (%)" header merge
    ];

    // Columns width
    ws['!cols'] = [
      { wch: 15 }, // A
      { wch: 30 }, // B
      { wch: 14 }, // C
    ];
    for (let i = 0; i < gradingLevelDefs.length; i++) {
      ws['!cols'].push({ wch: 25 });
    }

    styleWorksheet(ws);

    const sanitizedSheetName = rubric.name.substring(0, 30).replace(/[*?:\\/\[\]]/g, '') || 'Criteria';
    XLSX.utils.book_append_sheet(wb, ws, sanitizedSheetName);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safeFilename = `Criteria_${rubric.name.replace(/\s+/g, '_')}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(safeFilename)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Export Criteria Error:', error.message);
    res.status(500).json({ message: 'Server error exporting criteria.' });
  }
});

module.exports = router;
