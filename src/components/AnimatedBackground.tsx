import { useMemo } from 'react';

type Orb = {
  size: number;
  top: string;
  left: string;
  color: string;
  duration: string;
  delay: string;
  blur: number;
};

const ORB_COLORS = [
  'rgba(245, 179, 1, 0.18)',
  'rgba(34, 211, 238, 0.16)',
  'rgba(99, 102, 241, 0.14)',
  'rgba(245, 179, 1, 0.12)',
];

export default function AnimatedBackground() {
  const orbs = useMemo<Orb[]>(() => {
    const count = 7;
    return Array.from({ length: count }, (_, i) => ({
      size: 240 + Math.round(Math.random() * 260),
      top: `${Math.round(Math.random() * 100)}%`,
      left: `${Math.round(Math.random() * 100)}%`,
      color: ORB_COLORS[i % ORB_COLORS.length],
      duration: `${14 + Math.round(Math.random() * 12)}s`,
      delay: `${Math.round(Math.random() * 8)}s`,
      blur: 60 + Math.round(Math.random() * 40),
    }));
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, () => ({
        top: `${Math.round(Math.random() * 100)}%`,
        left: `${Math.round(Math.random() * 100)}%`,
        size: 1 + Math.random() * 2.5,
        duration: `${8 + Math.random() * 14}s`,
        delay: `${Math.random() * 10}s`,
        opacity: 0.2 + Math.random() * 0.4,
      })),
    []
  );

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* base gradient */}
      <div className="absolute inset-0 bg-[#07090f]" />
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(1200px 700px at 15% -10%, rgba(245,179,1,0.10), transparent 60%), radial-gradient(900px 600px at 100% 10%, rgba(34,211,238,0.08), transparent 60%), radial-gradient(800px 800px at 50% 120%, rgba(99,102,241,0.08), transparent 60%)',
        }}
      />

      {/* aurora blobs */}
      {orbs.map((o, i) => (
        <div
          key={`orb-${i}`}
          className="absolute rounded-full animate-aurora"
          style={{
            width: o.size,
            height: o.size,
            top: o.top,
            left: o.left,
            background: o.color,
            filter: `blur(${o.blur}px)`,
            animationDuration: o.duration,
            animationDelay: o.delay,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* floating particles */}
      {particles.map((p, i) => (
        <span
          key={`p-${i}`}
          className="absolute rounded-full bg-white animate-float-slow"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}

      {/* top scan line */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(245,179,1,0.5), transparent)' }}
      />
    </div>
  );
}
