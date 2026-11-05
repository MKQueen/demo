// Bounded catch-up prevents a resumed background tab from replaying seconds of combat.
export class FixedStep {
  constructor({ hz = 60, maxSteps = 5 } = {}) {
    this.step = 1 / hz; this.maxSteps = maxSteps;
    this.accumulator = 0; this.droppedTime = 0; this.ticks = 0;
  }
  advance(elapsed, update) {
    if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
    const budget = this.step * this.maxSteps;
    this.droppedTime += Math.max(0, elapsed - budget);
    this.accumulator += Math.min(elapsed, budget);
    let count = 0;
    while (this.accumulator + 1e-10 >= this.step && count < this.maxSteps) {
      update(this.step); this.ticks++; count++;
      this.accumulator = Math.max(0, this.accumulator - this.step);
    }
    return count;
  }
  reset() { this.accumulator = 0; }
}
