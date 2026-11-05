import * as THREE from 'three';

// Closest points on two finite segments, including parallel and zero-length cases.
export function closestSegments(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), epsilon = 1e-9;
  let s = 0, t = 0;
  if (a <= epsilon && e <= epsilon) return { a: p1.clone(), b: p2.clone(), distanceSq: r.lengthSq() };
  if (a <= epsilon) t = THREE.MathUtils.clamp(f / e, 0, 1);
  else {
    const c = d1.dot(r);
    if (e <= epsilon) s = THREE.MathUtils.clamp(-c / a, 0, 1);
    else {
      const b = d1.dot(d2), denominator = a * e - b * b;
      if (denominator > epsilon) s = THREE.MathUtils.clamp((b * f - c * e) / denominator, 0, 1);
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
    }
  }
  const first = p1.clone().addScaledVector(d1, s), second = p2.clone().addScaledVector(d2, t);
  return { a: first, b: second, distanceSq: first.distanceToSquared(second) };
}

export function bodyCapsules(actor) {
  const p = key => actor.imported.bones[key].getWorldPosition(new THREE.Vector3());
  actor.root.updateMatrixWorld(true);
  const mech = actor.imported.kind === 'mech';
  return [
    { id: 'torso', a: p('hips'), b: p('torso1'), radius: mech ? 2.7 : 3.5 },
    { id: 'head', a: p('head'), b: p('head'), radius: mech ? 1.35 : 2.1 },
    ...['l','r'].map(side => ({ id: `shoulder_${side}`, a: p(`upperarm${side}`), b: p(`lowerarm${side}`), radius: mech ? 1.45 : 1.9 })),
    ...['l','r'].map(side => ({ id: `leg_${side}`, a: p(`thigh${side}`), b: p(`calf${side}`), radius: mech ? 1.5 : 2.2 })),
  ];
}

// Sample both weapon and moving hurt capsules over this simulation step. Sampling
// density follows travel distance: rapid blades cannot skip a thin target.
export function sweepWeapon(previous, current, radius, bodies, previousBodies = bodies) {
  const travel = previous.a.distanceTo(current.a) + previous.b.distanceTo(current.b);
  // Discontinuities (teleport / new action) must not create an invisible long hit.
  if (travel > 45) previous = current;
  const bodyTravel = bodies.reduce((max, body) => {
    const old = previousBodies.find(b => b.id === body.id) || body;
    return Math.max(max, old.a.distanceTo(body.a), old.b.distanceTo(body.b));
  }, 0);
  const steps = Math.min(48, Math.max(1, Math.ceil(Math.min(travel + bodyTravel, 45) / Math.max(.35, radius))));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, wa = previous.a.clone().lerp(current.a, t), wb = previous.b.clone().lerp(current.b, t);
    for (const body of bodies) {
      const old = previousBodies.find(b => b.id === body.id) || body;
      const hit = closestSegments(wa, wb, old.a.clone().lerp(body.a, t), old.b.clone().lerp(body.b, t));
      if (hit.distanceSq <= (radius + body.radius) ** 2) {
        const normal = hit.a.clone().sub(hit.b).normalize();
        return { point: hit.b.clone().addScaledVector(normal, body.radius), normal, part: body.id };
      }
    }
  }
  return null;
}

// The same endpoints drive rendering, trails, city contact and hit detection.
export function weaponSegment(actor, side, blade = false) {
  const a = actor.getFistWorld(side, new THREE.Vector3());
  if (!blade) return { a, b: a.clone() };
  const mesh = side === 'left' ? actor.weaponRig.leftBlade : actor.weaponRig.group;
  mesh.updateWorldMatrix(true, false);
  return { a, b: mesh.localToWorld(new THREE.Vector3(0, 0, 10.5)) };
}
