import { NetworkGraph } from '@/components/NetworkGraph';

export function GraphView() {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <NetworkGraph />
    </div>
  );
}
