// Tipos do portal (subconjunto do app Walkers Kanban).
export type Priority = 'high' | 'med' | 'low';
export type Platform = 'wpp' | 'insta' | 'msg';
export type PublicShareField = 'progress' | 'cards' | 'subtasks' | 'comments' | 'description' | 'meetings' | 'due' | 'plat';

export interface PublicShareBranding {
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  showWalkersBrand?: boolean;
  welcomeMessage?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface PublicShareApproval {
  cardId: string;
  approvedAt: number;
  approvedBy?: string;
  note?: string;
}

export interface PublicShareComment {
  id: string;
  cardId?: string;
  text: string;
  author?: string;
  ts: number;
}

export interface PublicShareCardSnap {
  id: string;
  name: string;
  status: string;
  done: boolean;
  prio?: Priority;
  due?: string | null;
  subDone: number;
  subTotal: number;
  subtasks?: { text: string; done: boolean }[];
  description?: string;
  plat?: Platform[];
}

export interface PublicShareSnapshot {
  updatedAt: number;
  cards: PublicShareCardSnap[];
}

export interface PublicShare {
  slug: string;
  accessToken?: string;
  snapshot?: PublicShareSnapshot;
  clientDisplayName: string;
  visibleFields: PublicShareField[];
  passwordHash?: string;
  expiresAt?: number;
  branding?: PublicShareBranding;
  views: number;
  lastViewedAt?: number;
  allowComments: boolean;
  allowApprovals: boolean;
  approvals?: PublicShareApproval[];
  revoked?: boolean;
}
