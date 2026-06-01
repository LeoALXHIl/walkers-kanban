// Converte os documentos de legal/*.md em páginas HTML estilizadas em public/.
// Sem dependências externas — cobre só o markdown usado nesses docs (títulos,
// negrito, links, tabelas GFM, listas `-`, citações `>`, hr, parágrafos).
// Rode com: node scripts/build-legal.cjs

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'legal');
const OUT = path.join(ROOT, 'public');

const PAGES = [
  { md: 'termos-de-uso.md', html: 'termos.html', title: 'Termos de Uso — Walkers Kanban' },
  { md: 'politica-de-privacidade.md', html: 'privacidade.html', title: 'Política de Privacidade — Walkers Kanban' },
  { md: 'lgpd-resumo.md', html: 'lgpd.html', title: 'Resumo LGPD — Walkers Kanban' }
];

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Inline: **bold**, [text](url), `code`. Aplicado após escapar HTML.
function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

  while (i < lines.length) {
    const line = lines[i];

    // Tabela GFM: linha com | seguida de linha separadora |---|
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[i + 1])) {
      closeList();
      const header = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2; // pula cabeçalho + separador
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      out.push('<table><thead><tr>' + header.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>');
      for (const r of rows) out.push('<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      out.push('</tbody></table>');
      continue;
    }

    if (/^#\s+/.test(line)) { closeList(); out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`); i++; continue; }
    if (/^##\s+/.test(line)) { closeList(); out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`); i++; continue; }
    if (/^>\s?/.test(line)) { closeList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); i++; continue; }
    if (/^---+\s*$/.test(line)) { closeList(); out.push('<hr/>'); i++; continue; }
    if (/^-\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^-\s+/, ''))}</li>`);
      i++; continue;
    }
    if (line.trim() === '') { closeList(); i++; continue; }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
    i++;
  }
  closeList();
  return out.join('\n');
}

const TEMPLATE = (title, body) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="robots" content="index,follow"/>
<title>${title}</title>
<style>
  :root { --accent:#7c3aed; --bg:#13131c; --card:#1b1b27; --text:#e8e8f0; --text2:#9b9bb0; --border:#2c2c3a; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap { max-width:780px; margin:0 auto; padding:48px 22px 80px; }
  a { color:#a78bfa; } a:hover { color:#c4b5fd; }
  h1 { font-size:30px; line-height:1.2; margin:0 0 8px; }
  h2 { font-size:19px; margin:34px 0 10px; color:#fff; border-bottom:1px solid var(--border); padding-bottom:6px; }
  p { margin:12px 0; color:var(--text); }
  ul { margin:12px 0; padding-left:22px; } li { margin:6px 0; }
  blockquote { margin:18px 0; padding:12px 16px; background:var(--card); border-left:3px solid var(--accent); border-radius:8px; color:var(--text2); }
  code { background:var(--card); padding:2px 6px; border-radius:5px; font-size:13px; }
  hr { border:none; border-top:1px solid var(--border); margin:28px 0; }
  table { width:100%; border-collapse:collapse; margin:16px 0; font-size:14px; }
  th,td { border:1px solid var(--border); padding:9px 11px; text-align:left; vertical-align:top; }
  th { background:var(--card); color:#fff; }
  .topbar { display:flex; align-items:center; gap:10px; margin-bottom:28px; }
  .topbar img { width:30px; height:30px; border-radius:7px; }
  .topbar a { color:var(--text2); text-decoration:none; font-weight:600; font-size:14px; }
  .foot { margin-top:50px; padding-top:18px; border-top:1px solid var(--border); color:var(--text2); font-size:13px; display:flex; gap:18px; flex-wrap:wrap; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <img src="/icon-192.png" alt="Walkers"/>
      <a href="/">← Voltar ao Walkers</a>
    </div>
    ${body}
    <div class="foot">
      <a href="/termos">Termos de Uso</a>
      <a href="/privacidade">Política de Privacidade</a>
      <a href="/lgpd">Resumo LGPD</a>
    </div>
  </div>
</body>
</html>`;

fs.mkdirSync(OUT, { recursive: true });
for (const p of PAGES) {
  const md = fs.readFileSync(path.join(SRC, p.md), 'utf8');
  const html = TEMPLATE(p.title, mdToHtml(md));
  fs.writeFileSync(path.join(OUT, p.html), html, 'utf8');
  console.log('gerado:', p.html);
}
