import { useEffect, useState } from 'react';
import { useUI } from '@/store/ui';
import { useTheme, THEMES, PRESET_ACCENTS, UI_SCALES, type ThemeId, type Density, type UiScale } from '@/store/theme';
import { CloseIcon } from '@/services/icons';
import { assignEmailEnabled, setAssignEmailEnabled } from '@/services/assignEmail';
import type { AppSettings, UpdaterStatus } from '@/global';

export function SettingsModal() {
  const open = useUI(s => s.settingsOpen);
  const close = useUI(s => s.closeSettings);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [version, setVersion] = useState<string>('');
  const [updater, setUpdater] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) return;
    window.walkersAPI.getSettings().then(setSettings);
    window.walkersAPI.getAppVersion().then(setVersion);
  }, [open]);

  useEffect(() => {
    window.walkersAPI.onUpdaterStatus((s) => {
      setUpdater(s);
      if (s.kind !== 'progress') setChecking(false);
    });
  }, []);

  if (!open || !settings) return null;

  const set = async (patch: Partial<AppSettings>) => {
    const next = await window.walkersAPI.saveSettings(patch);
    setSettings(next);
  };

  const check = async () => {
    setChecking(true);
    setUpdater(null);
    await window.walkersAPI.checkForUpdates();
  };

  const install = () => window.walkersAPI.installUpdate();

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal settings-modal">
        <div className="settings-head">
          <h2>Configurações</h2>
          <button className="detail-close" onClick={close} aria-label="Fechar">
            <CloseIcon />
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">🎨 Aparência</div>
          <ThemePicker />
          <AccentPicker />
          <DensityPicker />
          <UiScalePicker />
        </div>


        <div className="settings-section">
          <div className="settings-section-title">Comportamento da janela</div>

          <SettingRow
            label="Minimizar para a bandeja ao fechar"
            sub="Fechar a janela mantém o app rodando no ícone do relógio. Use o menu da bandeja → Sair pra fechar de verdade."
            value={settings.minimizeToTray}
            onChange={(v) => set({ minimizeToTray: v })}
          />

          <SettingRow
            label="Iniciar com o Windows"
            sub="Abre o Walkers automaticamente quando você liga o PC. Inicia minimizado na bandeja."
            value={settings.autoLaunch}
            onChange={(v) => set({ autoLaunch: v })}
          />

          <SettingRow
            label="Notificações do sistema"
            sub="Avisos de streak em risco, atualizações disponíveis e outros eventos importantes."
            value={settings.notifications}
            onChange={(v) => set({ notifications: v })}
          />
        </div>

        <div className="settings-section">
          <div className="settings-section-title">📧 Email automático</div>
          <AssignEmailToggle />
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Atualizações</div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Versão instalada</div>
              <div className="settings-row-sub">v{version || '—'}</div>
            </div>
            <button className="btn btn-ghost" onClick={check} disabled={checking}>
              {checking ? 'Verificando…' : 'Verificar atualizações'}
            </button>
          </div>
          {updater && <UpdaterLine status={updater} onInstall={install} />}
        </div>

        <div className="settings-foot">
          <button className="btn btn-ghost" onClick={() => window.walkersAPI.showDataFolder()}>
            Abrir pasta local
          </button>
          <button className="btn btn-danger" onClick={() => { if (confirm('Sair do app completamente?')) window.walkersAPI.quitApp(); }}>
            Sair do app
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignEmailToggle() {
  const [on, setOn] = useState(assignEmailEnabled());
  return (
    <SettingRow
      label="Enviar email ao atribuir tarefa (via seu Gmail)"
      sub="Quando você define o responsável de um card/subtarefa, envia um email pra pessoa pelo seu Gmail. Requer reconectar o Google em Integrações (permissão de envio). ⚠️ Não ligue se você já usa a Cloud Function de email — senão a pessoa recebe 2 emails."
      value={on}
      onChange={(v) => { setAssignEmailEnabled(v); setOn(v); }}
    />
  );
}

function SettingRow({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="settings-row">
      <div className="settings-row-body">
        <div className="settings-row-label">{label}</div>
        <div className="settings-row-sub">{sub}</div>
      </div>
      <button
        className={`switch${value ? ' on' : ''}`}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}

function UpdaterLine({ status, onInstall }: { status: UpdaterStatus; onInstall: () => void }) {
  switch (status.kind) {
    case 'available':
      return <div className="settings-note">Atualização <strong>v{status.version}</strong> encontrada. Baixando…</div>;
    case 'progress':
      return <div className="settings-note">Baixando atualização… {status.percent}%</div>;
    case 'downloaded':
      return (
        <div className="settings-note settings-note-ok">
          Atualização <strong>v{status.version}</strong> pronta.
          <button className="btn btn-primary" onClick={onInstall} style={{ marginLeft: 10 }}>Reiniciar e instalar</button>
        </div>
      );
    case 'none':
      return <div className="settings-note">Você está na versão mais recente.</div>;
    case 'unavailable':
      return <div className="settings-note settings-note-warn">Auto-update não configurado neste build. Configure <code>publish</code> em electron-builder.yml.</div>;
    case 'error':
      return <div className="settings-note settings-note-warn">Erro ao verificar: {status.message}</div>;
    default:
      return null;
  }
}

function UiScalePicker() {
  const uiScale = useTheme(s => s.uiScale);
  const setUiScale = useTheme(s => s.setUiScale);
  return (
    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="settings-row-body" style={{ marginBottom: 8 }}>
        <div className="settings-row-label">Tamanho da interface</div>
        <div className="settings-row-sub">Adapta o app ao seu monitor. <strong>Automático</strong> ajusta sozinho conforme a resolução — em telas grandes/4K fica maior, em laptops menores fica compacto. Use um valor fixo se preferir.</div>
      </div>
      <div className="density-toggle" style={{ flexWrap: 'wrap' }}>
        {UI_SCALES.map(o => (
          <button
            key={o.v}
            className={`density-btn${uiScale === o.v ? ' active' : ''}`}
            onClick={() => setUiScale(o.v as UiScale)}
            title={o.desc}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function DensityPicker() {
  const density = useTheme(s => s.density);
  const setDensity = useTheme(s => s.setDensity);
  const opts: Array<{ v: Density; label: string; emoji: string }> = [
    { v: 'compact', label: 'Compacto', emoji: '🔹' },
    { v: 'normal', label: 'Normal', emoji: '🔸' },
    { v: 'comfortable', label: 'Confortável', emoji: '🔶' }
  ];
  return (
    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="settings-row-body" style={{ marginBottom: 8 }}>
        <div className="settings-row-label">Densidade</div>
        <div className="settings-row-sub">Quanto espaço cada card ocupa. Compacto = mais cards visíveis, Confortável = mais ar.</div>
      </div>
      <div className="density-toggle">
        {opts.map(o => (
          <button
            key={o.v}
            className={`density-btn${density === o.v ? ' active' : ''}`}
            onClick={() => setDensity(o.v)}
          >{o.emoji} {o.label}</button>
        ))}
      </div>
    </div>
  );
}

function ThemePicker() {
  const theme = useTheme(s => s.theme);
  const setTheme = useTheme(s => s.setTheme);
  return (
    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="settings-row-body" style={{ marginBottom: 8 }}>
        <div className="settings-row-label">Tema</div>
        <div className="settings-row-sub">Escolha o visual. "Seguir sistema" muda entre claro/escuro conforme seu Windows.</div>
      </div>
      <div className="theme-grid">
        {THEMES.map(t => (
          <button
            key={t.id}
            className={`theme-card${theme === t.id ? ' active' : ''}`}
            onClick={() => setTheme(t.id as ThemeId)}
            data-theme-preview={t.id === 'system' ? 'dark-purple' : t.id}
          >
            <div className="theme-card-preview">
              <span className="theme-dot bg" />
              <span className="theme-dot bg2" />
              <span className="theme-dot accent" />
            </div>
            <div className="theme-card-label">
              <span>{t.emoji}</span>
              <span>{t.label}</span>
              {theme === t.id && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AccentPicker() {
  const accent = useTheme(s => s.accent);
  const setAccent = useTheme(s => s.setAccent);
  const [customHex, setCustomHex] = useState(accent || '');

  return (
    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="settings-row-body" style={{ marginBottom: 8 }}>
        <div className="settings-row-label">Cor de destaque</div>
        <div className="settings-row-sub">Override da cor primária do tema. Vazio = usa a cor padrão do tema.</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className={`accent-chip${!accent ? ' active' : ''}`}
          onClick={() => { setAccent(null); setCustomHex(''); }}
          style={{ background: 'transparent', border: '2px dashed var(--border2)', color: 'var(--text3)', fontSize: 10 }}
          title="Usar cor padrão do tema"
        >
          padrão
        </button>
        {PRESET_ACCENTS.map(c => (
          <button
            key={c}
            className={`accent-chip${accent === c ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => { setAccent(c); setCustomHex(c); }}
            title={c}
          />
        ))}
        <input
          type="text"
          placeholder="#hex"
          value={customHex}
          onChange={(e) => setCustomHex(e.target.value)}
          onBlur={() => {
            const v = customHex.trim();
            if (/^#[0-9a-f]{6}$/i.test(v)) setAccent(v);
            else if (!v) setAccent(null);
          }}
          style={{
            background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--rs)',
            padding: '4px 8px', fontSize: 11, fontFamily: 'Geist Mono, monospace', width: 90, color: 'var(--text)'
          }}
        />
      </div>
    </div>
  );
}
