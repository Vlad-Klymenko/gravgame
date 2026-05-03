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
  MIN_BODY_RADIUS,
  MAX_BODY_RADIUS,
  PREVIEW_GROWTH_RATE,
} from "../simulation/constants";

interface GameCanvasProps {
  width: number;
  height: number;
}

export function GameCanvas({ width, height }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SimulationState>({
    bodies: [],
    isPaused: false,
    previewBody: null,
    nextBodyId: 0,
    ship: createShip(width / 2, height / 2),
    shipControls: {
      burn: false,
      rotateLeft: false,
      rotateRight: false,
    },
    projectiles: [],
    nextProjectileId: 0,
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

      const deltaTime = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
      lastTimeRef.current = currentTime;

      const state = stateRef.current;

      // Update preview body growth
      if (state.previewBody) {
        const elapsedTime = (currentTime - state.previewBody.startTime) / 1000;
        const newRadius = MIN_BODY_RADIUS + PREVIEW_GROWTH_RATE * elapsedTime;
        state.previewBody.radius = Math.min(newRadius, MAX_BODY_RADIUS);
      }

      // Update physics
      updatePhysics(state, deltaTime, canvas.width, canvas.height);

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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      mouseRef.current = { x, y };

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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

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
