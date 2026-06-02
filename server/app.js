require("dotenv").config();
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const mongoose = require("mongoose");

// Import all models to register their schemas in Mongoose
require("./models/User");
require("./models/Event");
require("./models/Track");
require("./models/Round");
require("./models/EventRole");
require("./models/Rubric");
require("./models/Criterion");
require("./models/Team");
require("./models/TeamMember");
require("./models/GithubRepository");
require("./models/RepositorySnapshot");
require("./models/Commit");
require("./models/CommitFile");
require("./models/AiAnalysis");
require("./models/Score");
require("./models/ScoreDetail");
require("./models/Ranking");
require("./models/Prize");
require("./models/Notification");
require("./models/AuditLog");
require("./models/GradingLevel");
const app = express();

// Connect to MongoDB
const mongoUri =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/seal-hackathon";
mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log(
      "Connected to MongoDB successfully at:",
      mongoUri.split("@").pop(),
    );

    // Auto-create default system admin if not exists
    try {
      const User = mongoose.model('User');
      const bcrypt = require('bcryptjs');
      const adminExists = await User.exists({ email: 'admin@seal.com' });
      if (!adminExists) {
        console.log("Auto-creating default system admin (admin@seal.com)...");
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password123', salt);
        const newAdmin = new User({
          email: 'admin@seal.com',
          passwordHash,
          fullName: 'System Administrator',
          githubUsername: 'seal-admin',
          isSystemAdmin: true,
          isApproved: true,
          isActive: true
        });
        await newAdmin.save();
        console.log("Default system admin auto-created successfully!");
      }
    } catch (err) {
      console.error("Error auto-creating admin account on startup:", err.message);
    }
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
  });

// Configure CORS
app.use(
  cors({
    origin: "*", // For development, allow all. In production, restrict as needed.
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Routers
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const eventsRouter = require('./routes/events');
const teamsRouter = require('./routes/teams');
const rubricsRouter = require('./routes/rubrics');
const criteriaRouter = require('./routes/criteria');
const gradesRouter = require('./routes/grades');
const analyticsRouter = require('./routes/analytics');
const notificationsRouter = require('./routes/notifications');
const githubRepositoriesRouter = require('./routes/githubRepositories');
const aiAnalysesRouter = require('./routes/aiAnalyses');

app.use('/api', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/rubrics', rubricsRouter);
app.use('/api/criteria', criteriaRouter);
app.use('/api/grades', gradesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/github-repositories', githubRepositoriesRouter);
app.use('/api/ai-analyses', aiAnalysesRouter);

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  console.error("Express Error Handler:", err);

  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: req.app.get("env") === "development" ? err : {},
  });
});

module.exports = app;
