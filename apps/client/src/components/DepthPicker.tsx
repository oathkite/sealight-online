import { useEffect, useRef, type KeyboardEvent } from "react";
import { MAX_DEPTH } from "@sealight/sim";

type DepthPickerProps = {
  readonly value: number;
  /** 到達した最も深い階。ここまでは金、次の階は銀、その先はまだ見ぬ階 */
  readonly bestDepth: number;
  readonly disabled: boolean;
  readonly onChange: (depth: number) => void;
};

const DEPTHS = Array.from({ length: MAX_DEPTH }, (_, i) => i + 1);

const stateOf = (depth: number, best: number): "reached" | "next" | "unknown" => {
  if (depth <= best) return "reached";
  return depth === best + 1 ? "next" : "unknown";
};

/** 矢印キーと Home / End で選ぶ階。範囲の外には出ない */
const KEY_STEP: Readonly<Record<string, (value: number) => number>> = {
  ArrowRight: (v) => v + 1,
  ArrowDown: (v) => v + 1,
  ArrowLeft: (v) => v - 1,
  ArrowUp: (v) => v - 1,
  Home: () => 1,
  End: () => MAX_DEPTH,
};

/**
 * 目標の階を選ぶメダルの列。キーボードでは、選んでいるメダルだけに Tab で止まり、矢印キーで選び直す。
 * 選んだメダルが見える位置まで自動で送る
 */
export const DepthPicker = ({ value, bestDepth, disabled, onChange }: DepthPickerProps) => {
  const selected = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    selected.current?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
    if (moved.current) selected.current?.focus();
    moved.current = false;
  }, [value]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const step = KEY_STEP[e.key];
    if (!step || disabled) return;
    e.preventDefault();
    moved.current = true;
    onChange(Math.min(MAX_DEPTH, Math.max(1, step(value))));
  };
  return (
    <div className="depth-picker" role="radiogroup" aria-label="目標の階" onKeyDown={onKeyDown}>
      {DEPTHS.map((depth) => {
        const state = stateOf(depth, bestDepth);
        return (
          <button
            key={depth}
            ref={depth === value ? selected : undefined}
            type="button"
            role="radio"
            aria-checked={depth === value}
            tabIndex={depth === value ? 0 : -1}
            aria-label={`地下 ${depth} 階${state === "reached" ? "（到達済み）" : ""}`}
            className={`medal ${state}${depth === value ? " selected" : ""}`}
            disabled={disabled}
            onClick={() => onChange(depth)}
          >
            <span className="medal-floor">B{depth}</span>
            <span className="medal-mark" aria-hidden="true">
              {state === "reached" ? "★" : state === "next" ? "!" : "?"}
            </span>
          </button>
        );
      })}
    </div>
  );
};
