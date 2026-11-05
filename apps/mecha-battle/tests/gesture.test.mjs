import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureAnalyzer, LM } from '../src/pose/gesture.js';

/** Build a synthetic, fully visible pose in MediaPipe's normalized/world formats. */
function body() {
  const n = [];
  for (let i = 0; i < 33; i++) n.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 });
  const set = (i, x, y, z = 0) => { n[i] = { x, y, z, visibility: 0.99 }; };
  set(LM.NOSE, 0.5, 0.16);
  set(LM.L_SHOULDER, 0.36, 0.3);
  set(LM.R_SHOULDER, 0.64, 0.3);
  set(LM.L_ELBOW, 0.32, 0.45);
  set(LM.R_ELBOW, 0.68, 0.45);
  set(LM.L_WRIST, 0.3, 0.58);
  set(LM.R_WRIST, 0.7, 0.58);
  set(LM.L_HIP, 0.42, 0.52);
  set(LM.R_HIP, 0.58, 0.52);
  set(LM.L_KNEE, 0.41, 0.7);
  set(LM.R_KNEE, 0.59, 0.7);
  set(LM.L_ANKLE, 0.4, 0.88);
  set(LM.R_ANKLE, 0.6, 0.88);
  const w = n.map((p) => ({ x: (0.5 - p.x) * 0.8, y: (p.y - 0.5) * 1.8, z: 0, visibility: 0.99 }));
  return { n, w };
}

let now = 1_000;

class Rig {
  constructor() {
    this.analyzer = new GestureAnalyzer();
    this.modifier = null;
    this.events = [];
    this.now = 1_000;
  }
  frame(dt = 1 / 30) {
    const p = body();
    this.modifier?.(p.n, p.w);
    this.now += dt * 1000;
    this.analyzer.update(p.n, p.w, this.now);
    this.events.push(...this.analyzer.takeEvents());
    return this.analyzer.state;
  }
  frames(count, dt = 1 / 30) {
    for (let i = 0; i < count; i++) this.frame(dt);
    return this.analyzer.state;
  }
  calibrate() {
    this.frames(50);
  }
}

function punchArm(n, w, side, forward = 1) {
  const si = side === 'left' ? LM.L_SHOULDER : LM.R_SHOULDER;
  const ei = side === 'left' ? LM.L_ELBOW : LM.R_ELBOW;
  const wi = side === 'left' ? LM.L_WRIST : LM.R_WRIST;
  w[si].z = 0;
  w[si].y = -0.36;
  w[ei].x = w[si].x; w[ei].y = -0.34; w[ei].z = -0.38 * forward;
  w[wi].x = w[si].x; w[wi].y = -0.32; w[wi].z = -0.9 * forward;
  n[ei].x = n[si].x; n[ei].y = 0.3;
  n[wi].x = n[si].x; n[wi].y = 0.3;
}

test('calibrates and detects walking in place', () => {
  const rig = new Rig();
  rig.calibrate();
  assert.equal(rig.analyzer.state.fullBody, true);
  assert.ok(rig.analyzer.state.quality > 0.8);

  for (let i = 0; i < 12; i++) {
    const side = i % 2 === 0 ? LM.L_ANKLE : LM.R_ANKLE;
    const knee = i % 2 === 0 ? LM.L_KNEE : LM.R_KNEE;
    rig.modifier = (n) => {
      n[side].y = 0.76;
      n[knee].y = 0.62;
    };
    rig.frames(6);
  }
  rig.modifier = null;
  rig.frames(12);
  assert.ok(rig.analyzer.state.move > 0.55, `move=${rig.analyzer.state.move}`);
  assert.ok(rig.analyzer.state.stepRate > 1.2);
});

test('detects left and right straight punches', () => {
  const rig = new Rig();
  rig.calibrate();
  rig.events = [];

  rig.modifier = (n, w) => punchArm(n, w, 'left');
  rig.frames(3);
  rig.modifier = null;
  rig.frames(12);
  assert.ok(rig.events.some((e) => e.type === 'punch' && e.side === 'left'), JSON.stringify(rig.events));

  rig.events = [];
  rig.modifier = (n, w) => punchArm(n, w, 'right');
  rig.frames(3);
  rig.modifier = null;
  rig.frames(12);
  assert.ok(rig.events.some((e) => e.type === 'punch' && e.side === 'right'), JSON.stringify(rig.events));
});

test('double palm push fires the cannon and suppresses punches', () => {
  const rig = new Rig();
  rig.calibrate();
  rig.events = [];
  rig.modifier = (n, w) => {
    punchArm(n, w, 'left');
    punchArm(n, w, 'right');
  };
  rig.frames(6);
  rig.modifier = null;
  rig.frames(24);
  const types = rig.events.map((e) => e.type);
  assert.ok(types.includes('blast'), JSON.stringify(rig.events));
  assert.equal(types.filter((t) => t === 'punch').length, 0);
});

test('holding an extended fist cannot auto-repeat; a retracted fist can punch again at 15/30/60 Hz', () => {
  for (const hz of [15,30,60]) {
    const rig = new Rig(),dt=1/hz;
    rig.frames(hz*2,dt);rig.events=[];
    rig.modifier=(n,w)=>punchArm(n,w,'left');
    rig.frames(hz*3,dt);
    assert.equal(rig.events.filter(e=>e.type==='punch').length,1,`${hz} Hz held-arm repeats`);
    rig.modifier=null;rig.frames(hz,dt);
    rig.modifier=(n,w)=>punchArm(n,w,'left');rig.frames(Math.ceil(hz*.3),dt);
    assert.equal(rig.events.filter(e=>e.type==='punch').length,2,`${hz} Hz retraction did not rearm`);
  }
});

test('crossed arms engage the shield', () => {
  const rig = new Rig();
  rig.calibrate();
  rig.modifier = (n, w) => {
    n[LM.L_WRIST].x = 0.48; n[LM.L_WRIST].y = 0.52;
    n[LM.R_WRIST].x = 0.52; n[LM.R_WRIST].y = 0.52;
    w[LM.L_WRIST].x = -0.06; w[LM.L_WRIST].y = -0.05; w[LM.L_WRIST].z = -0.2;
    w[LM.R_WRIST].x = 0.06; w[LM.R_WRIST].y = -0.05; w[LM.R_WRIST].z = -0.2;
    w[LM.L_ELBOW].x = -0.3; w[LM.L_ELBOW].y = -0.2; w[LM.L_ELBOW].z = -0.02;
    w[LM.R_ELBOW].x = 0.3; w[LM.R_ELBOW].y = -0.2; w[LM.R_ELBOW].z = -0.02;
  };
  rig.frames(15);
  assert.equal(rig.analyzer.state.blocking, true);
  assert.equal(rig.analyzer.state.gesture, '装甲防御');
});

test('both hands overhead charge and fire the ultimate input', () => {
  const rig = new Rig();
  rig.calibrate();
  rig.events = [];
  rig.modifier = (n, w) => {
    n[LM.L_WRIST].x = 0.4; n[LM.L_WRIST].y = 0.05;
    n[LM.R_WRIST].x = 0.6; n[LM.R_WRIST].y = 0.05;
    w[LM.L_WRIST].x = -0.1; w[LM.L_WRIST].y = 0.5; w[LM.L_WRIST].z = 0;
    w[LM.R_WRIST].x = 0.1; w[LM.R_WRIST].y = 0.5; w[LM.R_WRIST].z = 0;
    w[LM.L_ELBOW].x = -0.08; w[LM.L_ELBOW].y = 0.25; w[LM.L_ELBOW].z = 0;
    w[LM.R_ELBOW].x = 0.08; w[LM.R_ELBOW].y = 0.25; w[LM.R_ELBOW].z = 0;
  };
  rig.frames(35);
  assert.ok(rig.events.some((e) => e.type === 'ultimate'), JSON.stringify(rig.events));
  assert.ok(!rig.events.some((e) => e.type === 'punch'));
});

test('fast lateral lean triggers a dodge', () => {
  const rig = new Rig();
  rig.calibrate();
  rig.events = [];
  rig.modifier = (n) => {
    for (const i of [LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_ELBOW, LM.R_ELBOW, LM.L_WRIST, LM.R_WRIST]) {
      n[i].x += 0.22;
    }
  };
  rig.frames(8);
  assert.ok(rig.events.some((e) => e.type === 'dodge'), JSON.stringify(rig.events));
  assert.ok(rig.analyzer.state.lean < -0.25);
});

function halfBodyModifier(n) {
  for (const i of [LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE]) {
    n[i].visibility = 0.02;
  }
}

function armsWide(n, w) {
  n[LM.L_ELBOW].x = 0.22; n[LM.L_ELBOW].y = 0.29;
  n[LM.R_ELBOW].x = 0.78; n[LM.R_ELBOW].y = 0.29;
  n[LM.L_WRIST].x = 0.1; n[LM.L_WRIST].y = 0.28;
  n[LM.R_WRIST].x = 0.9; n[LM.R_WRIST].y = 0.28;
  w[LM.L_WRIST].x = -0.42; w[LM.L_WRIST].y = 0.2; w[LM.L_WRIST].z = 0;
  w[LM.R_WRIST].x = 0.42; w[LM.R_WRIST].y = 0.2; w[LM.R_WRIST].z = 0;
  w[LM.L_ELBOW].x = -0.2; w[LM.L_ELBOW].y = 0.2; w[LM.L_ELBOW].z = 0;
  w[LM.R_ELBOW].x = 0.2; w[LM.R_ELBOW].y = 0.2; w[LM.R_ELBOW].z = 0;
}

test('half-body mode tracks with hips and legs out of frame', () => {
  const rig = new Rig();
  rig.modifier = halfBodyModifier;
  rig.calibrate();
  const st = rig.analyzer.state;
  assert.equal(st.visible, true);
  assert.equal(st.halfBody, true);
  assert.equal(st.fullBody, false);
  assert.ok(st.quality > 0.55, `quality=${st.quality}`);
  assert.ok(st.arms.left && st.arms.right);
});

test('half-body lateral shift strafes without needing stepping', () => {
  const rig = new Rig();
  rig.modifier = halfBodyModifier;
  rig.calibrate();
  rig.modifier = (n) => {
    halfBodyModifier(n);
    for (const i of [LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_ELBOW, LM.R_ELBOW, LM.L_WRIST, LM.R_WRIST]) {
      n[i].x += 0.16;
    }
  };
  rig.frames(10);
  assert.equal(rig.analyzer.state.halfBody, true);
  assert.ok(Math.abs(rig.analyzer.state.lean) > 0.25, `lean=${rig.analyzer.state.lean}`);
  assert.ok(Math.abs(rig.analyzer.state.strafe) > 0.3);
});

test('half-body punch still works without leg landmarks', () => {
  const rig = new Rig();
  rig.modifier = (n) => halfBodyModifier(n);
  rig.calibrate();
  rig.events = [];
  rig.modifier = (n, w) => { halfBodyModifier(n); punchArm(n, w, 'right'); };
  rig.frames(4);
  rig.modifier = halfBodyModifier;
  rig.frames(12);
  assert.ok(rig.events.some((e) => e.type === 'punch' && e.side === 'right'), JSON.stringify(rig.events));
});

test('arms spread wide fires the missile salvo gesture', () => {
  const rig = new Rig();
  rig.modifier = (n) => halfBodyModifier(n);
  rig.calibrate();
  rig.events = [];
  rig.modifier = (n, w) => { halfBodyModifier(n); armsWide(n, w); };
  rig.frames(16);
  const types = rig.events.map((e) => e.type);
  assert.ok(types.includes('missile'), JSON.stringify(rig.events));
  assert.ok(!types.includes('punch'), JSON.stringify(rig.events));
  assert.equal(rig.analyzer.state.activeParts.wide, true);
});

test('one arm held high fires the plasma blade without the ultimate', () => {
  const rig = new Rig();
  rig.modifier = (n) => halfBodyModifier(n);
  rig.calibrate();
  rig.events = [];
  rig.modifier = (n, w) => {
    halfBodyModifier(n);
    n[LM.L_ELBOW].x = 0.35; n[LM.L_ELBOW].y = 0.2;
    n[LM.L_WRIST].x = 0.37; n[LM.L_WRIST].y = 0.05;
    w[LM.L_ELBOW].x = -0.04; w[LM.L_ELBOW].y = 0.25; w[LM.L_ELBOW].z = 0;
    w[LM.L_WRIST].x = -0.04; w[LM.L_WRIST].y = 0.5; w[LM.L_WRIST].z = 0;
    n[LM.R_WRIST].x = 0.7; n[LM.R_WRIST].y = 0.58;
    w[LM.R_WRIST].x = 0.2; w[LM.R_WRIST].y = -0.2; w[LM.R_WRIST].z = 0;
  };
  rig.frames(18);
  const types = rig.events.map((e) => e.type);
  assert.ok(types.includes('blade'), JSON.stringify(rig.events));
  assert.ok(!types.includes('ultimate'), JSON.stringify(rig.events));
});
