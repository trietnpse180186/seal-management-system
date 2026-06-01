const mongoose = require("mongoose");
require("dotenv").config();

// MOCK data and config
const BASE_URL = "http://localhost:5000/api";

// We require all models so Mongoose registers them
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

async function runTests() {
  console.log("=== STARTING SEAL HACKATHON SCENARIO TESTS ===");

  // 1. Connect to MongoDB and clear the database
  const mongoUri =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/seal-hackathon";
  console.log(`Connecting to database: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log("Connected. Clearing test collections...");

  // Drop database or clear all collections to ensure fresh state
  // try {
  //   await mongoose.connection.db.dropDatabase();
  //   console.log('Database dropped to ensure fresh state.');
  // } catch (err) {
  //   console.log('dropDatabase failed/restricted, clearing collections manually...');
  // }
  // const collections = Object.keys(mongoose.connection.collections);
  // for (const name of collections) {
  //   await mongoose.connection.collections[name].deleteMany({});
  // }
  // console.log('All collections cleared.');

  // Helper for HTTP Post
  const post = async (url, data, token) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(`${BASE_URL}${url}`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      const responseData = await res.json();
      if (!res.ok) {
        console.error(
          `POST ${url} failed with status ${res.status}:`,
          responseData,
        );
        throw new Error(responseData.message || `HTTP ${res.status}`);
      }
      return responseData;
    } catch (err) {
      console.error(`POST ${url} failed:`, err.message);
      throw err;
    }
  };

  // Helper for HTTP Get
  const get = async (url, token) => {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(`${BASE_URL}${url}`, {
        method: "GET",
        headers,
      });
      const responseData = await res.json();
      if (!res.ok) {
        console.error(
          `GET ${url} failed with status ${res.status}:`,
          responseData,
        );
        throw new Error(responseData.message || `HTTP ${res.status}`);
      }
      return responseData;
    } catch (err) {
      console.error(`GET ${url} failed:`, err.message);
      throw err;
    }
  };

  // 2. Register Admin User (First user is automatically system admin)
  console.log("\n[Step 2] Registering System Admin...");
  const adminReg = await post("/auth/register", {
    email: "admin@seal.com",
    password: "password123",
    fullName: "System Administrator",
    githubUsername: "seal-admin",
  });
  const adminToken = adminReg.token;
  console.log(
    `Admin registered: ${adminReg.user.fullName} (isSystemAdmin: ${adminReg.user.isSystemAdmin})`,
  );

  // 3. Create Event
  console.log("\n[Step 3] Creating Event (Spring 2026)...");
  const eventResponse = await post(
    "/events",
    {
      name: "SEAL Hackathon Spring 2026",
      semester: "Spring",
      year: 2026,
      description: "The premier software engineering hackathon.",
      maxTeams: 10,
    },
    adminToken,
  );
  const event = eventResponse.event;
  const eventId = event._id;
  console.log(`Event created: ${event.name} (ID: ${eventId})`);

  // 4. Create Round inside Event
  console.log("\n[Step 4] Creating Vòng loại (Round 1)...");
  const round = await post(
    `/events/${eventId}/rounds`,
    {
      name: "Vòng sơ loại ý tưởng & Codebase",
      order: 1,
      submissionDeadline: new Date(Date.now() + 86400000 * 7), // 7 days from now
      advanceTopN: 2,
    },
    adminToken,
  );
  const roundId = round._id;
  console.log(`Round created: ${round.name} (ID: ${roundId})`);

  // 5. Create Track inside Event
  console.log("\n[Step 5] Creating Track (Web Application)...");
  const track = await post(
    `/events/${eventId}/tracks`,
    {
      name: "Web Application Development",
      description: "Build premium responsive web products using React & Node.",
      maxTeams: 5,
      roundId: roundId,
    },
    adminToken,
  );
  const trackId = track._id;
  console.log(`Track created: ${track.name} (ID: ${trackId})`);

  // 6. Create Rubric & Criteria
  console.log("\n[Step 6] Creating Rubric and Criteria...");
  const rubric = await post(
    "/rubrics",
    {
      eventId,
      trackId,
      roundId,
      name: "Rubric Đánh giá Vòng sơ loại",
      totalWeight: 1.0,
    },
    adminToken,
  );
  const rubricId = rubric._id;
  console.log(`Rubric created: ${rubric.name} (ID: ${rubricId})`);

  // Add Criterion 1: CODE (weight 0.6)
  const crit1 = await post(
    `/rubrics/${rubricId}/criteria`,
    {
      code: "CODE",
      name: "Chất lượng Mã nguồn & Kiến trúc",
      weight: 0.6,
      maxScore: 10,
      description:
        "Đánh giá cấu trúc thư mục, Clean Code và các design pattern áp dụng.",
    },
    adminToken,
  );

  // Add Criterion 2: TEAM (weight 0.4)
  const crit2 = await post(
    `/rubrics/${rubricId}/criteria`,
    {
      code: "TEAM",
      name: "Tương tác Git & Đóng góp thành viên",
      weight: 0.4,
      maxScore: 10,
      description:
        "Tần suất commit, sự phối hợp phân tách nhánh và đóng góp cân bằng giữa các thành viên.",
    },
    adminToken,
  );
  console.log("Criteria added successfully.");

  // Lock Rubric so judges can submit grades
  const lockedRubricResponse = await post(
    `/rubrics/${rubricId}/lock`,
    {},
    adminToken,
  );
  const lockedRubric = lockedRubricResponse.rubric;
  console.log(`Rubric locked state: ${lockedRubric.isLocked}`);

  // 7. Register Team Leader and Members
  console.log("\n[Step 7] Registering Leader & Members...");
  const leaderReg = await post("/auth/register", {
    email: "leader@seal.com",
    password: "password123",
    fullName: "Nguyen Van Leader",
    githubUsername: "git-leader-seal",
    studentId: "SE180001",
  });

  console.log(
    "Leader registration response received. Verifying email token from DB...",
  );
  const User = mongoose.model("User");
  const leaderUser = await User.findOne({ email: "leader@seal.com" });
  const verifyToken = leaderUser.emailVerificationToken;
  console.log(`Verification token from DB: ${verifyToken}`);

  // Call verify-email endpoint
  const verifyRes = await fetch(
    `http://localhost:5000/api/auth/verify-email?token=${verifyToken}`,
  );
  const verifyHtml = await verifyRes.text();
  if (verifyHtml.includes("NODE_ACTIVATED")) {
    console.log("Leader email verified successfully (Status 200 OK)");
  } else {
    throw new Error("Failed to verify email for Leader");
  }

  // Login to get token
  console.log("Logging in verified Leader...");
  const leaderLogin = await post("/auth/login", {
    email: "leader@seal.com",
    password: "password123",
  });
  const leaderToken = leaderLogin.token;
  console.log(
    `Leader logged in successfully. Token: ${leaderToken.substring(0, 15)}...`,
  );

  // 8. Register Team & Invite Members
  console.log(
    '\n[Step 8] Registering Team "Dev Rangers" and inviting member1 & member2...',
  );
  const teamReg = await post(
    "/teams/register",
    {
      eventId,
      trackId,
      teamName: "Dev Rangers",
      membersList: [
        {
          email: "member1@seal.com",
          fullName: "Tran Member One",
          githubUsername: "member1-git",
          studentId: "SE180002",
        },
        {
          email: "member2@seal.com",
          fullName: "Le Member Two",
          githubUsername: "member2-git",
          studentId: "SE180003",
        },
      ],
    },
    leaderToken,
  );
  const teamId = teamReg.teamId;
  console.log(
    `Team registered successfully with ID: ${teamId}. Status is: ${teamReg.status}`,
  );

  // 9. Query DB for confirmation tokens
  console.log(
    "\n[Step 9] Fetching confirmation tokens from DB for invited members...",
  );
  const TeamMember = mongoose.model("TeamMember");
  const invitedMembers = await TeamMember.find({ teamId, role: "member" });
  console.log(`Found ${invitedMembers.length} pending members.`);

  // 10. Confirm Member invitations via API endpoint
  console.log(
    "\n[Step 10] Confirming member invitations via API token links...",
  );
  for (const m of invitedMembers) {
    const token = m.confirmTokenHash;
    console.log(`Confirming invitation for member with token: ${token}`);
    const res = await fetch(
      `http://localhost:5000/api/teams/confirm-invite?token=${token}`,
    );
    const htmlResponse = await res.text();
    if (htmlResponse.includes("Participation Confirmed!")) {
      console.log(`Successfully confirmed member (Status 200 OK).`);
    } else {
      throw new Error(`Failed to confirm member with token ${token}`);
    }
  }

  // 11. Verify Team is now confirmed
  console.log("\n[Step 11] Verifying Team Status & Repo auto-provisioning...");
  const Team = mongoose.model("Team");
  const GithubRepository = mongoose.model("GithubRepository");
  const teamDoc = await Team.findById(teamId);
  console.log(`Team Status is now: ${teamDoc.status} (Expected: confirmed)`);
  if (teamDoc.status !== "confirmed") {
    throw new Error(
      `Team status should be confirmed, but got ${teamDoc.status}`,
    );
  }

  const repoDoc = await GithubRepository.findOne({ teamId });
  console.log(
    `GitHub Repo Auto-created: ${repoDoc.repoName} (URL: ${repoDoc.repoUrl})`,
  );

  // 12. Submit project topic details (Leader)
  console.log("\n[Step 12] Submitting team project topic...");
  const topicSubmit = await post(
    "/teams/submit-topic",
    {
      teamId,
      title: "SEAL Hackathon Core Platform",
      description:
        "An enterprise management system for handling seals and contests.",
      documentationLink:
        "https://github.com/seal-hackathon-2026/dev-rangers/blob/main/README.md",
    },
    leaderToken,
  );
  console.log(`Topic submitted: "${topicSubmit.submission.title}"`);

  // 13. Sync repository to simulate commits & run Gemini AI analyses
  console.log(
    "\n[Step 13] Syncing mock repository commits and triggering Gemini AI Analyzer...",
  );
  const syncResult = await post(
    `/analytics/repo/${repoDoc._id}/sync`,
    {},
    leaderToken,
  );
  console.log(`Repo Sync Result: ${syncResult.message}`);

  // Verify commits saved in DB
  const Commit = mongoose.model("Commit");
  const commitsCount = await Commit.countDocuments({ teamId });
  console.log(`Number of sync-fetched commits in DB: ${commitsCount}`);

  const AiAnalysis = mongoose.model("AiAnalysis");
  const aiReportCount = await AiAnalysis.countDocuments({ teamId });
  console.log(`Number of Gemini AI analysis reports in DB: ${aiReportCount}`);

  // 14. Request AI Grading Suggestion
  console.log("\n[Step 14] Querying AI suggested grading scores...");
  const suggestions = await get(
    `/grades/suggestion?teamId=${teamId}&roundId=${roundId}&rubricId=${rubricId}`,
    adminToken,
  );
  console.log("Gemini AI Suggestions received:");
  suggestions.forEach((s) => {
    console.log(
      ` - Criterion Code: ${s.criterionCode} | Suggested: ${s.suggestedScore}/10 | Comment: ${s.comment}`,
    );
  });

  // 15. Submit Judge Grading Scores
  console.log("\n[Step 15] Submitting official Judge scores...");
  const submitGrades = await post(
    "/grades/submit",
    {
      teamId,
      roundId,
      rubricId,
      overallComment:
        "Dự án triển khai xuất sắc, code chuẩn chỉ và phân tách rõ ràng. Tần suất commit rất ấn tượng.",
      details: [
        {
          criterionId: crit1._id,
          scoreValue: 9.0,
          comment: "Cấu trúc thư mục chuẩn REST, sạch sẽ.",
        },
        {
          criterionId: crit2._id,
          scoreValue: 8.5,
          comment: "Đóng góp đồng đều giữa các thành viên, git log sạch.",
        },
      ],
    },
    adminToken,
  );
  console.log(
    `Official score submitted. Total weighted score: ${submitGrades.totalWeightedScore}/10`,
  );

  // 16. Lock the Round to compute rankings & standings
  console.log("\n[Step 16] Locking Round 1 and finalizing rankings...");
  const lockRound = await post(
    "/grades/lock-round",
    {
      eventId,
      roundId,
      trackId,
    },
    adminToken,
  );
  console.log(`Round Locked successfully. Message: ${lockRound.message}`);
  console.log(
    `Rankings table calculated: Rank #1 is Team ID: ${lockRound.rankings[0].teamId} with Score: ${lockRound.rankings[0].averageScore} (isAdvanced: ${lockRound.rankings[0].isAdvanced})`,
  );

  // 17. Retrieve Leaderboard and Verify
  console.log('\n[Step 17] Querying Leaderboard standings...');
  const leaderboardResult = await get(`/grades/leaderboard/${roundId}`, leaderToken);
  const standings = leaderboardResult.standings || [];
  console.log('Leaderboard Standings:');
  standings.forEach(row => {
    console.log(`Rank ${row.rank} | Team: "${row.teamId.name}" | Score: ${row.averageScore} | Advanced: ${row.isAdvanced}`);
  });

  if (standings.length > 0 && standings[0].teamId.name === 'Dev Rangers' && standings[0].rank === 1) {
    console.log('\n======================================================');
    console.log('✅ ALL INTEGRATION SCENARIO TESTS PASSED SUCCESSFULLY! ✅');
    console.log('======================================================');
  } else {
    throw new Error("Leaderboard mismatch: Rank 1 is not Dev Rangers.");
  }

  // Close Mongoose connection
  await mongoose.disconnect();
}

runTests().catch((err) => {
  console.error("\n❌ TEST SCENARIO FAILED:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
