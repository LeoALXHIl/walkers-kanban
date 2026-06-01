import { describe, it, expect } from 'vitest';
import { parseTranscript } from '@/services/parser';

describe('parseTranscript', () => {
  it('extrai nome, plataforma e prioridade', () => {
    const r = parseTranscript('cliente Maria no whatsapp urgente');
    expect(r.name.toLowerCase()).toContain('maria');
    expect(r.plat).toContain('wpp');
    expect(r.prio).toBe('high');
  });

  it('detecta data relativa "amanhã" (com acento)', () => {
    const r = parseTranscript('cliente João amanhã');
    expect(r.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('"depois de amanhã" é +2 e posterior a "amanhã"', () => {
    const amanha = parseTranscript('entregar amanhã')!.due!;
    const depois = parseTranscript('entregar depois de amanhã')!.due!;
    expect(depois).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(depois > amanha).toBe(true);
  });

  it('detecta instagram', () => {
    const r = parseTranscript('responder no instagram');
    expect(r.plat).toContain('insta');
  });

  it('texto vazio retorna card vazio', () => {
    expect(parseTranscript('')).toEqual({ name: '', note: '', plat: [] });
  });
});
