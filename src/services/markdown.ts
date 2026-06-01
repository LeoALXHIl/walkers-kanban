import { safeUrl } from './colors';

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Very lightweight keyword highlighter for fenced code blocks.
const SYNTAX_RULES: Record<string, { keywords: RegExp; strings: RegExp; comments: RegExp; numbers: RegExp }> = {
  default: {
    keywords: /\b(function|return|const|let|var|if|else|for|while|switch|case|break|continue|class|new|this|import|export|from|default|async|await|try|catch|finally|throw|null|true|false|undefined|in|of|typeof|instanceof|extends|implements|interface|type|enum|void|never|public|private|protected|static|abstract)\b/g,
    strings: /(['"`])((?:\\.|(?!\1).)*?)\1/g,
    comments: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g,
    numbers: /\b\d+(?:\.\d+)?\b/g
  },
  sql: {
    keywords: /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|CREATE|TABLE|INDEX|DROP|ALTER|AS|AND|OR|NOT|NULL|IS|IN|LIKE|BETWEEN|UNION|ALL|DISTINCT|TRUE|FALSE|CASE|WHEN|THEN|ELSE|END)\b/gi,
    strings: /'([^']*)'/g,
    comments: /(--[^\n]*|\/\*[\s\S]*?\*\/)/g,
    numbers: /\b\d+(?:\.\d+)?\b/g
  }
};

function highlightCode(lang: string, code: string): string {
  const rules = SYNTAX_RULES[lang.toLowerCase()] || SYNTAX_RULES.default;
  let out = escapeHtml(code);
  const tokens: string[] = [];
  const PLACEHOLDER = (i: number) => `TKN${i}TKN`;
  const token = (cls: string, txt: string) => {
    const i = tokens.length;
    tokens.push(`<span class="hl-${cls}">${txt}</span>`);
    return PLACEHOLDER(i);
  };
  out = out.replace(rules.comments, m => token('com', m));
  out = out.replace(rules.strings, m => token('str', m));
  out = out.replace(rules.keywords, m => token('kw', m));
  out = out.replace(rules.numbers, m => token('num', m));
  out = out.replace(/TKN(\d+)TKN/g, (_, i) => tokens[Number(i)]);
  return out;
}

export function mdToHtml(md: string): string {
  // Extract fenced code blocks first so they aren't touched by other markdown rules.
  const codeBlocks: string[] = [];
  let h = (md || '').replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) => {
    const i = codeBlocks.length;
    codeBlocks.push(`<pre class="code-block"><code class="lang-${(lang || 'plain').toLowerCase()}">${highlightCode(lang || '', code)}</code></pre>`);
    return `XCBX${i}XCBX`;
  });
  h = escapeHtml(h);
  h = h.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(/`(.+?)`/g, '<code>$1</code>');
  h = h.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (_m, label, url) => {
    const safe = safeUrl(url);
    if (!safe) return label;
    return `<a href="#" data-extlink="${escapeHtml(safe)}">${label}</a>`;
  });
  h = h.replace(/^- (.*)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>');
  h = h.replace(/\n/g, '<br>');
  h = h.replace(/<br>(<\/?(h1|h2|h3|ul|li|pre)>)/g, '$1');
  // Restore code blocks
  h = h.replace(/XCBX(\d+)XCBX/g, (_, i) => codeBlocks[Number(i)]);
  return h || '<span style="color:var(--text3)">Sem descrição.</span>';
}

export { escapeHtml };
