import type {
  Body,
  ClosestApproach,
  SimulationState,
  TrajectoryPoint,
} from "./types";
import {
  TRAJECTORY_CLOSED_ORBIT_MIN_STEPS,
  TRAJECTORY_CLOSED_ORBIT_POSITION_TOLERANCE,
  TRAJECTORY_CLOSED_ORBIT_VELOCITY_TOLERANCE,
  TRAJECTORY_SAMPLE_INTERVAL,
  TRAJECTORY_STEPS,
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
  const predictedState = cloneStateForCoastPrediction(state);
  const referenceBodyId = selectTrajectoryReferenceBodyId(state);
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

  for (let i = 0; i < TRAJECTORY_STEPS; i++) {
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

function getDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}
