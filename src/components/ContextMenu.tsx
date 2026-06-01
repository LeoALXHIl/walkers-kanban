import { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  submenu?: MenuItem[];
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Adjust position so menu stays inside the viewport
  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x, ny = y;
    if (nx + r.width > vw - 8) nx = vw - r.width - 8;
    if (ny + r.height > vh - 8) ny = vh - r.height - 8;
    ref.current.style.left = `${nx}px`;
    ref.current.style.top = `${ny}px`;
  }, [x, y]);

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
      {items.map((it, i) => it.divider ? (
        <div key={`d-${i}`} className="ctx-divider" />
      ) : (
        <button
          key={i}
          className={`ctx-item${it.danger ? ' danger' : ''}${it.disabled ? ' disabled' : ''}`}
          disabled={it.disabled}
          onClick={() => {
            if (it.disabled) return;
            it.onClick?.();
            onClose();
          }}
        >
          {it.icon && <span className="ctx-icon">{it.icon}</span>}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
