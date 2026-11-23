/**
 * game.js —— 手势贪吃蛇的游戏核心与渲染。
 *
 * 坐标统一用「归一化坐标」保存（0~1），渲染时再换算成画布像素，
 * 这样摄像头画面怎么缩放、屏幕怎么转，蛇和食物都还待在正确的位置。
 */

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class SnakeGame {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onEat = options.onEat || (() => {});
    this.onBonus = options.onBonus || (() => {});
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.arena = false;
    this.paused = false;
    this.handActive = false;
    this.handLandmarks = null;
    this.handEdge = '';
    this.target = { x: 0.5, y: 0.5 };
    this.lastDirection = { x: 1, y: 0 };
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.reset();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
  }

  reset() {
    this.segments = [];
    for (let i = 0; i < 6; i += 1) {
      this.segments.push({ x: 0.5 - i * 0.022, y: 0.58 });
    }
    this.target = { x: 0.5, y: 0.55 };
    this.pendingGrowth = 0;
    this.food = { x: 0.66, y: 0.42, bonus: false, bornAt: performance.now() };
    this.score = 0;
    this.foodsEaten = 0;
    this.particles = [];
    this.popups = [];
    this.shake = 0;
    this.flash = 0;
    this.time = 0;
    this.speed = 0.78;
    this.spacing = 0;
    this.spawnFood();
  }

  get length() {
    return this.segments.length;
  }

  setArena(arena) {
    this.arena = arena;
  }

  setTarget(x, y) {
    this.target.x = clamp(x, 0.02, 0.98);
    this.target.y = clamp(y, 0.02, 0.98);
  }

  setPaused(paused) {
    this.paused = paused;
  }

  setHand(landmarks, handedness = '') {
    this.handLandmarks = landmarks;
    this.handEdge = handedness;
    this.handActive = Boolean(landmarks && landmarks.length >= 21);
  }

  clearHand() {
    this.handLandmarks = null;
    this.handActive = false;
  }

  /** 指尖（食指 8）作为蛇头控制点 */
  static fingertip(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;
    return { x: landmarks[8].x, y: landmarks[8].y };
  }

  spawnFood() {
    const random = () => clamp(0.1 + Math.random() * 0.8, 0.08, 0.92);
    let position = { x: random(), y: random() };
    for (let attempt = 0; attempt < 12; attempt += 1) {
      position = { x: random(), y: random() };
      if (dist(position, this.target) < 0.16) continue;
      if (this.segments.some((segment, index) => index > 2 && dist(position, segment) < 0.1)) continue;
      break;
    }
    const bonus = this.foodsEaten > 0 && this.foodsEaten % 5 === 0;
    this.food = { ...position, bonus, bornAt: performance.now(), radius: bonus ? 0.026 : 0.018 };
  }

  addParticles(position, color, count = 16) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.05 + Math.random() * 0.22;
      this.particles.push({
        x: position.x,
        y: position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 1 + Math.random() * 2.4,
        color,
      });
    }
  }

  addPopup(position, text, color) {
    this.popups.push({ x: position.x, y: position.y, text, color, life: 1, maxLife: 1 });
  }

  update(dt) {
    this.time += dt;
    const width = this.width;
    const height = this.height;
    const minSide = Math.min(width, height);
    this.spacing = Math.max(9, minSide * 0.026);
    const speedPx = minSide * (this.speed + this.segments.length * 0.0012);
    const pixelDist = (a, b) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);

    if (!this.paused) {
      const head = this.segments[0];
      const targetPx = { x: this.target.x * width, y: this.target.y * height };
      const headPx = { x: head.x * width, y: head.y * height };
      const dx = targetPx.x - headPx.x;
      const dy = targetPx.y - headPx.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 1.5) {
        const step = Math.min(distance, speedPx * dt);
        head.x = clamp(head.x + (dx / distance) * (step / width), 0.012, 0.988);
        head.y = clamp(head.y + (dy / distance) * (step / height), 0.012, 0.988);
        this.lastDirection.x = dx / distance;
        this.lastDirection.y = dy / distance;
      }

      // 身体段跟随：始终保持固定间距，像一条被拖着的绳子
      for (let index = 1; index < this.segments.length; index += 1) {
        const previous = this.segments[index - 1];
        const segment = this.segments[index];
        const pxDistance = pixelDist(previous, segment);
        if (pxDistance > this.spacing) {
          const pull = (pxDistance - this.spacing) / pxDistance;
          segment.x += (previous.x - segment.x) * pull;
          segment.y += (previous.y - segment.y) * pull;
        }
      }

      // 生长：把新段接在尾部，再慢慢伸出来
      while (this.pendingGrowth > 0) {
        const tail = this.segments[this.segments.length - 1];
        this.segments.push({ x: tail.x, y: tail.y });
        this.pendingGrowth -= 1;
      }

      // 吃食物
      const foodPx = { x: this.food.x * width, y: this.food.y * height };
      const headFood = Math.hypot(head.x * width - foodPx.x, head.y * height - foodPx.y);
      const foodRadiusPx = this.food.radius * minSide;
      if (headFood < foodRadiusPx + minSide * 0.012) {
        const bonus = this.food.bonus;
        const gain = bonus ? 5 : 1;
        this.score += gain;
        this.foodsEaten += 1;
        this.pendingGrowth += bonus ? 5 : 3;
        this.addParticles(this.food, bonus ? '#ffd166' : '#ff5ea8', bonus ? 26 : 16);
        this.addPopup(this.food, `+${gain}`, bonus ? '#ffd166' : '#9dffb0');
        this.shake = bonus ? 14 : 8;
        this.flash = bonus ? 0.5 : 0.25;
        if (bonus) this.onBonus(gain);
        else this.onEat(gain);
        this.spawnFood();
      }
    }

    // 粒子
    this.particles = this.particles.filter((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 0.12 * dt;
      return particle.life > 0;
    });
    // 飘字
    this.popups = this.popups.filter((popup) => {
      popup.life -= dt;
      popup.y -= dt * 0.08;
      return popup.life > 0;
    });

    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 1.6);
  }

  render(time) {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    const minSide = Math.min(width, height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (this.arena) this.renderArena(ctx, width, height, time);

    const shakeX = (Math.random() - 0.5) * this.shake;
    const shakeY = (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.renderFood(ctx, minSide, time);
    this.renderSnake(ctx, width, height, minSide, time);
    this.renderHand(ctx, width, height, minSide, time);
    this.renderParticles(ctx, width, height);
    this.renderPopups(ctx, width, height);

    ctx.restore();

    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flash * 0.12})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  renderArena(ctx, width, height, time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#061019');
    gradient.addColorStop(0.6, '#08131b');
    gradient.addColorStop(1, '#03080c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.strokeStyle = 'rgba(120, 255, 190, 0.06)';
    ctx.lineWidth = 1;
    const grid = Math.max(36, Math.min(width, height) / 14);
    for (let x = 0; x < width; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(width * 0.5, height * 0.45, 10, width * 0.5, height * 0.45, width * 0.7);
    glow.addColorStop(0, 'rgba(60, 200, 150, 0.10)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  renderFood(ctx, minSide, time) {
    if (!this.food) return;
    const x = this.food.x * this.width;
    const y = this.food.y * this.height;
    const pulse = 1 + Math.sin(time * 5) * 0.12;
    const radius = this.food.radius * minSide * pulse;
    const color = this.food.bonus ? '#ffd166' : '#ff5ea8';
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.2);
    glow.addColorStop(0, color);
    glow.addColorStop(0.35, color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x - radius * 0.28, y - radius * 0.32, radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
    if (this.food.bonus) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.7 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderSnake(ctx, width, height, minSide, time) {
    const points = this.segments.map((segment) => ({
      x: segment.x * width,
      y: segment.y * height,
    }));
    if (!points.length) return;

    // 拖影
    ctx.save();
    ctx.strokeStyle = 'rgba(120, 255, 190, 0.10)';
    ctx.lineWidth = Math.max(18, minSide * 0.045);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();

    // 身体：从尾到头由青到亮绿
    for (let index = points.length - 1; index > 0; index -= 1) {
      const point = points[index];
      const next = points[index - 1];
      const t = 1 - index / points.length;
      const widthFactor = lerp(minSide * 0.012, minSide * 0.026, t);
      ctx.save();
      ctx.strokeStyle = `hsl(${168 - t * 30}, 92%, ${56 + t * 12}%)`;
      ctx.lineWidth = widthFactor;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(90, 255, 180, 0.55)';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(next.x, next.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.restore();
    }

    const head = points[0];
    const headRadius = Math.max(11, minSide * 0.021);
    const angle = Math.atan2(this.lastDirection.y, this.lastDirection.x);
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(angle);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, headRadius * 3);
    glow.addColorStop(0, 'rgba(140, 255, 200, 0.55)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, headRadius * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9dffb0';
    ctx.shadowColor = 'rgba(120, 255, 190, 0.9)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.ellipse(0, 0, headRadius * 1.2, headRadius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 眼睛
    const eyeOffset = headRadius * 0.38;
    const eyeRadius = Math.max(2, headRadius * 0.2);
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#04140c';
      ctx.beginPath();
      ctx.arc(eyeOffset * 0.7, side * eyeOffset, eyeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(eyeOffset * 0.72, side * eyeOffset - eyeRadius * 0.3, eyeRadius * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
    // 舌头偶尔吐一下
    if (Math.sin(time * 2.2) > 0.86) {
      ctx.strokeStyle = '#ff6b9d';
      ctx.lineWidth = Math.max(1.4, headRadius * 0.12);
      ctx.beginPath();
      ctx.moveTo(headRadius * 1.2, 0);
      ctx.lineTo(headRadius * 2.1, 0);
      ctx.moveTo(headRadius * 2.1, 0);
      ctx.lineTo(headRadius * 2.5, -headRadius * 0.28);
      ctx.moveTo(headRadius * 2.1, 0);
      ctx.lineTo(headRadius * 2.5, headRadius * 0.28);
      ctx.stroke();
    }
    ctx.restore();

    // 目标光标：显示手/鼠标当前控制点
    const targetX = this.target.x * width;
    const targetY = this.target.y * height;
    ctx.save();
    ctx.strokeStyle = this.handActive ? 'rgba(120, 229, 255, 0.5)' : 'rgba(160, 220, 200, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(targetX, targetY, Math.max(10, minSide * 0.018) + Math.sin(time * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(targetX - 4, targetY);
    ctx.lineTo(targetX + 4, targetY);
    ctx.moveTo(targetX, targetY - 4);
    ctx.lineTo(targetX, targetY + 4);
    ctx.stroke();
    ctx.restore();
  }

  renderHand(ctx, width, height, minSide, time) {
    const landmarks = this.handLandmarks;
    if (!landmarks || landmarks.length < 21) return;
    const points = landmarks.map((point) => ({ x: point.x * width, y: point.y * height }));
    const lineWidth = Math.max(1.6, minSide * 0.0032);
    const joint = Math.max(2.4, minSide * 0.005);

    ctx.save();
    ctx.strokeStyle = 'rgba(108, 229, 255, 0.92)';
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = 'rgba(108, 229, 255, 0.6)';
    ctx.shadowBlur = 8;
    for (const [from, to] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(points[from].x, points[from].y);
      ctx.lineTo(points[to].x, points[to].y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    points.forEach((point, index) => {
      const isTip = [4, 8, 12, 16, 20].includes(index);
      ctx.fillStyle = index === 8 ? '#9dffb0' : isTip ? 'rgba(160, 240, 255, 1)' : 'rgba(108, 229, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(point.x, point.y, index === 8 ? joint * 1.9 : joint, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = 'rgba(157, 255, 176, 0.9)';
    ctx.lineWidth = Math.max(1.5, lineWidth * 1.4);
    ctx.beginPath();
    ctx.arc(points[8].x, points[8].y, joint * 3.4 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  renderParticles(ctx, width, height) {
    ctx.save();
    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x * width, particle.y * height, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderPopups(ctx, width, height) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 20px "SF Mono", ui-monospace, monospace';
    for (const popup of this.popups) {
      const alpha = clamp(popup.life / popup.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = popup.color;
      ctx.shadowColor = popup.color;
      ctx.shadowBlur = 14;
      ctx.fillText(popup.text, popup.x * width, popup.y * height);
    }
    ctx.restore();
  }
}
