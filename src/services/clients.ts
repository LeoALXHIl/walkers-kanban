// Client extraction & aggregation.
//
// "Client" is derived from card.name (lowercased+trimmed as key). The optional
// `clientProfiles[key]` in AppData stores enrichment fields (phone, email, etc.)
// — but a client EXISTS as soon as ≥1 card references it.

import type { AppData, Card, ClientProfile } from '@/types';

export function clientKey(name: string): string {
  return (name || '').trim().toLowerCase();
}

export interface ClientSummary {
  key: string;
  displayName: string;
  profile?: ClientProfile;
  cards: Card[];
  totalCards: number;
  activeCards: number;        // not in last column
  doneCards: number;          // in last column
  overdueCards: number;
  lastActivity: number;       // ms timestamp of most-recent card.ts
  platforms: string[];        // union of plat across cards
  topPriority: 'high' | 'med' | 'low';
}

const PRIO_RANK = { high: 0, med: 1, low: 2 } as const;

export function aggregateClient(name: string, data: AppData): ClientSummary {
  const key = clientKey(name);
  const cards = data.cards.filter(c => clientKey(c.name) === key);
  const lastColId = data.cols.length ? data.cols[data.cols.length - 1].id : null;
  const todayMs = Date.now();
  const overdue = cards.filter(c => c.due && new Date(c.due + 'T00:00:00').getTime() < todayMs && c.cid !== lastColId);
  const done = lastColId ? cards.filter(c => c.cid === lastColId) : [];
  const active = cards.filter(c => c.cid !== lastColId);
  const lastActivity = cards.reduce((m, c) => Math.max(m, c.ts || 0), 0);
  const platSet = new Set<string>();
  cards.forEach(c => (c.plat || []).forEach(p => platSet.add(p)));
  // Top priority = highest priority across active cards
  let topPriority: 'high' | 'med' | 'low' = 'low';
  for (const c of active) {
    if (PRIO_RANK[c.prio] < PRIO_RANK[topPriority]) topPriority = c.prio;
  }
  return {
    key,
    displayName: data.clientProfiles?.[key]?.displayName || cards[0]?.name || name,
    profile: data.clientProfiles?.[key],
    cards,
    totalCards: cards.length,
    activeCards: active.length,
    doneCards: done.length,
    overdueCards: overdue.length,
    lastActivity,
    platforms: Array.from(platSet),
    topPriority
  };
}

export function allClients(data: AppData): ClientSummary[] {
  const keys = new Set<string>();
  data.cards.forEach(c => keys.add(clientKey(c.name)));
  // also include profiles that don't have a card yet (manually added)
  if (data.clientProfiles) Object.keys(data.clientProfiles).forEach(k => keys.add(k));
  return Array.from(keys)
    .filter(k => k.length > 0)
    .map(k => {
      const sample = data.cards.find(c => clientKey(c.name) === k);
      return aggregateClient(sample?.name || data.clientProfiles?.[k]?.displayName || k, data);
    });
}

// Richer 360° stats — extends the basic ClientSummary with financial + lifecycle data.
export interface ClientStats360 {
  totalBilled: number;          // R$ acumulado
  avgTicket: number;            // R$ médio por card concluído
  hourlyRate: number;           // R$/h cadastrado
  estimatedRevenue: number;     // doneCards × avgTicket (if avgTicket > 0) OR doneCards × 1h × hourlyRate
  daysAsClient: number;         // dias desde o primeiro card OU desde profile.createdAt
  firstCardAt: number | null;   // ms timestamp
  lastCardAt: number | null;
  completionRate: number;       // doneCards / totalCards
  avgCompletionDays: number;    // média de dias entre criação e conclusão (cards na última coluna)
  cardsThisMonth: number;       // criados nos últimos 30 dias
  cardsLastMonth: number;       // criados 30-60 dias atrás
  monthlyGrowth: number;        // ((thisMonth - lastMonth) / lastMonth) * 100
}

export function computeClient360(summary: ClientSummary, data: AppData): ClientStats360 {
  const totalBilled = summary.profile?.totalBilled || 0;
  const hourlyRate = summary.profile?.hourlyRate || 0;
  const avgTicket = summary.doneCards > 0 ? totalBilled / summary.doneCards : 0;
  const estimatedRevenue = avgTicket > 0
    ? summary.doneCards * avgTicket
    : (hourlyRate > 0 ? summary.doneCards * hourlyRate : 0);

  const firstCard = summary.cards.length
    ? Math.min(...summary.cards.map(c => c.ts || Date.now()))
    : null;
  const lastCard = summary.cards.length
    ? Math.max(...summary.cards.map(c => c.ts || 0))
    : null;
  const startTs = summary.profile?.createdAt || firstCard;
  const daysAsClient = startTs ? Math.floor((Date.now() - startTs) / 86400000) : 0;

  const completionRate = summary.totalCards > 0
    ? Math.round((summary.doneCards / summary.totalCards) * 100)
    : 0;

  // Average completion days: for cards in last column, time between creation and last update
  const lastColId = data.cols.length ? data.cols[data.cols.length - 1].id : null;
  let completionDaysSum = 0; let completionDaysN = 0;
  if (lastColId) {
    summary.cards.filter(c => c.cid === lastColId).forEach(c => {
      // We don't have a "completedAt" field, so we use the latest comment ts or card ts
      const latest = (c.comments || []).reduce((m, cm) => Math.max(m, cm.ts), c.ts || 0);
      if (c.ts && latest) {
        const days = Math.max(1, Math.round((latest - c.ts) / 86400000));
        completionDaysSum += days; completionDaysN++;
      }
    });
  }
  const avgCompletionDays = completionDaysN > 0 ? Math.round(completionDaysSum / completionDaysN) : 0;

  const now = Date.now();
  const day30 = now - 30 * 86400000;
  const day60 = now - 60 * 86400000;
  const cardsThisMonth = summary.cards.filter(c => (c.ts || 0) >= day30).length;
  const cardsLastMonth = summary.cards.filter(c => (c.ts || 0) >= day60 && (c.ts || 0) < day30).length;
  const monthlyGrowth = cardsLastMonth > 0
    ? Math.round(((cardsThisMonth - cardsLastMonth) / cardsLastMonth) * 100)
    : (cardsThisMonth > 0 ? 100 : 0);

  return {
    totalBilled,
    avgTicket,
    hourlyRate,
    estimatedRevenue,
    daysAsClient,
    firstCardAt: firstCard,
    lastCardAt: lastCard,
    completionRate,
    avgCompletionDays,
    cardsThisMonth,
    cardsLastMonth,
    monthlyGrowth
  };
}

export function ensureProfile(data: AppData, displayName: string): ClientProfile {
  if (!data.clientProfiles) data.clientProfiles = {};
  const key = clientKey(displayName);
  if (!data.clientProfiles[key]) {
    data.clientProfiles[key] = {
      key,
      displayName: displayName.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  return data.clientProfiles[key];
}
