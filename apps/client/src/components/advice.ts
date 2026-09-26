import { AFFIX_COUNTERS, AFFIXES, type Advice, type Affix, type Trait } from "@sealight/sim";
import { AFFIX_HINTS, AFFIX_NAMES, TRAITS } from "./format";

const AFFIX_LIST = Object.keys(AFFIX_COUNTERS) as readonly Affix[];

/** その特徴に効く特性 */
const counterOf = (trait: Trait): Affix | undefined => AFFIX_LIST.find((a) => AFFIX_COUNTERS[a] === trait);

const slotName = (affix: Affix): string => ((AFFIXES.weapon as readonly Affix[]).includes(affix) ? "武器" : "防具");

/** 受けたダメージのうちの割合を「受けたダメージの 6 割」のように言う */
const shareText = (share: number): string => (share >= 0.95 ? "受けたダメージのほとんど" : `受けたダメージの ${Math.round(share * 10)} 割`);

const traitText = (advice: Extract<Advice, { type: "trait" }>): string => {
  const who = `${advice.foes.join("・")}（${TRAITS[advice.trait]}）`;
  const counter = counterOf(advice.trait);
  if (!counter) return `${who}に一番削られた`;
  const name = AFFIX_NAMES[counter];
  if (advice.countered) return `${name}を着けていても、${who}に削られた。装備を鍛えるか、体を上げよう`;
  return `${who}に一番削られた（${shareText(advice.share)}）。${name}の${slotName(counter)}が効く（${AFFIX_HINTS[counter]}）`;
};

/** 手がかりを、モンスターの様子として読める文にする */
export const adviceText = (advice: Advice): string => {
  switch (advice.type) {
    case "trait":
      return traitText(advice);
    case "potions":
      if (advice.left > 0) return `ポーションを ${advice.left} 本残したまま倒れた。飲む HP を早めよう`;
      return advice.carried === 0 ? "ポーションを持たせていなかった。1〜2 本あると粘れる" : "ポーションを使い切っていた。多めに持たせるか、飲む HP を早めよう";
    case "hunger":
      return "食料が尽きてお腹を空かせていた。食料を多めに持たせよう";
    case "bag":
      return `荷物がいっぱいで ${advice.count} 個置いてきた。食料やポーションを減らすと、たくさん持ち帰れる`;
  }
};

/** 手がかりがないときの一言 */
export const noAdviceText = (returned: boolean): string =>
  returned ? "特に困ったことはなかったみたい。もう少し深くを目指せそう" : "力が足りなかったみたい。レベルを上げるか、装備を整えよう";
