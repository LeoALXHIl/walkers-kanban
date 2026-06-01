import { useUI } from '@/store/ui';
import { CloseIcon } from '@/services/icons';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string[]; label: string }>;
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navegação por views',
    shortcuts: [
      { keys: ['1'], label: 'Kanban' },
      { keys: ['2'], label: 'Lista' },
      { keys: ['3'], label: 'Dashboard' },
      { keys: ['4'], label: 'Caixa de Entrada' },
      { keys: ['5'], label: 'Minhas Tarefas' },
      { keys: ['6'], label: 'Clientes (CRM)' },
      { keys: ['7'], label: 'Analytics' },
      { keys: ['8'], label: 'Integrações' },
      { keys: ['9'], label: 'Calendar' },
      { keys: ['0'], label: 'Emails (Gmail)' }
    ]
  },
  {
    title: 'Ações',
    shortcuts: [
      { keys: ['Ctrl', 'K'], label: 'Abrir Command Palette' },
      { keys: ['N'], label: 'Novo card' },
      { keys: ['/'], label: 'Focar busca' },
      { keys: ['Esc'], label: 'Fechar modais' },
      { keys: ['?'], label: 'Mostrar este cheatsheet' }
    ]
  },
  {
    title: 'No card (clicando)',
    shortcuts: [
      { keys: ['Double-click'], label: 'Editar nome inline (no nome do card)' },
      { keys: ['☆ → ⭐'], label: 'Fixar card no topo da coluna' },
      { keys: ['📋'], label: 'Duplicar card' },
      { keys: ['🗑️'], label: 'Arquivar ou apagar' },
      { keys: ['Click tag'], label: 'Filtrar por essa tag' },
      { keys: ['Click plataforma'], label: 'Filtrar por essa plataforma' },
      { keys: ['Click responsável'], label: 'Filtrar por esse nome' },
      { keys: ['Drag card'], label: 'Mover entre colunas' }
    ]
  },
  {
    title: 'Cmd+K Palette',
    shortcuts: [
      { keys: ['↑', '↓'], label: 'Navegar entre comandos' },
      { keys: ['↵'], label: 'Executar comando selecionado' },
      { keys: ['Esc'], label: 'Fechar palette' }
    ]
  },
  {
    title: 'Image + Voice',
    shortcuts: [
      { keys: ['Ctrl', 'V'], label: 'Cola imagem em qualquer lugar → OCR e criar card' },
      { keys: ['🎤 topbar'], label: 'Ditar card por voz (pt-BR)' }
    ]
  }
];

export function CheatsheetModal() {
  const open = useUI(s => s.cheatsheetOpen);
  const close = useUI(s => s.closeCheatsheet);

  if (!open) return null;

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal cheatsheet-modal">
        <div className="voice-head">
          <div>
            <div className="voice-eyebrow">Atalhos</div>
            <h2 className="voice-title">⌨️ Cheatsheet</h2>
          </div>
          <button className="detail-close" onClick={close}><CloseIcon /></button>
        </div>

        <div className="cheatsheet-body">
          <div className="cheatsheet-grid">
            {GROUPS.map(g => (
              <div key={g.title} className="cheatsheet-section">
                <div className="cheatsheet-section-title">{g.title}</div>
                <div className="cheatsheet-list">
                  {g.shortcuts.map((s, i) => (
                    <div key={i} className="cheatsheet-row">
                      <div className="cheatsheet-keys">
                        {s.keys.map((k, ki) => (
                          <span key={ki}>
                            <kbd>{k}</kbd>
                            {ki < s.keys.length - 1 && <span className="cheatsheet-plus">+</span>}
                          </span>
                        ))}
                      </div>
                      <div className="cheatsheet-label">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="voice-foot" style={{ borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 10, color: 'var(--text3)', marginRight: 'auto' }}>
            💡 Aperte <kbd style={{ background: 'var(--bg4)', padding: '1px 5px', borderRadius: 4, fontFamily: 'Geist Mono', fontSize: 10 }}>?</kbd> de qualquer lugar pra abrir isto
          </span>
          <button className="btn btn-primary" onClick={close}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
