import { useEffect, useRef } from "react";
import type { SimulationState } from "../simulation/types";
import {
  updatePhysics,
  createBody,
  createShip,
  clearAllBodies,
  calculateOrbitalVelocity,
  fireProjectile,
  findNearestBody,
} from "../simulation/physics";
import { render } from "../simulation/render";
import {
  createCamera,
  screenToWorld,
  updateCamera,
  zoomCamera,
} from "../simulation/camera";
import {
  createSolarSystem,
  getStartingShipPosition,
  getNextSolarSystemBodyId,
} from "../simulation/solarSystem";
import { createInitialMission } from "../simulation/mission";
import {
  CAMERA_ZOOM_STEP,
  MAX_TIME_SCALE,
  MIN_BODY_RADIUS,
  MIN_TIME_SCALE,
  MAX_BODY_RADIUS,
  PREVIEW_GROWTH_RATE,
  TIME_SCALE_STEP,
} from "../simulation/constants";

interface GameCanvasProps {
  width: number;
  height: number;
}

export function GameCanvas({ width, height }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initialBodies = createSolarSystem();
  const initialShipPosition = getStartingShipPosition();
  const stateRef = useRef<SimulationState>({
    bodies: initialBodies,
    isPaused: false,
    timeScale: 1,
    fps: 0,
    previewBody: null,
    nextBodyId: getNextSolarSystemBodyId(),
    ship: createShip(
      initialShipPosition.x,
      initialShipPosition.y,
      initialShipPosition.vx,
      initialShipPosition.vy,
      initialShipPosition.landedOnBodyId,
    ),
    shipControls: {
      burn: false,
      rotateLeft: false,
      rotateRight: false,
    },
    camera: createCamera(initialShipPosition.x, initialShipPosition.y),
    projectiles: [],
    nextProjectileId: 0,
    trajectoryCache: {
      points: [],
      closestApproach: null,
      elapsed: 0,
      signature: "",
    },
    mission: createInitialMission(),
    lastLanding: null,
  });
  const lastTimeRef = useRef<number>(0);
  const isMouseDownRef = useRef<boolean>(false);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseVelRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isShiftHeldRef = useRef<boolean>(false);

  // Initialize canvas and game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const gameLoop = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }

      const realDeltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      const state = stateRef.current;
      const deltaTime = realDeltaTime * state.timeScale;
      if (realDeltaTime > 0) {
        const instantFps = 1 / realDeltaTime;
        state.fps =
          state.fps === 0 ? instantFps : state.fps * 0.9 + instantFps * 0.1;
      }

      // Update preview body growth
      if (state.previewBody) {
        const elapsedTime = (currentTime - state.previewBody.startTime) / 1000;
        const newRadius = MIN_BODY_RADIUS + PREVIEW_GROWTH_RATE * elapsedTime;
        state.previewBody.radius = Math.min(newRadius, MAX_BODY_RADIUS);
      }

      // Update physics
      updatePhysics(state, deltaTime);
      updateCamera(state.camera, state.ship, realDeltaTime);

      // Render
      render(ctx, canvas, state);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Handle mouse events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDownRef.current = true;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x, y } = screenToWorld(
        screenX,
        screenY,
        stateRef.current.camera,
        canvas.width,
        canvas.height,
      );

      mouseRef.current = { x, y };
      lastMouseRef.current = { x, y };

      const state = stateRef.current;
      state.previewBody = {
        x,
        y,
        radius: MIN_BODY_RADIUS,
        startTime: performance.now(),
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x, y } = screenToWorld(
        screenX,
        screenY,
        stateRef.current.camera,
        canvas.width,
        canvas.height,
      );

      // Calculate mouse velocity
      const dx = x - lastMouseRef.current.x;
      const dy = y - lastMouseRef.current.y;
      mouseVelRef.current = { vx: dx / 0.016, vy: dy / 0.016 }; // Normalize to pixels per second
      lastMouseRef.current = { x, y };

      mouseRef.current = { x, y };

      const state = stateRef.current;
      if (state.previewBody) {
        state.previewBody.x = x;
        state.previewBody.y = y;
      }
    };

    const handleMouseUp = () => {
      if (!isMouseDownRef.current) return;
      isMouseDownRef.current = false;

      const state = stateRef.current;
      if (state.previewBody) {
        let vx = mouseVelRef.current.vx;
        let vy = mouseVelRef.current.vy;

        // If Shift is held and there are bodies, use orbital velocity
        if (isShiftHeldRef.current && state.bodies.length > 0) {
          const nearest = findNearestBody(
            state.previewBody.x,
            state.previewBody.y,
            state.bodies,
          );
          if (nearest) {
            const orbital = calculateOrbitalVelocity(
              state.previewBody.x,
              state.previewBody.y,
              nearest,
            );
            vx = orbital.vx;
            vy = orbital.vy;
          }
        }

        // Spawn the body
        const newBody = createBody(
          state.previewBody.x,
          state.previewBody.y,
          state.previewBody.radius,
          state.nextBodyId,
          vx * 0.5,
          vy * 0.5,
        );
        state.bodies.push(newBody);
        state.nextBodyId++;
        state.previewBody = null;
      }
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;

      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        isShiftHeldRef.current = true;
      }

      if (e.code === "Space") {
        e.preventDefault();
        state.shipControls.burn = true;
      }

      if (e.code === "KeyA" || e.code === "ArrowLeft") {
        state.shipControls.rotateLeft = true;
      }

      if (e.code === "KeyD" || e.code === "ArrowRight") {
        state.shipControls.rotateRight = true;
      }

      if (e.code === "KeyP") {
        e.preventDefault();
        state.isPaused = !state.isPaused;
      }

      if (e.code === "BracketLeft") {
        e.preventDefault();
        zoomCamera(state.camera, 1 / CAMERA_ZOOM_STEP);
      }

      if (e.code === "BracketRight") {
        e.preventDefault();
        zoomCamera(state.camera, CAMERA_ZOOM_STEP);
      }

      if (e.code === "Comma") {
        e.preventDefault();
        state.timeScale = Math.max(
          MIN_TIME_SCALE,
          state.timeScale / TIME_SCALE_STEP,
        );
      }

      if (e.code === "Period") {
        e.preventDefault();
        state.timeScale = Math.min(
          MAX_TIME_SCALE,
          state.timeScale * TIME_SCALE_STEP,
        );
      }

      if (e.code === "KeyF" && !e.repeat) {
        e.preventDefault();
        fireProjectile(state);
      }

      if (e.code === "KeyR") {
        e.preventDefault();
        clearAllBodies(state);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        isShiftHeldRef.current = false;
      }

      const state = stateRef.current;

      if (e.code === "Space") {
        state.shipControls.burn = false;
      }

      if (e.code === "KeyA" || e.code === "ArrowLeft") {
        state.shipControls.rotateLeft = false;
      }

      if (e.code === "KeyD" || e.code === "ArrowRight") {
        state.shipControls.rotateRight = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: "block",
        cursor: "crosshair",
      }}
    />
  );
}
