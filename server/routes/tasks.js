const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Team = require("../models/Team");
const EventRole = require("../models/EventRole");
const { authenticateToken } = require("../middleware/authMiddleware");

// GET /api/tasks/team/:teamId
// Lấy danh sách nhiệm vụ của một đội
router.get("/team/:teamId", authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find({ teamId: req.params.teamId })
      .populate("assigneeId", "fullName email")
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// POST /api/tasks
// Tạo nhiệm vụ mới (Mentor hoặc Thành viên đội đều có thể tạo)
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { teamId, title, description, assigneeId, dueDate } = req.body;

    // TODO: Verify if user has permission (is team member or mentor for this team's track)
    // Giả sử đã qua các bước kiểm tra quyền để rút gọn

    const newTask = new Task({
      teamId,
      title,
      description,
      assigneeId: assigneeId || null,
      dueDate,
      createdBy: req.user._id,
      status: "TODO"
    });

    const task = await newTask.save();
    
    await task.populate("assigneeId", "fullName email");
    await task.populate("createdBy", "fullName email");

    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// PUT /api/tasks/:id
// Cập nhật nhiệm vụ (thay đổi trạng thái, assignee,...)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { title, description, assigneeId, status, dueDate } = req.body;

    let task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ msg: "Task not found" });
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (assigneeId !== undefined) task.assigneeId = assigneeId || null;
    if (status !== undefined) task.status = status;
    if (dueDate !== undefined) task.dueDate = dueDate;

    await task.save();
    
    await task.populate("assigneeId", "fullName email");
    await task.populate("createdBy", "fullName email");

    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// DELETE /api/tasks/:id
// Xóa nhiệm vụ
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ msg: "Task not found" });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ msg: "Task removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
