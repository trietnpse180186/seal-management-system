const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const XLSX = require("xlsx");

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
const { authenticateToken } = require("../middleware/authMiddleware");

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
 * GET /api/rubrics/template/download
 * Download file Excel template mẫu cho import criteria
 */
router.get('/template/download', authenticateToken, async (req, res) => {
  try {
    const wb = XLSX.utils.book_new();

    // Header row 1 + row 2
    const headers = [
      ['Mã tiêu chí', 'Tiêu chí', 'Trọng số (%)', 'Các mức độ chấm điểm', '', '', '', ''],
      ['', '', '', 'Xuất sắc (9.0 - 10.0)', 'Tốt (7.0 - 8.9)', 'Khá (5.0 - 6.9)', 'Trung bình (3.0 - 4.9)', 'Yếu (0.0 - 2.9)'],
    ];

    // Sample data row
    const sampleData = [
      ['TC-01', 'Tên tiêu chí mẫu', 20, 'Mô tả mức xuất sắc', 'Mô tả mức tốt', 'Mô tả mức khá', 'Mô tả mức trung bình', 'Mô tả mức yếu'],
    ];

    const wsData = [...headers, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set merged cells for header
    ws['!merges'] = [
      // "Các mức độ chấm điểm" merged across D1:H1
      { s: { r: 0, c: 3 }, e: { r: 0, c: 7 } },
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
      { wch: 25 }, // F - Khá
      { wch: 25 }, // G - Trung bình
      { wch: 25 }, // H - Yếu
    ];

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
 * POST /api/rubrics/:rubricId/import-criteria
 * Import criteria từ file Excel upload
 * Grading levels được parse động từ header row 2 (format: "Label (min - max)")
 */
router.post('/:rubricId/import-criteria', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    // 1. Load and validate rubric
    const rubric = await Rubric.findById(req.params.rubricId);
    if (!rubric) {
      return res.status(404).json({ message: 'Rubric not found.' });
    }

    if (rubric.isLocked) {
      return res.status(400).json({ message: 'Rubric đã bị khóa. Không thể import thêm tiêu chí.' });
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

    // 4. Parse grading levels from row 2 (index 1) — dynamic columns from D onward
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
    const existingCodes = new Set(existingCriteria.map((c) => c.code.toUpperCase()));
    const currentWeightSum = existingCriteria.reduce((sum, c) => sum + (c.weight || 0), 0);

    const toImport = [];
    const errors = [];
    const skipped = [];
    let newWeightSum = 0;

    // Find current max order
    const maxOrderCrit = await Criterion.findOne({ rubricId: rubric._id }).sort({ order: -1 });
    let nextOrder = maxOrderCrit && typeof maxOrderCrit.order === 'number' ? maxOrderCrit.order + 1 : 1;

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

      // Check duplicate code
      if (existingCodes.has(code)) {
        skipped.push(`Dòng ${rowNum}: Mã "${code}" đã tồn tại trong rubric, bỏ qua.`);
        continue;
      }

      // Check duplicate within import file
      if (toImport.some((item) => item.code === code)) {
        errors.push(`Dòng ${rowNum}: Mã "${code}" bị trùng trong file import.`);
        continue;
      }

      // Build grading levels for this row
      const gradingLevels = gradingLevelDefs.map((def) => ({
        label: def.label,
        minScore: def.minScore,
        maxScore: def.maxScore,
        description: String(row[def.colIndex] || '').trim(),
      }));

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

    // 6. Validate total weight
    if (currentWeightSum + newWeightSum > rubric.totalWeight) {
      return res.status(400).json({
        message: `Không thể import. Tổng trọng số hiện tại (${currentWeightSum}) + trọng số mới (${newWeightSum}) = ${currentWeightSum + newWeightSum} vượt quá giới hạn rubric (${rubric.totalWeight}).`,
        errors,
        skipped,
      });
    }

    if (toImport.length === 0) {
      return res.status(400).json({
        message: 'Không có tiêu chí hợp lệ nào để import.',
        errors,
        skipped,
      });
    }

    // 7. Bulk insert
    const insertedCriteria = await Criterion.insertMany(toImport);

    res.status(201).json({
      message: `Import hoàn tất! Đã thêm ${insertedCriteria.length} tiêu chí.`,
      imported: insertedCriteria.length,
      skipped: skipped.length,
      errorCount: errors.length,
      errors,
      skippedDetails: skipped,
      criteria: insertedCriteria,
    });
  } catch (error) {
    console.error('Import Criteria Error:', error.message);

    // Handle multer errors
    if (error.message === 'Chỉ chấp nhận file Excel (.xlsx, .xls)') {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Server error importing criteria.' });
  }
});

module.exports = router;
