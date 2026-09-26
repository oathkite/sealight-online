import { useEffect, useRef, useState } from "react";
import type { CharacterState, Equipment } from "@sealight/sim";
import { playSfx } from "@/audio/sfx";
import { ItemCard } from "./items/ItemCard";
import { gainOver } from "./items/items";

type LootRevealProps = {
  readonly gold: number;
  readonly xp: number;
  readonly items: readonly Equipment[];
  readonly character: CharacterState;
  readonly busy: boolean;
  readonly onEquip: (itemId: string) => void;
};

/** 数を 0 から目標までなめらかに数え上げる */
const useCountUp = (target: number, running: boolean, durationMs = 900): number => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, running, durationMs]);
  return running ? value : 0;
};

/**
 * 袋を開けたときの音。お金の音のあと、宝が 1 枚ずつ現れるたびに鳴らす（珍しい物は特別な音）。
 * 開けるボタンを押したときに一度だけ予約する（画面を描き直しても鳴り直さない）
 */
const useRevealSounds = () => {
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return (items: readonly Equipment[]): void => {
    playSfx("open");
    timers.current = [
      window.setTimeout(() => playSfx("coin"), 250),
      ...items.map((item, i) => window.setTimeout(() => playSfx(item.rarity === "rare" ? "rare" : "reveal"), 150 + i * 260 + 350)),
    ];
  };
};

const Sack = ({ glowing }: { readonly glowing: boolean }) => (
  <svg className={`sack${glowing ? " glowing" : ""}`} viewBox="0 0 64 64" width="84" height="84" aria-hidden="true">
    <path d="M22 18c-9 6-14 16-14 26 0 10 10 14 24 14s24-4 24-14c0-10-5-20-14-26z" fill="#b58a58" />
    <path d="M22 18c-9 6-14 16-14 26 0 4 2 7 5 9-2-12 4-24 13-31z" fill="#8f6a40" />
    <path d="M20 17c4 2 8 3 12 3s8-1 12-3" stroke="#6b4a2c" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M26 12c2-4 10-4 12 0l-2 6h-8z" fill="#c9a06a" />
    {glowing ? <ellipse cx="32" cy="17" rx="9" ry="3" fill="#bff3ff" /> : null}
  </svg>
);

/**
 * 持ち帰った袋。開けると、お金が数え上がり、宝が 1 枚ずつ飛び出す。
 * 珍しい物が入っていると、開ける前から袋の口から青い光が漏れる
 */
export const LootReveal = ({ gold, xp, items, character, busy, onEquip }: LootRevealProps) => {
  const [opened, setOpened] = useState(false);
  const shownGold = useCountUp(gold, opened);
  const hasRare = items.some((item) => item.rarity === "rare");
  const playReveal = useRevealSounds();
  const revealed = useRef<HTMLDivElement>(null);
  // 開けるボタンは消えるので、読む位置を開けた中身へ移す
  useEffect(() => {
    if (opened) revealed.current?.focus();
  }, [opened]);

  if (!opened) {
    return (
      <div className="loot-closed">
        <Sack glowing={hasRare} />
        <p className="loot-hint">{hasRare ? "袋の口から、青い光が漏れている…！" : "ずっしり重い袋を背負って帰ってきた"}</p>
        <button
          type="button"
          className="gold"
          onClick={() => {
            playReveal(items);
            setOpened(true);
          }}
        >
          袋を開ける
        </button>
      </div>
    );
  }
  return (
    <div className="loot-open" ref={revealed} tabIndex={-1}>
      <div className="loot-totals">
        <span className="coin" role="img" aria-label={`${gold} G`}>
          <span className="coin-face" aria-hidden="true" />
          <span aria-hidden="true">{shownGold} G</span>
        </span>
        <span className="chip">経験値 <strong>+{xp}</strong></span>
      </div>
      <ul className="loot-items">
        {items.map((item, i) => {
          const equipped = character.equipment[item.slot]?.id === item.id;
          const inStash = character.stash.some((s) => s.id === item.id);
          const gain = gainOver(item, character.equipment);
          return (
            <li key={item.id}>
              <ItemCard item={item} gain={equipped ? null : gain} order={i}>
                {equipped ? <span className="equipped">装備中</span> : null}
                {!equipped && inStash && gain > 0 ? (
                  <button type="button" disabled={busy} onClick={() => onEquip(item.id)}>
                    装備する
                  </button>
                ) : null}
              </ItemCard>
            </li>
          );
        })}
      </ul>
      {items.length === 0 ? <p className="muted">装備は見つからなかった</p> : null}
    </div>
  );
};
