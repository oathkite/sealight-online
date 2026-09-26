/**
 * 格下の階でもらえる経験値を減らす。同じ階を往復するだけでは強くなりにくくし、
 * 装備の特性や鍛冶で備えて先へ進む方が早いようにする（稼ぐこと自体はできる）
 */

/** その階に見合うレベル */
const LEVEL_BASE = 2;
const LEVEL_PER_DEPTH = 1.2;
/** 見合うレベルを 1 超えるごとに減る割合 */
const XP_FALLOFF = 0.2;
/** どれだけ格下でも、この割合はもらえる */
const MIN_XP_SCALE = 0.05;

export const expectedLevel = (depth: number): number => Math.round(LEVEL_BASE + LEVEL_PER_DEPTH * depth);

/** その階の敵からもらえる経験値の割合 */
export const xpScale = (level: number, depth: number): number => {
  const over = level - expectedLevel(depth);
  return over <= 0 ? 1 : Math.max(MIN_XP_SCALE, 1 - over * XP_FALLOFF);
};

/** 割合をかけた経験値。0 にはしない */
export const scaledXp = (xp: number, level: number, depth: number): number => Math.max(1, Math.round(xp * xpScale(level, depth)));
