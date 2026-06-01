export function confetti(): void {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2000;';
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  if (!ctx) { c.remove(); return; }
  const colors = ['#7c5cfc', '#ec4899', '#22c55e', '#f59e0b', '#38bdf8', '#a855f7', '#22c55e', '#fff'];
  const parts: Array<{ x: number; y: number; vx: number; vy: number; r: number; color: string; rot: number; vr: number }> = [];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2 - 60;
  for (let i = 0; i < 120; i++) {
    parts.push({
      x: cx + (Math.random() - 0.5) * 120,
      y: cy,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() * -1 - 0.4) * 18,
      r: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 18
    });
  }
  let t = 0;
  const step = () => {
    t++;
    ctx.clearRect(0, 0, c.width, c.height);
    parts.forEach(p => {
      p.vy += 0.5;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, 1 - t / 130);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
      ctx.restore();
    });
    if (t < 130) requestAnimationFrame(step);
    else c.remove();
  };
  requestAnimationFrame(step);
}
