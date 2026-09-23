import { DurableObject } from "cloudflare:workers";
import {
  allocateStat,
  buy,
  completeLamp,
  createCharacter,
  decide,
  equip,
  sell,
  setTactics,
  startLamp,
  unequip,
  type CharacterState,
  type Decision,
  type RuleResult,
  type ShopSku,
  type Slot,
  type StatKey,
  type Tactics,
} from "@sealight/sim";

export type Action =
  | { readonly type: "allocate"; readonly stat: StatKey }
  | { readonly type: "equip"; readonly itemId: string }
  | { readonly type: "unequip"; readonly slot: Slot }
  | { readonly type: "sell"; readonly itemId: string }
  | { readonly type: "buy"; readonly sku: ShopSku }
  | { readonly type: "tactics"; readonly tactics: Tactics };

const KEY = "state";

const applyAction = (state: CharacterState, action: Action): RuleResult => {
  switch (action.type) {
    case "allocate":
      return allocateStat(state, action.stat);
    case "equip":
      return equip(state, action.itemId);
    case "unequip":
      return unequip(state, action.slot);
    case "sell":
      return sell(state, action.itemId);
    case "buy":
      return buy(state, action.sku, crypto.randomUUID());
    case "tactics":
      return setTactics(state, action.tactics);
  }
};

const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;

/**
 * キャラ 1 体ぶんの状態を持つ。ゲームのルールはすべて sim の純粋関数に任せ、
 * ここでは保存、探索の終了アラーム、その場での確定（アラームが遅れたとき）だけを扱う。
 */
export class Character extends DurableObject<Env> {
  private async load(): Promise<CharacterState> {
    const stored = await this.ctx.storage.get<CharacterState>(KEY);
    if (stored) return stored;
    const created = createCharacter();
    await this.ctx.storage.put(KEY, created);
    return created;
  }

  private async save(result: RuleResult): Promise<RuleResult> {
    if (result.ok) await this.ctx.storage.put(KEY, result.value);
    return result;
  }

  /** 終了時刻を過ぎた探索があれば確定させる。アラームと取得のどちらから呼ばれても 1 回だけ反映される */
  private async settle(state: CharacterState): Promise<CharacterState> {
    if (state.phase.type !== "exploring" || Date.now() < state.phase.endsAt) return state;
    const completed = await this.save(completeLamp(state));
    return completed.ok ? completed.value : state;
  }

  async state(): Promise<CharacterState> {
    return this.settle(await this.load());
  }

  /** 探索を始める操作の結果を保存し、探索中になったら終了時刻にアラームを設定する */
  private async beginExploration(result: RuleResult): Promise<RuleResult> {
    const saved = await this.save(result);
    if (saved.ok && saved.value.phase.type === "exploring") {
      await this.ctx.storage.setAlarm(saved.value.phase.endsAt);
    }
    return saved;
  }

  async startLamp(durationMs: number): Promise<RuleResult> {
    const state = await this.state();
    return this.beginExploration(startLamp(state, { seed: randomSeed(), now: Date.now(), durationMs }));
  }

  /** 階段での判断。進む・留まるはその場で次の探索が始まる */
  async decide(decision: Decision, durationMs: number): Promise<RuleResult> {
    const state = await this.state();
    return this.beginExploration(decide(state, decision, { seed: randomSeed(), now: Date.now(), durationMs }));
  }

  async act(action: Action): Promise<RuleResult> {
    return this.save(applyAction(await this.state(), action));
  }

  override async alarm(): Promise<void> {
    const state = await this.load();
    if (state.phase.type !== "exploring") return;
    // 前の探索のアラームが遅れて届いた場合は、今の探索の終了時刻に設定し直す
    if (Date.now() < state.phase.endsAt) {
      await this.ctx.storage.setAlarm(state.phase.endsAt);
      return;
    }
    await this.settle(state);
  }
}
