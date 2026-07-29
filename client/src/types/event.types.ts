export interface Event {
  _id: string;
  name: string;
  description?: string;
  status: 'draft' | 'registration' | 'prepare' | 'ongoing' | 'completed';
  regOpenAt?: string;
  regCloseAt?: string;
  contestStartAt?: string;
  contestEndAt?: string;
}

export interface Round {
  _id: string;
  eventId: string;
  name: string;
  order: number;
  status: 'pending' | 'active' | 'completed';
  startTime?: string;
  endTime?: string;
  isExamManualOpen?: boolean;
}

export interface Track {
  _id: string;
  eventId: string;
  name: string;
  maxTeams?: number;
}

export interface Team {
  _id: string;
  name: string;
  eventId: string;
  trackId?: string;
  status: string;
  members: any[];
}
