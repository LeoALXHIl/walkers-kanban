// Walkers Kanban — notificação de atribuição por email (Cloud Function v2)
//
// Dispara quando o documento de dados de um workspace muda
// (workspaces/{wsId}/kanban/main, que guarda TODO o AppData).
// Compara o estado "antes" x "depois", acha cards/subtarefas cujo
// responsável MUDOU, descobre o email do membro e envia um aviso.
//
// Envio via Gmail SMTP usando uma "Senha de app" (App Password).
// Credenciais ficam em secrets do Firebase (EMAIL_USER / EMAIL_PASS).

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

const EMAIL_USER = defineSecret('EMAIL_USER'); // ex: voce@gmail.com
const EMAIL_PASS = defineSecret('EMAIL_PASS'); // App Password de 16 dígitos
const POWERBI_KEY = defineSecret('POWERBI_KEY'); // chave secreta pro endpoint do Power BI

function norm(s) {
  return (s || '').toString().trim().toLowerCase();
}

// Coleta atribuições NOVAS (responsável que mudou) entre dois estados de cards.
function collectNewAssignments(beforeCards, afterCards) {
  const beforeById = new Map((beforeCards || []).map((c) => [c.id, c]));
  const out = [];

  for (const card of afterCards || []) {
    const prev = beforeById.get(card.id);

    // Card-level
    const prevAssignee = prev ? prev.assignee : null;
    if (card.assignee && norm(card.assignee) !== norm(prevAssignee)) {
      out.push({ kind: 'card', assignee: card.assignee, cardName: card.name || 'Card' });
    }

    // Subtarefas
    const prevSubs = new Map(((prev && prev.subtasks) || []).map((s) => [s.id, s]));
    for (const sub of card.subtasks || []) {
      const ps = prevSubs.get(sub.id);
      const prevSubAssignee = ps ? ps.assignee : null;
      if (sub.assignee && norm(sub.assignee) !== norm(prevSubAssignee)) {
        out.push({
          kind: 'subtask',
          assignee: sub.assignee,
          cardName: card.name || 'Card',
          subText: sub.text || 'Subtarefa',
          due: sub.due || null
        });
      }
    }
  }
  return out;
}

function emailHtml({ wsName, intro, cardName, subText, due }) {
  const dueLine = due
    ? `<p style="margin:0 0 6px;color:#b45309;font-size:13px;">📅 Vencimento: <strong>${due}</strong></p>`
    : '';
  const subLine = subText
    ? `<p style="margin:0 0 6px;color:#374151;font-size:14px;">✓ Subtarefa: <strong>${subText}</strong></p>`
    : '';
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#7c5cfc,#ec4899);padding:20px 24px;border-radius:14px 14px 0 0;">
      <div style="color:#fff;font-size:18px;font-weight:700;">📌 Nova tarefa pra você</div>
      <div style="color:rgba(255,255,255,.85);font-size:12px;margin-top:2px;">${wsName}</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:22px 24px;">
      <p style="margin:0 0 12px;color:#111827;font-size:15px;">${intro}</p>
      <p style="margin:0 0 6px;color:#374151;font-size:14px;">🗂️ Card: <strong>${cardName}</strong></p>
      ${subLine}
      ${dueLine}
      <p style="margin:18px 0 0;color:#6b7280;font-size:12px;">Abra o Walkers Kanban pra ver os detalhes.</p>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:14px;">
      Você recebeu este email porque foi atribuído a uma tarefa no Walkers Kanban.
    </p>
  </div>`;
}

exports.notifyAssignment = onDocumentUpdated(
  {
    document: 'workspaces/{wsId}/kanban/main',
    secrets: [EMAIL_USER, EMAIL_PASS]
  },
  async (event) => {
    const wsId = event.params.wsId;
    const before = event.data.before.exists ? event.data.before.data() : {};
    const after = event.data.after.exists ? event.data.after.data() : {};

    const assignments = collectNewAssignments(before.cards, after.cards);
    if (assignments.length === 0) return;

    // Carrega membros do workspace pra resolver email pelo displayName.
    const wsSnap = await admin.firestore().doc(`workspaces/${wsId}`).get();
    const ws = wsSnap.exists ? wsSnap.data() : null;
    const members = (ws && ws.members) || [];
    const wsName = (ws && ws.name) || 'Walkers Kanban';

    const resolveEmail = (assignee) => {
      const n = norm(assignee);
      const m = members.find((mb) => norm(mb.displayName) === n || norm(mb.email) === n);
      if (m && m.email) return m.email;
      // fallback: se o próprio assignee já é um email
      return assignee && assignee.includes('@') ? assignee.trim() : null;
    };

    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: EMAIL_USER.value(), pass: EMAIL_PASS.value() }
    });
    const from = `Walkers Kanban <${EMAIL_USER.value()}>`;

    // Evita mandar 2 emails iguais pro mesmo destino no mesmo lote.
    const sentKeys = new Set();

    await Promise.all(
      assignments.map(async (a) => {
        const to = resolveEmail(a.assignee);
        if (!to) {
          logger.warn(`Sem email pra responsável "${a.assignee}" (ws ${wsId})`);
          return;
        }
        const key = `${to}|${a.kind}|${a.cardName}|${a.subText || ''}`;
        if (sentKeys.has(key)) return;
        sentKeys.add(key);

        const subject =
          a.kind === 'subtask'
            ? `📌 Nova subtarefa: ${a.subText}`
            : `📌 Novo card atribuído: ${a.cardName}`;
        const intro =
          a.kind === 'subtask'
            ? `Você foi atribuído a uma subtarefa no card <strong>"${a.cardName}"</strong>.`
            : `Você foi atribuído ao card <strong>"${a.cardName}"</strong>.`;

        try {
          await transport.sendMail({
            from,
            to,
            subject,
            html: emailHtml({ wsName, intro, cardName: a.cardName, subText: a.subText, due: a.due })
          });
          logger.info(`Email de atribuição enviado pra ${to} (${a.kind})`);
        } catch (err) {
          logger.error(`Falha ao enviar email pra ${to}:`, err);
        }
      })
    );
  }
);

// ════════════════════════════════════════════════════════════════
// Endpoint HTTP pro Power BI — devolve os dados ACHATADOS em JSON.
// Power BI: Obter Dados → Web → cole a URL com ?key=...&ws=...&table=cards
// Protegido por chave (secret POWERBI_KEY).
// ════════════════════════════════════════════════════════════════

function isoDate(ms) { return ms ? new Date(ms).toISOString() : null; }
function ageDays(ms) { return ms ? Math.floor((Date.now() - ms) / 86400000) : null; }
function subDone(s) { return (s.status === 'done' || s.done) ? 1 : 0; }

// 1 linha por card
function flattenCards(data) {
  const cols = new Map((data.cols || []).map((c) => [c.id, c]));
  const boards = new Map((data.boards || []).map((b) => [b.id, b]));
  const tags = new Map((data.tags || []).map((t) => [t.id, t.name]));
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  return (data.cards || []).map((c) => {
    const subs = c.subtasks || [];
    const done = subs.reduce((n, s) => n + subDone(s), 0);
    const dueMs = c.due ? new Date(c.due + 'T00:00:00').getTime() : null;
    return {
      id: c.id,
      cliente: c.name || '',
      status: (cols.get(c.cid) || {}).name || '',
      board: (boards.get(c.boardId) || {}).name || '',
      prioridade: c.prio || '',
      responsavel: c.assignee || '',
      vencimento: c.due || null,
      criado_em: isoDate(c.ts),
      idade_dias: ageDays(c.ts),
      atrasado: dueMs != null && dueMs < t0.getTime() ? 1 : 0,
      arquivado: c.archived ? 1 : 0,
      favorito: c.starred ? 1 : 0,
      subtarefas_total: subs.length,
      subtarefas_concluidas: done,
      subtarefas_abertas: subs.length - done,
      comentarios: (c.comments || []).length,
      anexos: (c.attachments || []).length,
      tags: (c.tagIds || []).map((id) => tags.get(id)).filter(Boolean).join(', '),
      plataformas: (c.plat || []).join(', ')
    };
  });
}

// 1 linha por subtarefa
function flattenSubtasks(data) {
  const cols = new Map((data.cols || []).map((c) => [c.id, c]));
  const out = [];
  for (const c of data.cards || []) {
    for (const s of c.subtasks || []) {
      out.push({
        card_id: c.id,
        cliente: c.name || '',
        status_card: (cols.get(c.cid) || {}).name || '',
        subtarefa: s.text || '',
        responsavel: s.assignee || '',
        status: s.status || (s.done ? 'done' : 'todo'),
        vencimento: s.due || null,
        concluida: subDone(s)
      });
    }
  }
  return out;
}

// 1 linha por cliente
function flattenClients(data) {
  const profiles = data.clientProfiles || {};
  const byClient = {};
  for (const c of data.cards || []) {
    const key = (c.name || '').trim().toLowerCase();
    if (!key) continue;
    if (!byClient[key]) byClient[key] = { total: 0, abertos: 0 };
    byClient[key].total++;
    if (!c.archived) byClient[key].abertos++;
  }
  return Object.values(profiles).map((p) => ({
    cliente: p.displayName || p.key,
    telefone: p.phone || '',
    email: p.email || '',
    valor_hora: p.hourlyRate != null ? p.hourlyRate : null,
    total_faturado: p.totalBilled != null ? p.totalBilled : null,
    arquivado: p.archived ? 1 : 0,
    cards_total: (byClient[p.key] || {}).total || 0,
    cards_abertos: (byClient[p.key] || {}).abertos || 0
  }));
}

exports.powerbi = onRequest({ secrets: [POWERBI_KEY], cors: true }, async (req, res) => {
  try {
    const key = req.query.key || req.get('x-api-key');
    if (!key || key !== POWERBI_KEY.value()) {
      res.status(401).json({ error: 'Chave inválida ou ausente. Use ?key=SUA_CHAVE' });
      return;
    }

    const db = admin.firestore();
    const table = (req.query.table || 'cards').toString().toLowerCase();

    // Lista os workspaces (pra você descobrir o ID)
    if (table === 'workspaces') {
      const snap = await db.collection('workspaces').get();
      res.set('Cache-Control', 'no-store');
      res.json(snap.docs.map((d) => ({ id: d.id, nome: d.data().name || '' })));
      return;
    }

    // Resolve o workspace: usa ?ws= ou pega o mais recente se houver só um/vários
    let ws = (req.query.ws || '').toString();
    if (!ws) {
      const snap = await db.collection('workspaces').get();
      if (snap.empty) { res.json([]); return; }
      const sorted = snap.docs.sort((a, b) => (b.data().updatedAt || 0) - (a.data().updatedAt || 0));
      ws = sorted[0].id;
    }

    const dataSnap = await db.doc(`workspaces/${ws}/kanban/main`).get();
    const data = dataSnap.exists ? dataSnap.data() : {};

    let rows;
    if (table === 'subtasks' || table === 'subtarefas') rows = flattenSubtasks(data);
    else if (table === 'clients' || table === 'clientes') rows = flattenClients(data);
    else rows = flattenCards(data);

    res.set('Cache-Control', 'no-store');
    res.json(rows);
  } catch (e) {
    logger.error('powerbi endpoint error', e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});
