import { useEffect, useState } from 'react';
import { useUI } from '@/store/ui';

export function McpInfoModal() {
  const open = useUI(s => s.mcpInfoOpen);
  const close = useUI(s => s.closeMcpInfo);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    window.walkersAPI.getDataPath().then(() => {
      const isWin = navigator.platform.toLowerCase().includes('win');
      const mockPath = isWin
        ? 'C:\\\\Users\\\\Leonardo\\\\Downloads\\\\walkers-kanban-v3\\\\walkers-kanban-v3\\\\mcp-server.js'
        : '/Users/user/walkers-kanban-v3/mcp-server.js';
      setConfig(`{
  "mcpServers": {
    "walkers-kanban": {
      "command": "node",
      "args": ["${mockPath}"]
    }
  }
}`);
    });
  }, [open]);

  if (!open) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" style={{ width: 520 }}>
        <h2>Conectar Claude Desktop · MCP</h2>
        <p>Adicione no <code>claude_desktop_config.json</code> (Claude Desktop → Settings → Developer → Editar Config):</p>
        <pre>{config}</pre>
        <button className="btn btn-ghost" onClick={copy} style={{ marginBottom: 14 }}>
          {copied ? '✓ Copiado!' : 'Copiar configuração'}
        </button>
        <p style={{ fontSize: 10, color: 'var(--text3)' }}>
          Reinicie o Claude Desktop após salvar. O servidor walkers-kanban tem 16 ferramentas e escreve direto no Firestore — mudanças do Claude aparecem aqui em tempo real. O Claude cacheia leituras por 24h pra economizar quota; diga "atualiza o kanban" pra forçar refresh.
        </p>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={close}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
