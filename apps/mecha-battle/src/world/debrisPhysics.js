let RAPIER;
let ready = false;
export async function initDebrisPhysics() {
  if(ready)return;
  RAPIER=(await import('@dimforge/rapier3d-compat')).default;
  await RAPIER.init(); ready = true;
}

// Decorative rigid bodies only. Actor damage continues to use swept bone contacts.
export class DebrisPhysics {
  constructor(limit = 96) {
    if (!ready) throw new Error('Debris physics must be initialized before the scene');
    this.limit = limit;
    this.world = new RAPIER.World({ x: 0, y: -38, z: 0 });
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(700, .5, 700).setTranslation(0, -.5, 0).setFriction(.8));
    this.bodies = new Map(); this.statics = new Map(); this.buildings = () => [];
    this.syncTime = 0;
  }
  spawn(p, halfSize) {
    this.remove(p);
    if (this.bodies.size >= this.limit) {
      const oldest = this.bodies.keys().next().value;
      this.remove(oldest); oldest.active = false;
    }
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p.pos.x, Math.max(halfSize + .02, p.pos.y), p.pos.z)
      .setLinvel(p.vel.x, p.vel.y, p.vel.z)
      .setAngvel({ x: p.spin.x, y: p.spin.y, z: p.spin.z })
      .setLinearDamping(.12).setAngularDamping(.4).setCcdEnabled(true));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(halfSize, halfSize, halfSize)
      .setFriction(.75).setRestitution(.18).setDensity(2), body);
    this.bodies.set(p, body);
    return body;
  }
  remove(p) {
    const body = this.bodies.get(p);
    if (body) this.world.removeRigidBody(body);
    this.bodies.delete(p);
  }
  syncBuildings() {
    const chunks = [...this.bodies.values()].map(b => b.translation());
    const nearby = this.buildings().filter(b => !b.destroyed).map(b => ({ b,
      distance: Math.min(...chunks.map(p => Math.hypot(Math.max(0, Math.abs(p.x-b.x)-b.w/2), Math.max(0, Math.abs(p.z-b.z)-b.d/2))))
    })).filter(v => v.distance < 35).sort((a,b) => a.distance-b.distance).slice(0,48).map(v => v.b);
    const wanted = new Set(nearby);
    for (const [b, collider] of this.statics) if (!wanted.has(b)) {
      this.world.removeCollider(collider, true); this.statics.delete(b);
    }
    for (const b of nearby) if (!this.statics.has(b)) {
      this.statics.set(b, this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.w/2,b.h/2,b.d/2).setTranslation(b.x,b.h/2,b.z).setFriction(.8)));
    }
  }
  update(dt) {
    if (!(dt > 0) || !this.bodies.size) return;
    // Remove a collapsed tower's collider immediately; refresh nearby selection at 4 Hz.
    for (const [b,c] of this.statics) if (b.destroyed) { this.world.removeCollider(c,true); this.statics.delete(b); }
    this.syncTime -= dt;
    if (this.syncTime <= 0) { this.syncBuildings(); this.syncTime = .25; }
    this.world.timestep = Math.min(dt, 1/30); this.world.step();
    for (const [p, body] of this.bodies) {
      const t = body.translation(), q = body.rotation();
      p.pos.set(t.x,t.y,t.z);
      // THREE Euler exposes setFromQuaternion; avoid a dependency in the physics core.
      p.physicsRotation = q;
    }
  }
  clear() {
    for (const p of this.bodies.keys()) this.remove(p);
    for (const c of this.statics.values()) this.world.removeCollider(c, true);
    this.statics.clear(); this.syncTime = 0;
  }
  dispose() { this.clear(); this.world.free(); }
}
