export type Point = {
  readonly x: number;
  readonly y: number;
};

export type Maze = {
  readonly width: number;
  readonly height: number;
  /** row-major。true = 床、false = 壁 */
  readonly cells: readonly boolean[];
  readonly start: Point;
  readonly stairs: Point;
  readonly treasures: readonly Point[];
};

export type LampEvent =
  | { readonly type: "move"; readonly to: Point }
  | { readonly type: "treasure"; readonly at: Point }
  | { readonly type: "stairs"; readonly at: Point };

export type LampInput = {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly treasureCount?: number;
};

export type LampResult = {
  readonly input: LampInput;
  readonly maze: Maze;
  readonly events: readonly LampEvent[];
};
