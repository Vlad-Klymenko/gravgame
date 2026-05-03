import type {
  Body,
  ClosestApproach,
  SimulationState,
  TrajectoryPoint,
} from "./types";
import {
  CONIC_ELLIPSE_SAMPLES,
  CONIC_HYPERBOLA_SAMPLES,
  CONIC_MAX_HYPERBOLA_SWEEP,
  GRAVITATIONAL_CONSTANT,
  SHIP_GRAVITY_SCALE,
  TRAJECTORY_CLOSED_ORBIT_MIN_STEPS,
  TRAJECTORY_CLOSED_ORBIT_POSITION_TOLERANCE,
  TRAJECTORY_CLOSED_ORBIT_VELOCITY_TOLERANCE,
  TRAJECTORY_FALLBACK_STEPS,
  TRAJECTORY_SAMPLE_INTERVAL,
  TRAJECTORY_STEP_TIME,
} from "./constants";
import { findDominantGravityBody, updatePhysics } from "./physics";
import { getMissionTargetId } from "./mission";

export interface TrajectoryPrediction {
  points: TrajectoryPoint[];
  closestApproach: ClosestApproach | null;
  referenceBodyId: number | null;
}

export function calculateTrajectoryPrediction(
  state: SimulationState,
): TrajectoryPrediction {
  const referenceBodyId = selectTrajectoryReferenceBodyId(state);

  if (state.ship.landedOnBodyId !== null && !state.ship.isBurning) {
    return {
      points: [],
      closestApproach: null,
      referenceBodyId,
    };
  }

  const conicPrediction = calculateConicTrajectoryPrediction(state);
  if (conicPrediction) return conicPrediction;

  return calculateSimulatedTrajectoryPrediction(state, referenceBodyId);
}

function calculateSimulatedTrajectoryPrediction(
  state: SimulationState,
  referenceBodyId: number | null,
): TrajectoryPrediction {
  const predictedState = cloneStateForCoastPrediction(state);
  const initialReferenceBody = getReferenceBody(
    predictedState.bodies,
    referenceBodyId,
  );
  const initialRelativeState = initialReferenceBody
    ? getRelativeShipState(predictedState, initialReferenceBody)
    : null;
  const points: TrajectoryPoint[] = [];
  const targetId = getMissionTargetId(state.mission);
  let closestApproach: ClosestApproach | null = null;

  for (let i = 0; i < TRAJECTORY_FALLBACK_STEPS; i++) {
    const previousLandingId = predictedState.ship.landedOnBodyId;
    updatePhysics(predictedState, TRAJECTORY_STEP_TIME);

    if (i % TRAJECTORY_SAMPLE_INTERVAL === 0) {
      const referenceBody = getReferenceBody(predictedState.bodies, referenceBodyId);

      points.push({
        x: predictedState.ship.x,
        y: predictedState.ship.y,
        referenceX: referenceBody?.x ?? 0,
        referenceY: referenceBody?.y ?? 0,
      });
      closestApproach = updateClosestApproach(
        closestApproach,
        predictedState.ship.x,
        predictedState.ship.y,
        predictedState.bodies,
        targetId,
        referenceBodyId,
        predictedState.ship.radius,
      );
    }

    if (
      predictedState.ship.landedOnBodyId !== null &&
      predictedState.ship.landedOnBodyId !== state.ship.landedOnBodyId &&
      predictedState.ship.landedOnBodyId !== previousLandingId
    ) {
      break;
    }

    if (
      i > TRAJECTORY_CLOSED_ORBIT_MIN_STEPS &&
      i % TRAJECTORY_SAMPLE_INTERVAL === 0 &&
      isClosedOrbitLoop(
        predictedState,
        referenceBodyId,
        initialRelativeState,
      )
    ) {
      break;
    }
  }

  return { points, closestApproach, referenceBodyId };
}

function calculateConicTrajectoryPrediction(
  state: SimulationState,
): TrajectoryPrediction | null {
  if (state.ship.landedOnBodyId !== null || state.ship.takeoffGraceTime > 0) {
    return null;
  }

  const referenceBodyId = selectTrajectoryReferenceBodyId(state);
  const referenceBody = getReferenceBody(state.bodies, referenceBodyId);
  if (!referenceBody) return null;

  const relativeX = state.ship.x - referenceBody.x;
  const relativeY = state.ship.y - referenceBody.y;
  const relativeVx = state.ship.vx - referenceBody.vx;
  const relativeVy = state.ship.vy - referenceBody.vy;
  const radius = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
  const speedSq = relativeVx * relativeVx + relativeVy * relativeVy;
  const mu = GRAVITATIONAL_CONSTANT * referenceBody.mass * SHIP_GRAVITY_SCALE;
  const h = relativeX * relativeVy - relativeY * relativeVx;

  if (radius <= 0 || mu <= 0 || Math.abs(h) < 0.0001) return null;

  const eccentricityVectorX = (h * relativeVy) / mu - relativeX / radius;
  const eccentricityVectorY = (-h * relativeVx) / mu - relativeY / radius;
  const eccentricity = Math.sqrt(
    eccentricityVectorX * eccentricityVectorX +
      eccentricityVectorY * eccentricityVectorY,
  );
  const semiLatusRectum = (h * h) / mu;
  const orbitEnergy = speedSq / 2 - mu / radius;

  if (!Number.isFinite(semiLatusRectum) || semiLatusRectum <= 0) return null;

  const periapsisUnit =
    eccentricity > 0.0001
      ? {
          x: eccentricityVectorX / eccentricity,
          y: eccentricityVectorY / eccentricity,
        }
      : {
          x: relativeX / radius,
          y: relativeY / radius,
        };
  const direction = h >= 0 ? 1 : -1;
  const sideUnit = {
    x: -periapsisUnit.y * direction,
    y: periapsisUnit.x * direction,
  };
  const currentTrueAnomaly = Math.atan2(
    relativeX * sideUnit.x + relativeY * sideUnit.y,
    relativeX * periapsisUnit.x + relativeY * periapsisUnit.y,
  );
  const points =
    eccentricity < 1 && orbitEnergy < 0
      ? sampleEllipseConic(
          referenceBody,
          semiLatusRectum,
          eccentricity,
          periapsisUnit,
          sideUnit,
          currentTrueAnomaly,
        )
      : sampleHyperbolaConic(
          referenceBody,
          semiLatusRectum,
          eccentricity,
          periapsisUnit,
          sideUnit,
          currentTrueAnomaly,
        );

  if (points.length < 2) return null;

  return {
    points,
    closestApproach: findClosestApproachFromConicPoints(
      points,
      state,
      referenceBodyId,
    ),
    referenceBodyId,
  };
}

function sampleEllipseConic(
  referenceBody: Body,
  semiLatusRectum: number,
  eccentricity: number,
  periapsisUnit: { x: number; y: number },
  sideUnit: { x: number; y: number },
  currentTrueAnomaly: number,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];

  for (let i = 0; i <= CONIC_ELLIPSE_SAMPLES; i++) {
    const trueAnomaly =
      currentTrueAnomaly + (i / CONIC_ELLIPSE_SAMPLES) * Math.PI * 2;
    const orbitalRadius =
      semiLatusRectum / (1 + eccentricity * Math.cos(trueAnomaly));

    if (orbitalRadius <= 0 || !Number.isFinite(orbitalRadius)) continue;

    points.push(
      createConicPoint(
        referenceBody,
        orbitalRadius,
        trueAnomaly,
        periapsisUnit,
        sideUnit,
      ),
    );
  }

  return points;
}

function sampleHyperbolaConic(
  referenceBody: Body,
  semiLatusRectum: number,
  eccentricity: number,
  periapsisUnit: { x: number; y: number },
  sideUnit: { x: number; y: number },
  currentTrueAnomaly: number,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const asymptote =
    eccentricity > 1 ? Math.acos(-1 / eccentricity) : Math.PI * 0.96;
  const start = clamp(currentTrueAnomaly, -asymptote + 0.001, asymptote - 0.001);
  const end = Math.min(asymptote - 0.001, start + CONIC_MAX_HYPERBOLA_SWEEP);

  for (let i = 0; i <= CONIC_HYPERBOLA_SAMPLES; i++) {
    const trueAnomaly = start + ((end - start) * i) / CONIC_HYPERBOLA_SAMPLES;
    const denominator = 1 + eccentricity * Math.cos(trueAnomaly);
    if (denominator <= 0.001) continue;

    const orbitalRadius = semiLatusRectum / denominator;
    if (orbitalRadius <= 0 || !Number.isFinite(orbitalRadius)) continue;

    points.push(
      createConicPoint(
        referenceBody,
        orbitalRadius,
        trueAnomaly,
        periapsisUnit,
        sideUnit,
      ),
    );
  }

  return points;
}

function createConicPoint(
  referenceBody: Body,
  orbitalRadius: number,
  trueAnomaly: number,
  periapsisUnit: { x: number; y: number },
  sideUnit: { x: number; y: number },
): TrajectoryPoint {
  const offsetX =
    orbitalRadius *
    (Math.cos(trueAnomaly) * periapsisUnit.x +
      Math.sin(trueAnomaly) * sideUnit.x);
  const offsetY =
    orbitalRadius *
    (Math.cos(trueAnomaly) * periapsisUnit.y +
      Math.sin(trueAnomaly) * sideUnit.y);

  return {
    x: referenceBody.x + offsetX,
    y: referenceBody.y + offsetY,
    referenceX: referenceBody.x,
    referenceY: referenceBody.y,
  };
}

function findClosestApproachFromConicPoints(
  points: TrajectoryPoint[],
  state: SimulationState,
  referenceBodyId: number | null,
): ClosestApproach | null {
  const target = state.bodies.find((body) => body.id === getMissionTargetId(state.mission));
  const referenceBody = getReferenceBody(state.bodies, referenceBodyId);
  if (!target) return null;

  let closest: ClosestApproach | null = null;

  for (const point of points) {
    const distance = Math.max(
      0,
      getDistance(point.x, point.y, target.x, target.y) -
        target.radius -
        state.ship.radius,
    );

    if (closest && closest.distance <= distance) continue;

    closest = {
      trajectoryX: point.x,
      trajectoryY: point.y,
      targetX: target.x,
      targetY: target.y,
      referenceX: referenceBody?.x ?? 0,
      referenceY: referenceBody?.y ?? 0,
      distance,
    };
  }

  return closest;
}

interface RelativeShipState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function selectTrajectoryReferenceBodyId(
  state: SimulationState,
): number | null {
  if (state.ship.landedOnBodyId !== null) {
    return state.ship.landedOnBodyId;
  }

  return findDominantGravityBody(
    state.ship.x,
    state.ship.y,
    state.bodies,
  )?.id ?? null;
}

export function createTrajectorySignature(state: SimulationState): string {
  const ship = state.ship;
  const bodySignature = state.bodies
    .map(
      (body) =>
        `${body.id}:${roundForSignature(body.x, 100)}:${roundForSignature(
          body.y,
          100,
        )}:${roundForSignature(body.radius, 1)}:${roundForSignature(
          body.vx,
          4,
        )}:${roundForSignature(body.vy, 4)}`,
    )
    .join(",");

  return [
    roundForSignature(ship.x, 20),
    roundForSignature(ship.y, 20),
    roundForSignature(ship.vx, 2),
    roundForSignature(ship.vy, 2),
    state.ship.landedOnBodyId ?? "free",
    getMissionTargetId(state.mission),
    bodySignature,
  ].join("|");
}

function cloneStateForCoastPrediction(state: SimulationState): SimulationState {
  return {
    bodies: state.bodies.map(cloneBody),
    isPaused: false,
    timeScale: 1,
    fps: state.fps,
    previewBody: state.previewBody ? { ...state.previewBody } : null,
    nextBodyId: state.nextBodyId,
    ship: {
      ...state.ship,
      isBurning: false,
    },
    shipControls: {
      burn: false,
      rotateLeft: false,
      rotateRight: false,
    },
    camera: { ...state.camera },
    projectiles: state.projectiles.map((projectile) => ({ ...projectile })),
    nextProjectileId: state.nextProjectileId,
    trajectoryCache: {
      points: [],
      closestApproach: null,
      elapsed: 0,
      signature: "",
    },
    mission: { ...state.mission },
    lastLanding: state.lastLanding ? { ...state.lastLanding } : null,
  };
}

function cloneBody(body: Body): Body {
  return {
    ...body,
    orbit: body.orbit ? { ...body.orbit } : undefined,
  };
}

function updateClosestApproach(
  current: ClosestApproach | null,
  shipX: number,
  shipY: number,
  bodies: Body[],
  targetId: number,
  referenceBodyId: number | null,
  shipRadius: number,
): ClosestApproach | null {
  const target = bodies.find((body) => body.id === targetId);
  if (!target) return current;

  const referenceBody = getReferenceBody(bodies, referenceBodyId);
  const distance = Math.max(
    0,
    getDistance(shipX, shipY, target.x, target.y) - target.radius - shipRadius,
  );

  if (current && current.distance <= distance) return current;

  return {
    trajectoryX: shipX,
    trajectoryY: shipY,
    targetX: target.x,
    targetY: target.y,
    referenceX: referenceBody?.x ?? 0,
    referenceY: referenceBody?.y ?? 0,
    distance,
  };
}

function getReferenceBody(
  bodies: Body[],
  referenceBodyId: number | null,
): Body | null {
  if (referenceBodyId === null) return null;
  return bodies.find((body) => body.id === referenceBodyId) ?? null;
}

function isClosedOrbitLoop(
  state: SimulationState,
  referenceBodyId: number | null,
  initialRelativeState: RelativeShipState | null,
): boolean {
  if (!initialRelativeState) return false;

  const referenceBody = getReferenceBody(state.bodies, referenceBodyId);
  if (!referenceBody) return false;

  const currentRelativeState = getRelativeShipState(state, referenceBody);
  const positionDelta = getDistance(
    currentRelativeState.x,
    currentRelativeState.y,
    initialRelativeState.x,
    initialRelativeState.y,
  );
  const velocityDelta = getDistance(
    currentRelativeState.vx,
    currentRelativeState.vy,
    initialRelativeState.vx,
    initialRelativeState.vy,
  );

  return (
    positionDelta <= TRAJECTORY_CLOSED_ORBIT_POSITION_TOLERANCE &&
    velocityDelta <= TRAJECTORY_CLOSED_ORBIT_VELOCITY_TOLERANCE
  );
}

function getRelativeShipState(
  state: SimulationState,
  referenceBody: Body,
): RelativeShipState {
  return {
    x: state.ship.x - referenceBody.x,
    y: state.ship.y - referenceBody.y,
    vx: state.ship.vx - referenceBody.vx,
    vy: state.ship.vy - referenceBody.vy,
  };
}

function roundForSignature(value: number, quantum: number): number {
  return Math.round(value / quantum);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}
