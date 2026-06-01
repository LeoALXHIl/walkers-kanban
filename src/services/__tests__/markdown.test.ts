import { describe, it, expect } from 'vitest';
import { mdToHtml, escapeHtml } from '@/services/markdown';

describe('mdToHtml', () => {
  it('converte negrito e headings', () => {
    expect(mdToHtml('**oi**')).toContain('<strong>oi</strong>');
    expect(mdToHtml('# Título')).toContain('<h1>Título</h1>');
  });

  it('escapa HTML perigoso (proteção XSS)', () => {
    const out = mdToHtml('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('vazio retorna placeholder', () => {
    expect(mdToHtml('')).toContain('Sem descrição');
  });
});

describe('escapeHtml', () => {
  it('escapa caracteres especiais', () => {
    expect(escapeHtml('<a>&"')).toBe('&lt;a&gt;&amp;&quot;');
  });
});
