/**
 * Application API Configuration & Endpoints Registry
 */

export const getApiBaseUrl = (): string => {
  let apiBase = import.meta.env.VITE_API_URL;
  if (!apiBase) {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        apiBase = window.location.origin;
      } else {
        apiBase = 'http://localhost:5000';
      }
    } else {
      apiBase = 'http://localhost:5000';
    }
  }
  return apiBase;
};

export const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    HEARTBEAT: '/api/auth/heartbeat',
    ME: '/api/auth/me',
    PROFILE: '/api/auth/profile',
    CAPTCHA: '/api/auth/captcha',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    USERS: '/api/auth/users',
    USER_BY_ID: (id: string) => `/api/auth/users/${id}`,
    TOGGLE_STUDENT_ASSISTANT: (id: string) => `/api/auth/users/${id}/toggle-student-assistant`,
  },
  EVENTS: {
    BASE: '/api/events',
    PUBLISHED: '/api/events/published',
    JUDGE_ACTIVE_CONTEST: '/api/events/judge/active-contest',
    ALL_LOGS: '/api/events/all/logs',
    BY_ID: (id: string) => `/api/events/${id}`,
    LOGS: (id: string) => `/api/events/${id}/logs`,
    ROLES: (id: string) => `/api/events/${id}/roles`,
    ROUNDS: (id: string) => `/api/events/${id}/rounds`,
    ROUND_BY_ID: (eventId: string, roundId: string) => `/api/events/${eventId}/rounds/${roundId}`,
    TRACKS: (id: string) => `/api/events/${id}/tracks`,
    TRACK_BY_ID: (eventId: string, trackId: string) => `/api/events/${eventId}/tracks/${trackId}`,
    DISTRIBUTE_TEAMS: (id: string) => `/api/events/${id}/distribute-teams`,
    EXPORT_TEAMS: (id: string) => `/api/events/${id}/export-teams`,
    UPLOAD_EXAM: (id: string) => `/api/events/${id}/upload-exam`,
    SEMINAR: (id: string) => `/api/events/${id}/seminar`,
    SEND_SEMINAR_EMAIL: (id: string) => `/api/events/${id}/seminar/send-email`,
  },
  TEAMS: {
    ALL_BY_EVENT: (eventId: string) => `/api/teams/all/${eventId}`,
    MY_TEAM: '/api/teams/my-team',
    HISTORY: '/api/teams/history',
    CHECK_NAME: '/api/teams/check-name',
    USER_LOOKUP: '/api/teams/user-lookup',
    CHECK_ELIGIBILITY: '/api/teams/check-eligibility',
    REGISTER: '/api/teams/register',
    IMPORT_TEMPLATE: '/api/teams/import-template',
    IMPORT: '/api/teams/import',
    VERIFY_PAST_PARTICIPATION: '/api/teams/verify-past-participation',
    JUDGE_SCENARIOS: '/api/teams/judge/scenarios',
    JUDGE_LIVE: '/api/teams/judge/live',
    BY_ID: (id: string) => `/api/teams/${id}`,
    BASIC_INFO: (id: string) => `/api/teams/${id}/basic-info`,
    ASSIGN_TRACK: (id: string) => `/api/teams/${id}/assign-track`,
    UPDATE_JUDGE: (id: string) => `/api/teams/${id}/judge`,
    UPDATE_JUDGE_SCENARIO: (id: string) => `/api/teams/${id}/judge-scenario`,
    SYNC_MQTT: (id: string) => `/api/teams/${id}/sync-mqtt`,
  },
  ROUNDS: {
    BY_EVENT: (eventId: string) => `/api/events/${eventId}/rounds`,
    BY_ID: (eventId: string, roundId: string) => `/api/events/${eventId}/rounds/${roundId}`,
  },
  GRADES: {
    TEAM_ROUND: (teamId: string, roundId: string) => `/api/grades/team/${teamId}/round/${roundId}`,
    JUDGE_RANKING: (roundId: string) => `/api/grades/judge-ranking/${roundId}`,
    LIVE_RANKING: (roundId: string) => `/api/grades/live-ranking/${roundId}`,
    LEADERBOARD: (roundId: string) => `/api/grades/leaderboard/${roundId}`,
    EXPORT_SHEET: (roundId: string) => `/api/grades/export-grading-sheet/${roundId}`,
    TEAM_ACHIEVEMENTS: (teamId: string) => `/api/grades/team/${teamId}/achievements`,
    SUGGESTION: '/api/grades/suggestion',
    SUBMIT: '/api/grades/submit',
  },
  RUBRICS: {
    BASE: '/api/rubrics',
    CLONE: '/api/rubrics/clone',
    BY_ROUND: (roundId: string) => `/api/rubrics/round/${roundId}`,
    IMPORT: '/api/rubrics/import',
    TEMPLATE_DOWNLOAD: '/api/rubrics/template/download',
    BY_ID: (id: string) => `/api/rubrics/${id}`,
    EXPORT: (id: string) => `/api/rubrics/${id}/export`,
    EXPORT_CRITERIA: (id: string) => `/api/rubrics/${id}/export-criteria`,
    IMPORT_CRITERIA: (id: string) => `/api/rubrics/${id}/import-criteria`,
    LOCK: (id: string) => `/api/rubrics/${id}/lock`,
    UNLOCK: (id: string) => `/api/rubrics/${id}/unlock`,
  },
  CRITERIA: {
    BY_ID: (id: string) => `/api/criteria/${id}`,
    BY_RUBRIC: (rubricId: string) => `/api/criteria/rubric/${rubricId}`,
  },
  TRACKS: {
    BY_EVENT: (eventId: string) => `/api/events/${eventId}/tracks`,
    BY_ID: (eventId: string, trackId: string) => `/api/events/${eventId}/tracks/${trackId}`,
  },
  USERS: {
    BASE: '/api/auth/users',
    BY_ID: (id: string) => `/api/auth/users/${id}`,
    TOGGLE_STUDENT_ASSISTANT: (id: string) => `/api/auth/users/${id}/toggle-student-assistant`,
  },
  GALLERY: {
    BASE: '/api/gallery',
    SYNC_PROGRESS: '/api/gallery/sync-progress',
  },
  NOTIFICATIONS: {
    BASE: '/api/notifications',
    MARK_READ: (id: string) => `/api/notifications/${id}/read`,
    MARK_ALL_READ: '/api/notifications/read-all',
  },
  GITHUB: {
    REPOSITORIES: '/api/github-repositories',
    SYNC_PROGRESS: '/api/github-repositories/sync-progress',
    SYNC_ALL: '/api/github-repositories/sync-all',
    SEARCH_USERS: '/api/github-repositories/search-users',
    REPO_SYNC: (repoId: string) => `/api/github-repositories/${repoId}/sync`,
    REPO_KICK_ALL: (repoId: string) => `/api/github-repositories/${repoId}/kick-all`,
  },
  ANALYTICS: {
    TEAM_COMMITS: (teamId: string) => `/api/analytics/team/${teamId}/commits`,
  },
  AI_ANALYSES: {
    STATS: '/api/ai-analyses/stats',
    TEAM: (teamId: string) => `/api/ai-analyses/team/${teamId}`,
  },
  CHAT: {
    ROOMS: '/api/chat/rooms',
    MENTOR_TEAMS: '/api/chat/mentor/teams',
    TEAM_ROOM: '/api/chat/rooms/team',
    ROOM_MESSAGES: (roomId: string) => `/api/chat/rooms/${roomId}/messages`,
  },
  MQTT: {
    SYNC_TEAM: (teamId: string) => `/api/teams/${teamId}/sync-mqtt`,
  },
  MENTOR: {
    TEAMS: '/api/chat/mentor/teams',
  },
  LEADERBOARD: {
    LIVE: (roundId: string) => `/api/grades/live-ranking/${roundId}`,
    FINAL: (roundId: string) => `/api/grades/leaderboard/${roundId}`,
  },
  SEMINARS: {
    BY_EVENT: (eventId: string) => `/api/events/${eventId}/seminar`,
    SEND_EMAIL: (eventId: string) => `/api/events/${eventId}/seminar/send-email`,
  },
};
