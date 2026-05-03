import type { Body, MissionState, SimulationState } from "./types";

export function createInitialMission(): MissionState {
  return {
    pickupBodyId: 1,
    deliveryBodyId: 3,
    hasCargo: false,
    completedDeliveries: 0,
    message: "Land gently on Moon 1 to load cargo.",
  };
}

export function getMissionTargetId(mission: MissionState): number {
  return mission.hasCargo ? mission.deliveryBodyId : mission.pickupBodyId;
}

export function updateMissionForLanding(
  state: SimulationState,
  landedBodyId: number,
  safe: boolean,
): void {
  const mission = state.mission;

  if (!safe) {
    mission.message = "Rough landing. Cargo handling needs a gentle touchdown.";
    return;
  }

  if (!mission.hasCargo && landedBodyId === mission.pickupBodyId) {
    mission.hasCargo = true;
    mission.message = `Cargo loaded. Deliver it to Moon ${mission.deliveryBodyId}.`;
    return;
  }

  if (mission.hasCargo && landedBodyId === mission.deliveryBodyId) {
    mission.completedDeliveries++;
    mission.pickupBodyId = landedBodyId;
    mission.deliveryBodyId = chooseNextDeliveryBody(
      state.bodies,
      landedBodyId,
      mission.completedDeliveries,
    );
    mission.hasCargo = true;
    mission.message = `Delivery complete. New cargo goes to Moon ${mission.deliveryBodyId}.`;
    return;
  }

  const targetId = getMissionTargetId(mission);
  mission.message = `Wrong moon. Current target is Moon ${targetId}.`;
}

function chooseNextDeliveryBody(
  bodies: Body[],
  currentBodyId: number,
  completedDeliveries: number,
): number {
  const moonIds = bodies
    .filter((body) => body.orbit && body.id !== currentBodyId)
    .map((body) => body.id)
    .sort((a, b) => a - b);

  if (moonIds.length === 0) return currentBodyId;

  return moonIds[completedDeliveries % moonIds.length];
}
