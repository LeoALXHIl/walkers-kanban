import { create } from 'zustand';
import type { ViewKey, FbStatus, Platform, Priority } from '@/types';
import { pushRecentCard } from '@/services/recent';

export interface NewCardSeed {
  name?: string;
  note?: string;
  plat?: Platform[];
  prio?: Priority;
  due?: string;
}

export interface MeetingSeed {
  title?: string;
  description?: string;
  date?: string;          // YYYY-MM-DD
  startTime?: string;     // HH:MM
  durationMin?: number;
  attendees?: string[];   // emails
  cardId?: string;        // if scheduled from a card, link back
}

const FILTERS_KEY = 'walkers.filters.v1';
const BOARD_VIEWS_KEY = 'walkers.boardViews.v1';

// UX-11: per-board last view memory
function loadBoardViews(): Record<string, ViewKey> {
  try { return JSON.parse(localStorage.getItem(BOARD_VIEWS_KEY) || '{}'); } catch { return {}; }
}
function saveBoardView(boardId: string, view: ViewKey): void {
  try {
    const all = loadBoardViews();
    all[boardId] = view;
    localStorage.setItem(BOARD_VIEWS_KEY, JSON.stringify(all));
  } catch {}
}
export function getViewForBoard(boardId: string | undefined): ViewKey | null {
  if (!boardId) return null;
  return loadBoardViews()[boardId] || null;
}
export function rememberViewForBoard(boardId: string | undefined, view: ViewKey): void {
  if (!boardId) return;
  saveBoardView(boardId, view);
}

interface PersistedFilters {
  q: string;
  plat: Platform | '';
  prio: Priority | '';
  view: ViewKey;
}

function loadPersisted(): PersistedFilters {
  try {
    const s = JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}');
    return {
      q: s.q || '',
      plat: (s.plat as Platform) || '',
      prio: (s.prio as Priority) || '',
      view: (s.view as ViewKey) || 'kanban'
    };
  } catch { return { q: '', plat: '', prio: '', view: 'kanban' }; }
}

let saveT: ReturnType<typeof setTimeout> | null = null;
function persist(state: PersistedFilters): void {
  if (saveT) clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(FILTERS_KEY, JSON.stringify(state)); } catch {}
  }, 200);
}

interface UIState {
  view: ViewKey;
  q: string;
  plat: Platform | '';
  prio: Priority | '';
  fbStatus: FbStatus;
  fbStatusMsg: string;
  detailCardId: string | null;
  newCardOpen: boolean;
  newCardCol: string | null;
  colEditId: string | null;
  colNew: boolean;
  delCardId: string | null;
  delColId: string | null;
  mcpInfoOpen: boolean;
  paletteOpen: boolean;
  streakModalOpen: boolean;
  wrapModalOpen: boolean;
  settingsOpen: boolean;
  voiceOpen: boolean;
  ocrOpen: boolean;
  pendingOcrBlob: Blob | null;
  snapshot: { kind: 'streak' | 'weekly' | 'achievement'; achievementId?: string } | null;
  clientDetailKey: string | null;
  eventDetail: any | null;  // Google Calendar event being shown in detail modal
  cheatsheetOpen: boolean;
  boardModalOpen: boolean;
  boardModalEditId: string | null;
  customFieldsModalOpen: boolean;
  meetingModalOpen: boolean;
  meetingSeed: MeetingSeed | null;
  newClientModalOpen: boolean;
  newCardSeed: NewCardSeed | null;
  selectedCardIds: string[];
  setView: (v: ViewKey) => void;
  setQ: (q: string) => void;
  setPlat: (p: Platform | '') => void;
  setPrio: (p: Priority | '') => void;
  setFbStatus: (s: FbStatus, msg: string) => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  openNewCard: (cid?: string, seed?: NewCardSeed) => void;
  closeNewCard: () => void;
  openVoice: () => void;
  closeVoice: () => void;
  openOcr: (blob?: Blob) => void;
  closeOcr: () => void;
  consumePendingOcrBlob: () => Blob | null;
  openSnapshot: (kind: 'streak' | 'weekly' | 'achievement', achievementId?: string) => void;
  closeSnapshot: () => void;
  openClientDetail: (key: string) => void;
  closeClientDetail: () => void;
  openEventDetail: (event: any) => void;
  closeEventDetail: () => void;
  openCheatsheet: () => void;
  closeCheatsheet: () => void;
  openBoardModal: (editId?: string | null) => void;
  closeBoardModal: () => void;
  openCustomFieldsModal: () => void;
  closeCustomFieldsModal: () => void;
  openMeetingModal: (seed?: MeetingSeed | null) => void;
  closeMeetingModal: () => void;
  openNewClientModal: () => void;
  closeNewClientModal: () => void;
  toggleCardSelection: (id: string) => void;
  clearCardSelection: () => void;
  selectCardsInRange: (ids: string[]) => void;
  openCol: (id?: string) => void;
  closeCol: () => void;
  askDelCard: (id: string) => void;
  cancelDelCard: () => void;
  askDelCol: (id: string) => void;
  cancelDelCol: () => void;
  openMcpInfo: () => void;
  closeMcpInfo: () => void;
  togglePalette: () => void;
  openPalette: () => void;
  closePalette: () => void;
  openStreakModal: () => void;
  closeStreakModal: () => void;
  openWrapModal: () => void;
  closeWrapModal: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  closeAllModals: () => void;
}

const initial = loadPersisted();

export const useUI = create<UIState>((set, get) => ({
  view: initial.view,
  q: initial.q,
  plat: initial.plat,
  prio: initial.prio,
  fbStatus: 'idle',
  fbStatusMsg: 'Conectando Firebase…',
  detailCardId: null,
  newCardOpen: false,
  newCardCol: null,
  colEditId: null,
  colNew: false,
  delCardId: null,
  delColId: null,
  mcpInfoOpen: false,
  paletteOpen: false,
  streakModalOpen: false,
  wrapModalOpen: false,
  settingsOpen: false,
  voiceOpen: false,
  ocrOpen: false,
  pendingOcrBlob: null,
  snapshot: null,
  clientDetailKey: null,
  eventDetail: null,
  cheatsheetOpen: false,
  boardModalOpen: false,
  boardModalEditId: null,
  customFieldsModalOpen: false,
  meetingModalOpen: false,
  meetingSeed: null,
  newClientModalOpen: false,
  newCardSeed: null,
  selectedCardIds: [],
  setView: (v) => { set({ view: v }); persist({ ...get(), view: v } as any); },
  setQ: (q) => { set({ q }); persist({ ...get(), q } as any); },
  setPlat: (plat) => { set({ plat }); persist({ ...get(), plat } as any); },
  setPrio: (prio) => { set({ prio }); persist({ ...get(), prio } as any); },
  setFbStatus: (s, msg) => set({ fbStatus: s, fbStatusMsg: msg }),
  openDetail: (id) => { pushRecentCard(id); set({ detailCardId: id }); },
  closeDetail: () => set({ detailCardId: null }),
  openNewCard: (cid, seed) => set({ newCardOpen: true, newCardCol: cid || null, newCardSeed: seed || null }),
  closeNewCard: () => set({ newCardOpen: false, newCardCol: null, newCardSeed: null }),
  openVoice: () => set({ voiceOpen: true }),
  closeVoice: () => set({ voiceOpen: false }),
  openOcr: (blob) => set({ ocrOpen: true, pendingOcrBlob: blob || null }),
  closeOcr: () => set({ ocrOpen: false, pendingOcrBlob: null }),
  consumePendingOcrBlob: () => {
    const b = get().pendingOcrBlob;
    if (b) set({ pendingOcrBlob: null });
    return b;
  },
  openSnapshot: (kind, achievementId) => set({ snapshot: { kind, achievementId } }),
  closeSnapshot: () => set({ snapshot: null }),
  openClientDetail: (key) => set({ clientDetailKey: key }),
  closeClientDetail: () => set({ clientDetailKey: null }),
  openEventDetail: (event) => set({ eventDetail: event }),
  closeEventDetail: () => set({ eventDetail: null }),
  openCheatsheet: () => set({ cheatsheetOpen: true }),
  closeCheatsheet: () => set({ cheatsheetOpen: false }),
  openBoardModal: (editId) => set({ boardModalOpen: true, boardModalEditId: editId || null }),
  closeBoardModal: () => set({ boardModalOpen: false, boardModalEditId: null }),
  openCustomFieldsModal: () => set({ customFieldsModalOpen: true }),
  closeCustomFieldsModal: () => set({ customFieldsModalOpen: false }),
  openMeetingModal: (seed) => set({ meetingModalOpen: true, meetingSeed: seed || null }),
  closeMeetingModal: () => set({ meetingModalOpen: false, meetingSeed: null }),
  openNewClientModal: () => set({ newClientModalOpen: true }),
  closeNewClientModal: () => set({ newClientModalOpen: false }),
  toggleCardSelection: (id) => set((s) => {
    const has = s.selectedCardIds.includes(id);
    return { selectedCardIds: has ? s.selectedCardIds.filter(x => x !== id) : [...s.selectedCardIds, id] };
  }),
  clearCardSelection: () => set({ selectedCardIds: [] }),
  selectCardsInRange: (ids) => set({ selectedCardIds: ids }),
  openCol: (id) => set({ colNew: !id, colEditId: id || null }),
  closeCol: () => set({ colNew: false, colEditId: null }),
  askDelCard: (id) => set({ delCardId: id }),
  cancelDelCard: () => set({ delCardId: null }),
  askDelCol: (id) => set({ delColId: id }),
  cancelDelCol: () => set({ delColId: null }),
  openMcpInfo: () => set({ mcpInfoOpen: true }),
  closeMcpInfo: () => set({ mcpInfoOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  openStreakModal: () => set({ streakModalOpen: true }),
  closeStreakModal: () => set({ streakModalOpen: false }),
  openWrapModal: () => set({ wrapModalOpen: true }),
  closeWrapModal: () => set({ wrapModalOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  closeAllModals: () => set({
    detailCardId: null,
    newCardOpen: false,
    newCardCol: null,
    newCardSeed: null,
    colNew: false,
    colEditId: null,
    delCardId: null,
    delColId: null,
    mcpInfoOpen: false,
    paletteOpen: false,
    streakModalOpen: false,
    wrapModalOpen: false,
    settingsOpen: false,
    voiceOpen: false,
    ocrOpen: false,
    snapshot: null,
    clientDetailKey: null,
    eventDetail: null,
    cheatsheetOpen: false,
    boardModalOpen: false,
    boardModalEditId: null,
    customFieldsModalOpen: false,
    meetingModalOpen: false,
    meetingSeed: null,
    newClientModalOpen: false
  })
}));

export function anyModalOpen(): boolean {
  const s = useUI.getState();
  return !!(s.detailCardId || s.newCardOpen || s.colNew || s.colEditId || s.delCardId || s.delColId || s.mcpInfoOpen || s.paletteOpen || s.streakModalOpen || s.wrapModalOpen || s.settingsOpen || s.voiceOpen || s.ocrOpen || s.snapshot || s.clientDetailKey || s.eventDetail || s.cheatsheetOpen || s.boardModalOpen || s.customFieldsModalOpen || s.meetingModalOpen || s.newClientModalOpen);
}
