import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  vRot: number;
  shape: 'star' | 'circle' | 'rect';
  alpha: number;
}

interface ConfettiProps {
  active: boolean;
  type?: 'gold' | 'silver' | 'combo';
  onComplete?: () => void;
}

export const Confetti: React.FC<ConfettiProps> = ({
  active,
  type = 'gold',
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors =
      type === 'gold'
        ? ['#FFD700', '#FFA500', '#FF4500', '#FF9F1C', '#2EC4B6', '#FFF8DC']
        : type === 'silver'
        ? ['#A0AEC0', '#CBD5E1', '#E2E8F0', '#2EC4B6', '#38B2AC']
        : ['#FF9F1C', '#E71D36', '#2EC4B6', '#FFD700', '#9B51E0'];

    const particles: Particle[] = [];
    const count = type === 'gold' ? 80 : 50;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 80,
        y: canvas.height / 2 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 16 - 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 10 + 6,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        shape: Math.random() > 0.4 ? 'star' : Math.random() > 0.5 ? 'rect' : 'circle',
        alpha: 1,
      });
    }

    let animationId: number;
    let frame = 0;

    const drawStar = (cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fill();
    };

    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = false;
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        alive = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4; // gravity
        p.rotation += p.vRot;
        p.alpha = Math.max(0, p.alpha - 0.012);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'star') {
          drawStar(0, 0, 5, p.size, p.size * 0.45);
        } else if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (alive && frame < 180) {
        animationId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (onComplete) onComplete();
      }
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [active, type, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={600}
      className={`absolute inset-0 m-auto pointer-events-none z-50 transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
};
