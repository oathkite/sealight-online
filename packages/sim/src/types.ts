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
  /** モンスターのいるマス。種類は探索時に決まる */
  readonly monsters: readonly Point[];
};
