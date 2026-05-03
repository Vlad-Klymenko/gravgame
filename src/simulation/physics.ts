import type { Body, Projectile, SimulationState } from "./types";
import {
  GRAVITATIONAL_CONSTANT,
  SOFTENING_DISTANCE,
  MAX_DELTA_TIME,
  DENSITY,
  LANDED_BODY_MIN_RADIUS_RATIO,
  SHIP_FUEL_REGEN_DELAY,
  SHIP_FUEL_REGEN_RATE,
  SHIP_GRAVITY_SCALE,
  SHIP_MAX_FUEL,
  SHIP_MASS,
  PROJECTILE_GRAVITY_SCALE,
  PROJECTILE_MASS_RATIO,
  PROJECTILE_MAX_AGE,
  PROJECTILE_RADIUS,
  PROJECTILE_SPEED,
  SAFE_LANDING_RELATIVE_SPEED,
  SHIP_RADIUS,
  SHIP_ROTATION_SPEED,
  SHIP_TAKEOFF_EXTRA_SPEED,
  SHIP_TAKEOFF_GRACE_TIME,
  SHIP_TAKEOFF_MAX_THRUST_MULTIPLIER,
  SHIP_TAKEOFF_MIN_THRUST_MULTIPLIER,
  SHIP_THRUST_ACCELERATION,
} from "./constants";
import { createCamera } from "./camera";
import {
  createSolarSystem,
  getStartingShipPosition,
  getNextSolarSystemBodyId,
  updateOrbitingBodies,
} from "./solarSystem";
import { createInitialMission, updateMissionForLanding } from "./mission";

export function updatePhysics(
  state: SimulationState,
  deltaTime: number,
): void {
  if (state.isPaused) return;

  let remainingTime = Math.min(deltaTime, MAX_DELTA_TIME * 24);

  while (remainingTime > 0) {
    const dt = Math.min(remainingTime, MAX_DELTA_TIME);
    stepPhysics(state, dt);
    remainingTime -= dt;
  }
}

function stepPhysics(
  state: SimulationState,
  dt: number,
): void {
  if (state.lastLanding) {
    state.lastLanding.elapsed += dt;
  }

  updateOrbitingBodies(state.bodies, dt);
  updateShip(state, dt);
  updateProjectiles(state, dt);

  // Check collisions
  checkCollisions(state);
}

function updateShip(
  state: SimulationState,
  dt: number,
): void {
  const ship = state.ship;
  const controls = state.shipControls;
  const canBurn = controls.burn && ship.fuel > 0;

  ship.takeoffGraceTime = Math.max(0, ship.takeoffGraceTime - dt);
  updateShipFuel(ship, canBurn, dt);

  if (controls.rotateLeft) {
    ship.angle -= SHIP_ROTATION_SPEED * dt;
  }

  if (controls.rotateRight) {
    ship.angle += SHIP_ROTATION_SPEED * dt;
  }

  const landedBody = state.bodies.find((b) => b.id === ship.landedOnBodyId);
  if (landedBody && !canBurn) {
    keepShipOnSurface(ship, landedBody);
    return;
  }

  const wasLanded = Boolean(landedBody && canBurn);
  if (landedBody && canBurn) {
    launchFromSurface(ship, landedBody);
  }

  if (canBurn) {
    const thrust = wasLanded || ship.takeoffGraceTime > 0
      ? SHIP_THRUST_ACCELERATION * ship.takeoffThrustMultiplier
      : SHIP_THRUST_ACCELERATION;
    integrateShipMotion(state, dt, thrust);
  } else {
    integrateShipMotion(state, dt, 0);
  }

  for (const body of state.bodies) {
    const dx = body.x - ship.x;
    const dy = body.y - ship.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < body.radius + ship.radius) {
      resolveShipBodyContact(
        state,
        ship,
        body,
        dist,
        dx,
        dy,
        !canBurn && ship.takeoffGraceTime <= 0,
      );
    }
  }
}

function integrateShipMotion(
  state: SimulationState,
  dt: number,
  thrust: number,
): void {
  const ship = state.ship;
  const thrustAx = Math.cos(ship.angle) * thrust;
  const thrustAy = Math.sin(ship.angle) * thrust;
  const startGravity = calculateShipGravityAcceleration(
    ship.x,
    ship.y,
    state.bodies,
  );
  const startAx = startGravity.ax + thrustAx;
  const startAy = startGravity.ay + thrustAy;

  ship.x += ship.vx * dt + 0.5 * startAx * dt * dt;
  ship.y += ship.vy * dt + 0.5 * startAy * dt * dt;

  const endGravity = calculateShipGravityAcceleration(
    ship.x,
    ship.y,
    state.bodies,
  );
  const endAx = endGravity.ax + thrustAx;
  const endAy = endGravity.ay + thrustAy;

  ship.vx += 0.5 * (startAx + endAx) * dt;
  ship.vy += 0.5 * (startAy + endAy) * dt;
}

function calculateShipGravityAcceleration(
  x: number,
  y: number,
  bodies: Body[],
): { ax: number; ay: number } {
  let ax = 0;
  let ay = 0;

  for (const body of bodies) {
    const dx = body.x - x;
    const dy = body.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const distWithSoftening = Math.max(dist, SOFTENING_DISTANCE);
    const acceleration =
      (GRAVITATIONAL_CONSTANT * body.mass * SHIP_GRAVITY_SCALE) /
      (distWithSoftening * distWithSoftening);
    const angle = Math.atan2(dy, dx);

    ax += Math.cos(angle) * acceleration;
    ay += Math.sin(angle) * acceleration;
  }

  return { ax, ay };
}

function updateShipFuel(
  ship: SimulationState["ship"],
  isBurning: boolean,
  dt: number,
): void {
  ship.isBurning = isBurning;

  if (isBurning) {
    ship.fuel = Math.max(0, ship.fuel - dt);
    ship.burnCooldown = SHIP_FUEL_REGEN_DELAY;
    return;
  }

  ship.burnCooldown = Math.max(0, ship.burnCooldown - dt);

  if (ship.burnCooldown === 0 && ship.fuel < SHIP_MAX_FUEL) {
    ship.fuel = Math.min(SHIP_MAX_FUEL, ship.fuel + SHIP_FUEL_REGEN_RATE * dt);
  }
}

function launchFromSurface(
  ship: SimulationState["ship"],
  body: Body,
): void {
  const dx = ship.x - body.x;
  const dy = ship.y - body.y;
  const angle = Math.atan2(dy, dx);
  const normalX = Math.cos(angle);
  const normalY = Math.sin(angle);
  const heavyBodyPenalty = Math.min(1, body.radius / 6500);
  const surfaceDistance = Math.max(
    body.radius + ship.radius,
    SOFTENING_DISTANCE,
  );
  const surfaceGravity =
    (GRAVITATIONAL_CONSTANT * body.mass * SHIP_GRAVITY_SCALE) /
    (surfaceDistance * surfaceDistance);
  const requiredLiftMultiplier = surfaceGravity / SHIP_THRUST_ACCELERATION;
  const takeoffMargin =
    SHIP_TAKEOFF_MAX_THRUST_MULTIPLIER -
    (SHIP_TAKEOFF_MAX_THRUST_MULTIPLIER -
      SHIP_TAKEOFF_MIN_THRUST_MULTIPLIER) *
      heavyBodyPenalty;
  const takeoffSpeed =
    SHIP_TAKEOFF_EXTRA_SPEED * (1 - heavyBodyPenalty * 0.55);

  ship.x = body.x + normalX * (body.radius + ship.radius + 1);
  ship.y = body.y + normalY * (body.radius + ship.radius + 1);
  ship.vx = body.vx + normalX * takeoffSpeed;
  ship.vy = body.vy + normalY * takeoffSpeed;
  ship.angle = angle;
  ship.landedOnBodyId = null;
  ship.takeoffGraceTime = SHIP_TAKEOFF_GRACE_TIME;
  ship.takeoffThrustMultiplier = requiredLiftMultiplier + takeoffMargin;
}

function keepShipOnSurface(
  ship: SimulationState["ship"],
  body: Body,
): void {
  const dx = ship.x - body.x;
  const dy = ship.y - body.y;
  const angle = Math.atan2(dy, dx);
  const surfaceDistance = body.radius + ship.radius;

  ship.x = body.x + Math.cos(angle) * surfaceDistance;
  ship.y = body.y + Math.sin(angle) * surfaceDistance;
  ship.vx = body.vx;
  ship.vy = body.vy;
  ship.angle = angle;
}

function updateProjectiles(
  state: SimulationState,
  dt: number,
): void {
  const projectilesToRemove = new Set<number>();

  for (const projectile of state.projectiles) {
    projectile.age += dt;

    for (const body of state.bodies) {
      const dx = body.x - projectile.x;
      const dy = body.y - projectile.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const distWithSoftening = Math.max(dist, SOFTENING_DISTANCE);
      const force =
        (GRAVITATIONAL_CONSTANT * body.mass * PROJECTILE_GRAVITY_SCALE) /
        (distWithSoftening * distWithSoftening);
      const angle = Math.atan2(dy, dx);

      projectile.vx += Math.cos(angle) * force * dt;
      projectile.vy += Math.sin(angle) * force * dt;

      if (dist < body.radius + projectile.radius) {
        absorbProjectile(body, projectile);
        projectilesToRemove.add(projectile.id);
        break;
      }
    }

    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;

    if (
      projectile.age > PROJECTILE_MAX_AGE
    ) {
      projectilesToRemove.add(projectile.id);
    }
  }

  state.projectiles = state.projectiles.filter(
    (projectile) => !projectilesToRemove.has(projectile.id),
  );
}

function absorbProjectile(body: Body, projectile: Projectile): void {
  const combinedMass = body.mass + projectile.mass;

  body.vx = (body.vx * body.mass + projectile.vx * projectile.mass) / combinedMass;
  body.vy = (body.vy * body.mass + projectile.vy * projectile.mass) / combinedMass;
  body.mass = combinedMass;
}

function resolveShipBodyContact(
  state: SimulationState,
  ship: SimulationState["ship"],
  body: Body,
  dist: number,
  dx: number,
  dy: number,
  allowLanding: boolean,
): void {
  const canLand = body.radius >= ship.radius * LANDED_BODY_MIN_RADIUS_RATIO;
  const normalX = dist > 0 ? -dx / dist : Math.cos(ship.angle);
  const normalY = dist > 0 ? -dy / dist : Math.sin(ship.angle);
  const surfaceDistance = body.radius + ship.radius;

  ship.x = body.x + normalX * surfaceDistance;
  ship.y = body.y + normalY * surfaceDistance;

  const relativeVx = ship.vx - body.vx;
  const relativeVy = ship.vy - body.vy;
  const relativeSpeed = Math.sqrt(relativeVx * relativeVx + relativeVy * relativeVy);
  const velocityIntoSurface = relativeVx * normalX + relativeVy * normalY;
  if (velocityIntoSurface < 0) {
    ship.vx -= velocityIntoSurface * normalX;
    ship.vy -= velocityIntoSurface * normalY;
  }

  if (allowLanding && canLand) {
    const safe = relativeSpeed <= SAFE_LANDING_RELATIVE_SPEED;
    ship.vx = body.vx;
    ship.vy = body.vy;
    ship.angle = Math.atan2(normalY, normalX);
    ship.landedOnBodyId = body.id;
    state.lastLanding = {
      bodyId: body.id,
      relativeSpeed,
      safe,
      elapsed: 0,
    };
    updateMissionForLanding(state, body.id, safe);
    return;
  }
}

function checkCollisions(state: SimulationState): void {
  const bodies = state.bodies;
  const toRemove: number[] = [];

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.radius + b.radius;
      const overlap = minDist - dist;

      if (overlap > 0) {
        // Determine which is smaller
        const [smaller, larger] = a.radius < b.radius ? [a, b] : [b, a];
        const smallerRadius = smaller.radius;

        // Merge if 60% or more of smaller object intersects with larger
        if (overlap >= 0.6 * smallerRadius) {
          mergeBodies(a, b, larger);
          toRemove.push(smaller.id);
        }
      }
    }
  }

  // Remove merged bodies
  state.bodies = bodies.filter((b) => !toRemove.includes(b.id));
}

function mergeBodies(a: Body, b: Body, survivor: Body): void {
  const combinedMass = a.mass + b.mass;
  const combinedVx = (a.vx * a.mass + b.vx * b.mass) / combinedMass;
  const combinedVy = (a.vy * a.mass + b.vy * b.mass) / combinedMass;

  // New radius from combined mass (preserves volume/area)
  const combinedArea = a.radius * a.radius + b.radius * b.radius;
  const newRadius = Math.sqrt(combinedArea);

  // Update survivor with merged properties
  survivor.x = (a.x * a.mass + b.x * b.mass) / combinedMass;
  survivor.y = (a.y * a.mass + b.y * b.mass) / combinedMass;
  survivor.vx = combinedVx;
  survivor.vy = combinedVy;
  survivor.mass = combinedMass;
  survivor.radius = newRadius;
}

export function createBody(
  x: number,
  y: number,
  radius: number,
  nextBodyId: number,
  vx: number = 0,
  vy: number = 0,
): Body {
  // Mass proportional to area (πr²)
  const area = Math.PI * radius * radius;
  const mass = area * DENSITY;

  return {
    id: nextBodyId,
    x,
    y,
    vx,
    vy,
    radius,
    mass,
  };
}

export function createShip(
  x: number,
  y: number,
  vx = 0,
  vy = 0,
  landedOnBodyId: number | null = null,
): SimulationState["ship"] {
  return {
    x,
    y,
    vx,
    vy,
    angle: -Math.PI / 2,
    radius: SHIP_RADIUS,
    mass: SHIP_MASS,
    isBurning: false,
    landedOnBodyId,
    takeoffGraceTime: 0,
    takeoffThrustMultiplier: SHIP_TAKEOFF_MIN_THRUST_MULTIPLIER,
    fuel: SHIP_MAX_FUEL,
    burnCooldown: 0,
  };
}

export function fireProjectile(state: SimulationState): void {
  const ship = state.ship;
  const directionX = Math.cos(ship.angle);
  const directionY = Math.sin(ship.angle);
  const startDistance = ship.radius * 1.8 + PROJECTILE_RADIUS;

  state.projectiles.push({
    id: state.nextProjectileId,
    x: ship.x + directionX * startDistance,
    y: ship.y + directionY * startDistance,
    vx: ship.vx + directionX * PROJECTILE_SPEED,
    vy: ship.vy + directionY * PROJECTILE_SPEED,
    radius: PROJECTILE_RADIUS,
    mass: ship.mass * PROJECTILE_MASS_RATIO,
    age: 0,
  });
  state.nextProjectileId++;
}

export function calculateOrbitalVelocity(
  orbiterX: number,
  orbiterY: number,
  centerBody: Body,
): { vx: number; vy: number; magnitude: number } {
  const dx = centerBody.x - orbiterX;
  const dy = centerBody.y - orbiterY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < SOFTENING_DISTANCE) {
    return { vx: 0, vy: 0, magnitude: 0 };
  }

  // v = sqrt(G * M / r)
  const velocityMagnitude = Math.sqrt(
    (GRAVITATIONAL_CONSTANT * centerBody.mass) / dist,
  );

  // Perpendicular direction (90 degrees counterclockwise from radial)
  const normalizeX = dx / dist;
  const normalizeY = dy / dist;
  const tangentX = -normalizeY;
  const tangentY = normalizeX;

  return {
    vx: tangentX * velocityMagnitude,
    vy: tangentY * velocityMagnitude,
    magnitude: velocityMagnitude,
  };
}

export function findNearestBody(
  x: number,
  y: number,
  bodies: Body[],
): Body | null {
  let nearest: Body | null = null;
  let minDist = Infinity;

  for (const body of bodies) {
    const dx = body.x - x;
    const dy = body.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = body;
    }
  }

  return nearest;
}

export function removeBody(state: SimulationState, bodyId: number): void {
  state.bodies = state.bodies.filter((b) => b.id !== bodyId);
}

export function clearAllBodies(state: SimulationState): void {
  const start = getStartingShipPosition();

  state.bodies = createSolarSystem();
  state.previewBody = null;
  state.projectiles = [];
  state.nextBodyId = getNextSolarSystemBodyId();
  state.nextProjectileId = 0;
  state.ship = createShip(start.x, start.y, start.vx, start.vy, start.landedOnBodyId);
  state.shipControls.burn = false;
  state.shipControls.rotateLeft = false;
  state.shipControls.rotateRight = false;
  state.camera = createCamera(start.x, start.y);
  state.timeScale = 1;
  state.trajectoryCache.points = [];
  state.trajectoryCache.closestApproach = null;
  state.trajectoryCache.elapsed = 0;
  state.trajectoryCache.signature = "";
  state.mission = createInitialMission();
  state.lastLanding = null;
}
