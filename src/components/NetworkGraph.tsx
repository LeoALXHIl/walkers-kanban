import { useEffect, useRef, useState } from 'react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { allClients, clientKey } from '@/services/clients';
import { pickHashColor } from '@/services/colors';

interface Node {
  id: string;
  type: 'client' | 'card' | 'tag';
  label: string;
  color: string;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  refId: string; // original entity id
}

interface Edge { source: string; target: string; }

const W = 800;
const H = 600;
const NODE_RADIUS = { client: 18, card: 10, tag: 7 };

// Simple force-directed layout — runs N iterations on mount and then on user drag.
function simulate(nodes: Node[], edges: Edge[], iterations = 280): void {
  const REPULSION = 4000;
  const SPRING = 0.04;
  const DAMP = 0.85;
  const CENTER_PULL = 0.0008;
  const cx = W / 2, cy = H / 2;
  const idMap = new Map(nodes.map(n => [n.id, n]));

  for (let it = 0; it < iterations; it++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist2 = dx * dx + dy * dy + 0.01;
        const force = REPULSION / dist2;
        const dist = Math.sqrt(dist2);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }
    // Spring along edges
    edges.forEach(e => {
      const a = idMap.get(e.source); const b = idMap.get(e.target);
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      a.vx += dx * SPRING; a.vy += dy * SPRING;
      b.vx -= dx * SPRING; b.vy -= dy * SPRING;
    });
    // Center pull
    nodes.forEach(n => {
      n.vx += (cx - n.x) * CENTER_PULL;
      n.vy += (cy - n.y) * CENTER_PULL;
    });
    // Apply velocity + damping
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      n.vx *= DAMP;
      n.vy *= DAMP;
      // Keep in bounds
      n.x = Math.max(20, Math.min(W - 20, n.x));
      n.y = Math.max(20, Math.min(H - 20, n.y));
    });
  }
}

export function NetworkGraph() {
  const data = useData(s => s.data);
  const openDetail = useUI(s => s.openDetail);
  const openClientDetail = useUI(s => s.openClientDetail);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Build graph on data change
  useEffect(() => {
    const activeBoardId = data.activeBoardId;
    const cards = data.cards.filter(c => !c.archived && (!c.boardId || c.boardId === activeBoardId));
    const clients = allClients(data).filter(c => !c.profile?.archived);
    const usedTagIds = new Set<string>();
    cards.forEach(c => (c.tagIds || []).forEach(id => usedTagIds.add(id)));
    clients.forEach(c => (c.profile?.tagIds || []).forEach(id => usedTagIds.add(id)));

    const ns: Node[] = [];
    const es: Edge[] = [];

    clients.forEach((c, i) => {
      ns.push({
        id: 'cli:' + c.key, type: 'client', label: c.displayName,
        color: c.profile?.color || pickHashColor(c.displayName),
        size: NODE_RADIUS.client + Math.min(8, c.totalCards),
        x: W / 2 + Math.cos((i / clients.length) * Math.PI * 2) * 200 + (Math.random() - 0.5) * 30,
        y: H / 2 + Math.sin((i / clients.length) * Math.PI * 2) * 200 + (Math.random() - 0.5) * 30,
        vx: 0, vy: 0, refId: c.key
      });
    });

    cards.forEach(c => {
      ns.push({
        id: 'crd:' + c.id, type: 'card', label: c.name,
        color: c.color || '#7c5cfc',
        size: NODE_RADIUS.card,
        x: W / 2 + (Math.random() - 0.5) * 100,
        y: H / 2 + (Math.random() - 0.5) * 100,
        vx: 0, vy: 0, refId: c.id
      });
      // Link card → client
      const ck = clientKey(c.name);
      if (clients.find(cl => cl.key === ck)) {
        es.push({ source: 'cli:' + ck, target: 'crd:' + c.id });
      }
      // Link card → tag
      (c.tagIds || []).forEach(tagId => {
        es.push({ source: 'crd:' + c.id, target: 'tag:' + tagId });
      });
    });

    data.tags.forEach(t => {
      if (!usedTagIds.has(t.id)) return;
      ns.push({
        id: 'tag:' + t.id, type: 'tag', label: t.name,
        color: t.color,
        size: NODE_RADIUS.tag,
        x: Math.random() * W,
        y: Math.random() * H,
        vx: 0, vy: 0, refId: t.id
      });
    });

    // Link client → tag
    clients.forEach(c => {
      (c.profile?.tagIds || []).forEach(tagId => {
        es.push({ source: 'cli:' + c.key, target: 'tag:' + tagId });
      });
    });

    simulate(ns, es, 280);
    setNodes(ns);
    setEdges(es);
  }, [data]);

  const handleClick = (n: Node) => {
    if (n.type === 'card') openDetail(n.refId);
    else if (n.type === 'client') openClientDetail(n.refId);
  };

  // Mouse drag a node
  const onMouseDown = (e: React.MouseEvent, n: Node) => {
    e.preventDefault();
    setDragId(n.id);
  };
  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: MouseEvent) => {
      const svg = svgRef.current; if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      setNodes(prev => prev.map(n => n.id === dragId ? { ...n, x, y, vx: 0, vy: 0 } : n));
    };
    const onUp = () => setDragId(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragId]);

  const idMap = new Map(nodes.map(n => [n.id, n]));
  const neighbors = new Set<string>();
  if (hoverId) {
    neighbors.add(hoverId);
    edges.forEach(e => {
      if (e.source === hoverId) neighbors.add(e.target);
      if (e.target === hoverId) neighbors.add(e.source);
    });
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', background: 'var(--bg)' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', padding: '8px 12px', fontSize: 11, color: 'var(--text2)', zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 4 }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', marginRight: 4 }} />Cliente</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--sky)', marginRight: 4 }} />Card</span>
          <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', marginRight: 4 }} />Tag</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Click pra abrir · arrasta pra mover · scroll pra zoom</div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: '100%', cursor: dragId ? 'grabbing' : 'default', background: 'radial-gradient(circle at center, var(--bg2) 0%, var(--bg) 100%)' }}
        onWheel={(e) => {
          e.preventDefault();
          setZoom(z => Math.max(0.4, Math.min(3, z * (e.deltaY > 0 ? 0.9 : 1.1))));
        }}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((e, i) => {
            const a = idMap.get(e.source); const b = idMap.get(e.target);
            if (!a || !b) return null;
            const isHovered = hoverId && (e.source === hoverId || e.target === hoverId);
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isHovered ? 'var(--accent)' : 'var(--border2)'}
                strokeWidth={isHovered ? 1.5 : 0.6}
                opacity={hoverId && !isHovered ? 0.15 : 0.6}
              />
            );
          })}
          {/* Nodes */}
          {nodes.map(n => {
            const isHovered = hoverId === n.id;
            const isNeighbor = neighbors.has(n.id);
            const visible = !hoverId || isHovered || isNeighbor;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                style={{ cursor: 'pointer', opacity: visible ? 1 : 0.25, transition: 'opacity .15s' }}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => handleClick(n)}
                onMouseDown={(e) => onMouseDown(e, n)}
              >
                <circle
                  r={n.size + (isHovered ? 4 : 0)}
                  fill={n.color}
                  fillOpacity={n.type === 'client' ? 0.85 : 0.7}
                  stroke={isHovered ? '#fff' : n.color}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{ transition: 'r .15s, stroke .15s' }}
                />
                {(isHovered || n.type === 'client') && (
                  <text
                    x={0}
                    y={n.size + 14}
                    textAnchor="middle"
                    fontSize={n.type === 'client' ? 11 : 10}
                    fill="var(--text)"
                    fontWeight={n.type === 'client' ? 600 : 400}
                    style={{ pointerEvents: 'none' }}
                  >
                    {n.label.length > 18 ? n.label.slice(0, 18) + '…' : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
