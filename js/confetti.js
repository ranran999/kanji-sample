const PALETTES = {
  gold: ['#FFD700', '#FFA500', '#FF4500', '#FF9F1C', '#2EC4B6', '#FFF8DC'],
  silver: ['#A0AEC0', '#CBD5E1', '#E2E8F0', '#2EC4B6', '#38B2AC'],
  combo: ['#FF9F1C', '#E71D36', '#2EC4B6', '#FFD700', '#9B51E0'],
};

export class Confetti {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.animationId = null;
    this.particles = [];
    this.frame = 0;
    this.onComplete = null;
  }

  trigger(type = 'gold', onComplete) {
    // If a previous celebration is still animating, stop it cleanly first
    // so two confetti bursts never render on top of each other.
    this._stop();
    this.onComplete = onComplete || null;

    const colors = PALETTES[type] || PALETTES.gold;
    const count = type === 'gold' ? 80 : 50;
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: w / 2 + (Math.random() - 0.5) * 80,
        y: h / 2 + (Math.random() - 0.5) * 40,
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

    this.frame = 0;
    this.canvas.classList.add('is-active');
    this.animationId = requestAnimationFrame(() => this._animate());
  }

  _drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    const ctx = this.ctx;
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
  }

  _animate() {
    const ctx = this.ctx;
    this.frame++;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let alive = false;
    for (const p of this.particles) {
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
        this._drawStar(0, 0, 5, p.size, p.size * 0.45);
      } else if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    if (alive && this.frame < 180) {
      this.animationId = requestAnimationFrame(() => this._animate());
    } else {
      this._finish();
    }
  }

  _finish() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.classList.remove('is-active');
    this.animationId = null;
    const cb = this.onComplete;
    this.onComplete = null;
    if (cb) cb();
  }

  _stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.classList.remove('is-active');
  }
}
