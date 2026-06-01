import { useEffect, useRef, useState } from 'react';
import { useAIAssistant } from '@/store/aiAssistant';
import { mdToHtml } from '@/services/markdown';

const TOOL_LABELS: Record<string, { icon: string; label: string }> = {
  list_cards:    { icon: '📋', label: 'Listou cards' },
  create_card:   { icon: '✨', label: 'Criou card' },
  update_card:   { icon: '✏️', label: 'Atualizou card' },
  move_card:     { icon: '🔀', label: 'Moveu card' },
  archive_card:  { icon: '📦', label: 'Arquivou card' },
  snooze_card:   { icon: '😴', label: 'Adormeceu card' },
  star_card:     { icon: '⭐', label: 'Favoritou' },
  add_subtask:   { icon: '☑️', label: 'Adicionou subtarefa' },
  add_comment:   { icon: '💬', label: 'Comentou' },
  list_columns:  { icon: '🗂️', label: 'Listou colunas' },
  list_clients:  { icon: '👥', label: 'Listou clientes' },
  list_boards:   { icon: '🏢', label: 'Listou boards' },
  switch_board:  { icon: '🔄', label: 'Mudou de board' },
  get_stats:     { icon: '📊', label: 'Consultou estatísticas' },
  open_card:     { icon: '👁', label: 'Abriu card' },
  switch_view:   { icon: '➡️', label: 'Trocou de view' }
};

export function AIAssistantPanel() {
  const open = useAIAssistant(s => s.panelOpen);
  const close = useAIAssistant(s => s.closePanel);
  const messages = useAIAssistant(s => s.messages);
  const isLoading = useAIAssistant(s => s.isLoading);
  const error = useAIAssistant(s => s.error);
  const sendMessage = useAIAssistant(s => s.sendMessage);
  const clearChat = useAIAssistant(s => s.clearChat);
  const apiKeyConfigured = useAIAssistant(s => s.apiKeyConfigured);
  const refreshKeyState = useAIAssistant(s => s.refreshKeyState);

  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      refreshKeyState();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, refreshKeyState]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  if (!open) return null;

  const submit = () => {
    if (isLoading) return;
    const t = input.trim();
    if (!t) return;
    sendMessage(t);
    setInput('');
  };

  const suggestions = [
    'Resume meu dia',
    'O que tá atrasado?',
    'Quais cards estão parados há mais tempo?',
    'Lista meus clientes ativos'
  ];

  return (
    <div className="ai-panel">
      <div className="ai-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="ai-avatar">🤖</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Claude</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>AI Assistant do Walkers</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="ai-head-btn" onClick={clearChat} title="Limpar conversa">🧹</button>
          <button className="ai-head-btn" onClick={close} title="Fechar (Esc)">✕</button>
        </div>
      </div>

      <div className="ai-body" ref={scrollRef}>
        {!apiKeyConfigured && (
          <div className="ai-empty">
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Configure sua API key</div>
            <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, maxWidth: 280 }}>
              Vai em <strong>⚙️ Configurações → 🤖 AI Assistant</strong>, cola sua <em>Anthropic API key</em> (começa com sk-ant-), e bora conversar.
            </p>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10 }}>
              Pega sua key em <a data-extlink="https://console.anthropic.com/" style={{ color: 'var(--accent)', cursor: 'pointer' }}>console.anthropic.com</a>
            </p>
          </div>
        )}

        {apiKeyConfigured && messages.length === 0 && (
          <div className="ai-empty">
            <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Oi! Como posso ajudar?</div>
            <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, maxWidth: 280, marginBottom: 14 }}>
              Eu tenho acesso aos seus boards, cards, clientes e reuniões. Posso criar/mover/arquivar cards, listar tudo, dar resumos. Tenta:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              {suggestions.map(s => (
                <button key={s} className="ai-suggestion" onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="ai-msg user">
                <div className="ai-bubble">{m.text}</div>
              </div>
            );
          }
          if (m.role === 'assistant') {
            return (
              <div key={m.id} className="ai-msg assistant">
                <div className="ai-bubble" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text || '') }} />
              </div>
            );
          }
          if (m.role === 'tool') {
            const meta = TOOL_LABELS[m.toolName || ''] || { icon: '⚙️', label: m.toolName || 'Ação' };
            const summary = m.toolStatus === 'error'
              ? (m.toolResult?.error || 'erro')
              : (m.toolName === 'list_cards' ? `${m.toolResult?.total || 0} cards encontrados`
                 : m.toolName === 'create_card' ? `Card "${m.toolResult?.card?.nome || ''}" criado`
                 : m.toolName === 'move_card' ? `${m.toolResult?.from || '?'} → ${m.toolResult?.to || '?'}`
                 : m.toolName === 'get_stats' ? `Board: ${m.toolResult?.board_atual || '—'} · ${m.toolResult?.total_cards || 0} cards`
                 : '✓');
            return (
              <div key={m.id} className={`ai-tool${m.toolStatus === 'error' ? ' err' : ''}`}>
                <span className="ai-tool-icon">{meta.icon}</span>
                <span className="ai-tool-label">{meta.label}</span>
                <span className="ai-tool-summary">{summary}</span>
              </div>
            );
          }
          return null;
        })}

        {isLoading && (
          <div className="ai-msg assistant">
            <div className="ai-bubble ai-thinking">
              <span className="ai-dot" />
              <span className="ai-dot" />
              <span className="ai-dot" />
            </div>
          </div>
        )}

        {error && messages.length === 0 && (
          <div className="ai-error">{error}</div>
        )}
      </div>

      <div className="ai-foot">
        <textarea
          ref={inputRef}
          className="ai-input"
          placeholder={apiKeyConfigured ? 'Pergunta qualquer coisa…' : 'Configure a API key primeiro'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          disabled={!apiKeyConfigured || isLoading}
        />
        <button
          className="btn btn-primary ai-send"
          onClick={submit}
          disabled={!apiKeyConfigured || isLoading || !input.trim()}
          title="Enviar (Enter)"
        >
          {isLoading ? '⏳' : '↑'}
        </button>
      </div>
    </div>
  );
}
