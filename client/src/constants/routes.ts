export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  REGISTER_TEAM: '/register-team',
  TEAM_AREA: '/team-area',
  MY_ACHIEVEMENTS: '/my-achievements',

  // Admin
  ADMIN: {
    ROOT: '/admin',
    EVENTS: '/admin/events',
    LIVE: '/admin/live',
    USERS: '/admin/users',
    GRADES: '/admin/grades',
  },

  // Judge
  JUDGE: {
    ROOT: '/judge',
    DASHBOARD: '/judge/dashboard',
    PROJECTS: '/judge/projects',
    SCORING: '/judge/scoring',
    LEADERBOARD: '/judge/leaderboard',
  },

  // Mentor
  MENTOR: {
    ROOT: '/mentor',
    DASHBOARD: '/mentor/dashboard',
    CHAT: '/mentor/chat',
  },

  LEADERBOARD: '/leaderboard',
  GALLERY: '/gallery',
  GUEST_PORTAL: '/guest-portal',
} as const;
