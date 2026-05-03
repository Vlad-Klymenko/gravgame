import type { Body, Orbit } from "./types";
import { DENSITY, SHIP_RADIUS } from "./constants";

interface SolarBodySeed {
  x: number;
  y: number;
  radius: number;
  orbit?: Orbit;
}

const CENTRAL_PLANET_ID = 0;

const SOLAR_SYSTEM_SEEDS: SolarBodySeed[] = [
  { x: 0, y: 0, radius: 32000 },
  {
    x: 0,
    y: 0,
    radius: 2200,
    orbit: {
      centerBodyId: CENTRAL_PLANET_ID,
      distance: 95000,
      angle: -0.4,
      angularVelocity: 0.0019,
    },
  },
  {
    x: 0,
    y: 0,
    radius: 3800,
    orbit: {
      centerBodyId: CENTRAL_PLANET_ID,
      distance: 145000,
      angle: 1.35,
      angularVelocity: -0.00135,
    },
  },
  {
    x: 0,
    y: 0,
    radius: 1600,
    orbit: {
      centerBodyId: CENTRAL_PLANET_ID,
      distance: 210000,
      angle: 2.8,
      angularVelocity: 0.00105,
    },
  },
  {
    x: 0,
    y: 0,
    radius: 5200,
    orbit: {
      centerBodyId: CENTRAL_PLANET_ID,
      distance: 285000,
      angle: -2.2,
      angularVelocity: -0.00082,
    },
  },
  {
    x: 0,
    y: 0,
    radius: 2600,
    orbit: {
      centerBodyId: CENTRAL_PLANET_ID,
      distance: 380000,
      angle: 0.55,
      angularVelocity: 0.00062,
    },
  },
];

export function createSolarSystem(): Body[] {
  const bodies = SOLAR_SYSTEM_SEEDS.map((seed, index) =>
    createSeedBody(seed.x, seed.y, seed.radius, index, seed.orbit),
  );

  updateOrbitingBodies(bodies, 0);
  return bodies;
}

export function getStartingShipPosition(): {
  x: number;
  y: number;
  vx: number;
  vy: number;
  landedOnBodyId: number;
} {
  const bodies = createSolarSystem();
  const startingMoon = bodies[1];
  const centralPlanet = bodies[CENTRAL_PLANET_ID];
  const dx = startingMoon.x - centralPlanet.x;
  const dy = startingMoon.y - centralPlanet.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const normalX = dx / dist;
  const normalY = dy / dist;
  const surfaceDistance = startingMoon.radius + SHIP_RADIUS;

  return {
    x: startingMoon.x + normalX * surfaceDistance,
    y: startingMoon.y + normalY * surfaceDistance,
    vx: startingMoon.vx,
    vy: startingMoon.vy,
    landedOnBodyId: startingMoon.id,
  };
}

export function getNextSolarSystemBodyId(): number {
  return SOLAR_SYSTEM_SEEDS.length;
}

export function updateOrbitingBodies(bodies: Body[], deltaTime: number): void {
  for (const body of bodies) {
    if (!body.orbit) continue;

    const center = bodies.find((candidate) => candidate.id === body.orbit?.centerBodyId);
    if (!center) continue;

    body.orbit.angle += body.orbit.angularVelocity * deltaTime;
    body.x = center.x + Math.cos(body.orbit.angle) * body.orbit.distance;
    body.y = center.y + Math.sin(body.orbit.angle) * body.orbit.distance;
    body.vx =
      -Math.sin(body.orbit.angle) *
      body.orbit.distance *
      body.orbit.angularVelocity;
    body.vy =
      Math.cos(body.orbit.angle) *
      body.orbit.distance *
      body.orbit.angularVelocity;
  }
}

function createSeedBody(
  x: number,
  y: number,
  radius: number,
  id: number,
  orbit?: Orbit,
): Body {
  const area = Math.PI * radius * radius;

  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    radius,
    mass: area * DENSITY,
    orbit: orbit ? { ...orbit } : undefined,
  };
}
