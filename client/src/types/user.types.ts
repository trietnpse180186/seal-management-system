export interface User {
  _id: string;
  fullName: string;
  email: string;
  role?: string;
  isSystemAdmin?: boolean;
  isStudentAssistant?: boolean;
  university?: string;
  avatarUrl?: string;
}

export interface UserRole {
  role: 'admin' | 'judge' | 'mentor' | 'candidate' | 'student_assistant' | 'organizer';
  eventId?: string;
}
