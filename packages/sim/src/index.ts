export type { LampEvent, LampInput, LampResult, Maze, Point } from "./types";
export { createRng, type Rng } from "./rng";
export { generateMaze, isFloor, type MazeOptions } from "./maze";
export { findPath } from "./path";
export { simulateLamp, STANDARD_FLOOR } from "./lamp";
