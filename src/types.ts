export type Platform = 'wpp' | 'insta' | 'msg';
export type Priority = 'high' | 'med' | 'low';

export type SubtaskStatus = 'todo' | 'doing' | 'done';

export interface Subtask {
  id: string;
  text: string;
  done: boolean;              // compat: espelha status === 'done'
  assignee?: string | null;   // responsável (displayName do membro)
  due?: string | null;        // data de vencimento YYYY-MM-DD
  note?: string;              // observação livre
  status?: SubtaskStatus;     // 'todo' | 'doing' | 'done'
}

export interface Attachment {
  id: string;
  title: string;
  url: string;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  ts: number;
}

export interface Column {
  id: string;
  name: string;
  color: string;
  boardId?: string;
  wipLimit?: number;  // soft cap on cards before column turns red
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type CustomFieldType = 'text' | 'number' | 'url' | 'currency' | 'date' | 'select';

export interface CustomField {
  id: string;
  boardId: string;
  name: string;
  type: CustomFieldType;
  options?: string[];     // only for 'select'
  showOnCard?: boolean;   // if true, render compact preview on the card itself
  position: number;
}

export type CustomValueMap = Record<string, string | number>;

export interface Board {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Card {
  id: string;
  cid: string;
  name: string;
  plat: Platform[];
  prio: Priority;
  color: string;
  note: string;
  desc: string;
  assignee: string | null;
  due: string | null;
  tagIds: string[];
  subtasks: Subtask[];
  attachments: Attachment[];
  comments: Comment[];
  ts: number;
  archived?: boolean;
  archivedAt?: number;
  pinned?: boolean;
  order?: number;  // manual order within column (lower = top)
  boardId?: string;
  customValues?: CustomValueMap;
  coverUrl?: string;
  snoozedUntil?: number;  // ms timestamp; card hidden from views until this date
  starred?: boolean;      // user favorited
  watchers?: string[];    // user IDs subscribed to updates
}

export interface DailyActivity {
  total: number;
  cardsCreated: number;
  cardsCompleted: number;
  cardsMoved: number;
  comments: number;
}

export interface Streak {
  current: number;
  longest: number;
  lastActivityDay: string | null;
  startedAt: string | null;
  lastWrapShownWeek: string | null;
}

export type ActivityMap = Record<string, DailyActivity>;

export type AchievementMap = Record<string, number>; // id -> unlockedAt (ms)

// ─── Clientes / CRM ──────────────────────────────────────────────
export interface ClientSocial {
  whatsapp?: string;
  instagram?: string;
  site?: string;
}

export interface ClientProfile {
  key: string;                   // normalized lowercase, used as dictionary key
  displayName: string;           // pretty version (matches card.name original case)
  phone?: string;
  email?: string;
  social?: ClientSocial;
  notes?: string;
  tags?: string[];               // legacy free-form tags — kept for migration compat
  tagIds?: string[];             // v4.20+: references to data.tags (shared with cards)
  color?: string;
  hourlyRate?: number;           // R$/h opcional
  totalBilled?: number;          // R$ total faturado (manual ou somado de cards)
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ClientProfileMap = Record<string, ClientProfile>;

// ─── Templates ──────────────────────────────────────────────────
export interface TemplateSubtask {
  text: string;
}

export interface CardTemplate {
  id: string;
  name: string;          // template display name (e.g. "Implementação WhatsApp Magazord")
  emoji?: string;        // optional visual marker
  description?: string;  // brief explanation
  defaults: {
    name?: string;       // default card name (can include {{cliente}} placeholder)
    cid?: string;        // default column
    prio?: Priority;
    plat?: Platform[];
    color?: string;
    note?: string;
    desc?: string;
    tagNames?: string[]; // tag names (resolves to existing or creates)
    subtasks?: TemplateSubtask[];
  };
  useCount?: number;     // how many cards used this template
  createdAt: number;
  updatedAt: number;
}

// ─── Integrações ─────────────────────────────────────────────────
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: Array<'card.created' | 'card.moved' | 'card.completed' | 'card.deleted'>;
  enabled: boolean;
  createdAt: number;
  lastTriggeredAt?: number;
  lastStatus?: 'ok' | 'error' | 'pending';
}

export interface IntegrationsConfig {
  webhooks?: WebhookConfig[];
  emailForwarding?: { enabled: boolean; alias?: string };
  googleCalendar?: { enabled: boolean; lastSyncAt?: number };
  slack?: { enabled: boolean; webhookUrl?: string };
  notion?: { enabled: boolean; databaseId?: string };
}

export type MutationKind = 'create' | 'complete' | 'move' | 'comment' | 'subtask' | 'attach' | 'other';

export interface AppData {
  version: number;
  cols: Column[];
  cards: Card[];
  members: string[];
  tags: Tag[];
  streak?: Streak;
  activity?: ActivityMap;
  achievements?: AchievementMap;
  clientProfiles?: ClientProfileMap;
  integrations?: IntegrationsConfig;
  templates?: CardTemplate[];
  boards?: Board[];
  customFields?: CustomField[];
  activeBoardId?: string;
  goals?: Goal[];
  sprints?: Sprint[];
  activeSprintId?: string;     // per-app active sprint reference (could be per-board)
}

export type ViewKey = 'kanban' | 'list' | 'dashboard' | 'inbox' | 'mytasks' | 'clients' | 'analytics' | 'integrations' | 'calendar' | 'emails' | 'archive' | 'templates' | 'snoozed' | 'starred' | 'goals' | 'sprints' | 'roadmap';

// ─── Planning: Goals + Sprints (v4.23) ──────────────────────────
export type GoalType = 'numeric' | 'milestone';
export type GoalStatus = 'active' | 'achieved' | 'failed' | 'archived';

export interface Goal {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
  type: GoalType;
  target?: number;            // for numeric type
  current?: number;           // current value (manual or computed)
  unit?: string;              // 'R$', 'cards', 'clientes', '%', etc
  period?: string;            // 'Q1 2026', 'Maio 2026', '2026'
  startDate?: string;         // YYYY-MM-DD
  endDate?: string;
  boardId?: string;
  linkedCardIds?: string[];   // cards that contribute to this goal
  status: GoalStatus;
  createdAt: number;
  updatedAt: number;
}

// ─── Public Portal (cliente acompanha sem login) ──────────────
export type PublicShareField = 'progress' | 'cards' | 'subtasks' | 'comments' | 'description' | 'meetings' | 'due' | 'plat';

export interface PublicShareBranding {
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;          // logo do consultor/marca (white-label)
  brandName?: string;        // nome da marca/negócio do consultor (white-label)
  showWalkersBrand?: boolean; // false = white-label puro
  welcomeMessage?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface PublicShareApproval {
  cardId: string;
  approvedAt: number;
  approvedBy?: string;       // name client typed
  note?: string;
}

export interface PublicShareComment {
  id: string;
  cardId?: string;           // null = comment geral, não vinculado a card
  text: string;
  author?: string;           // nome que cliente digitou
  ts: number;
}

// Snapshot denormalizado dos cards que o cliente vê (publicShares é público;
// os dados reais do kanban não são). Atualizado pelo app do dono.
export interface PublicShareCardSnap {
  id: string;
  name: string;
  status: string;            // nome da coluna
  done: boolean;             // está na última coluna
  prio?: Priority;
  due?: string | null;
  subDone: number;
  subTotal: number;
  subtasks?: { text: string; done: boolean }[];  // só se campo 'subtasks' ligado
  description?: string;                            // só se 'description'
  plat?: Platform[];                               // só se 'plat'
}

export interface PublicShareSnapshot {
  updatedAt: number;
  cards: PublicShareCardSnap[];
}

export interface PublicShare {
  slug: string;
  accessToken?: string;      // token na URL (?t=) — porta extra além do slug
  snapshot?: PublicShareSnapshot;
  workspaceId: string;
  clientKey: string;
  clientDisplayName: string;
  ownerUid: string;
  // Filtro: quais cards mostrar (vazio = todos do cliente)
  cardIdsFilter?: string[];
  // Quais campos exibir
  visibleFields: PublicShareField[];
  // Acesso
  passwordHash?: string;     // SHA256 do PIN
  expiresAt?: number;
  // Branding
  branding?: PublicShareBranding;
  // Stats
  createdAt: number;
  updatedAt: number;
  lastViewedAt?: number;
  views: number;
  // Interatividade
  allowComments: boolean;
  allowApprovals: boolean;
  approvals?: PublicShareApproval[];
  // Status
  revoked?: boolean;
}

export type SprintStatus = 'planning' | 'active' | 'completed';

export interface Sprint {
  id: string;
  name: string;
  emoji?: string;
  boardId: string;
  startDate: string;          // YYYY-MM-DD
  endDate: string;
  goal?: string;              // sprint objective text
  status: SprintStatus;
  cardIds: string[];          // cards inside this sprint
  velocityTarget?: number;    // target count of cards completed
  retrospective?: string;     // notes after completion
  createdAt: number;
  updatedAt: number;
}

// ─── Team / Workspace ──────────────────────────────────────────
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface WorkspaceMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: WorkspaceRole;
  joinedAt: number;
}

export interface WorkspaceInvite {
  code: string;       // shareable token
  email?: string;     // optional restriction
  role: WorkspaceRole;
  createdAt: number;
  expiresAt?: number;
  uses: number;
  maxUses?: number;
}

export interface Workspace {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  ownerUid: string;
  memberUids: string[];        // for Firestore query / rules
  members: WorkspaceMember[];   // denormalized for fast UI
  invites?: WorkspaceInvite[];
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  workspaceIds: string[];      // list of workspaces user is member of
  currentWorkspaceId: string;  // active one
  createdAt: number;
  updatedAt: number;
}

export interface Notification {
  id: string;
  type: string;
  icon: string;
  title: string;
  sub?: string;
  ts: number;
  cardId?: string;
  read: boolean;
}

export type FbStatus = 'idle' | 'syncing' | 'ok' | 'error';
