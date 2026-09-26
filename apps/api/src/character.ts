import { DurableObject } from "cloudflare:workers";
import {
  allocateStat,
  buy,
  createCharacter,
  departExpedition,
  equip,
  returnFromExpedition,
  sell,
  setTactics,
  STATE_VERSION,
  unequip,
  type CharacterState,
  type ExpeditionResult,
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
  | { readonly type: "buy"; readonly sku: ShopSku; readonly quantity: number }
  | { readonly type: "tactics"; readonly tactics: Tactics };

/** 帰る時刻と結果。帰る時刻まで、画面には渡さない */
type Pending = { readonly endsAt: number; readonly result: ExpeditionResult };

const STATE_KEY = "state";
const PENDING_KEY = "pending";

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
      return buy(state, action.sku, crypto.randomUUID(), action.quantity);
    case "tactics":
      return setTactics(state, action.tactics);
  }
};

const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;

const isCurrent = (value: unknown): value is CharacterState =>
  typeof value === "object" && value !== null && "version" in value && value.version === STATE_VERSION;

/**
 * キャラ 1 体ぶんの状態を持つ。ゲームのルールはすべて sim の純粋関数に任せ、
 * ここでは保存、帰る時刻のアラーム、結果を帰る時刻まで隠すことだけを扱う。
 */
export class Character extends DurableObject<Env> {
  /** 保存形式が古いキャラは作り直す */
  private async load(): Promise<CharacterState> {
    const stored = await this.ctx.storage.get<unknown>(STATE_KEY);
    if (isCurrent(stored)) return stored;
    const created = createCharacter();
    await this.ctx.storage.put(STATE_KEY, created);
    await this.ctx.storage.delete(PENDING_KEY);
    return created;
  }

  private async save(result: RuleResult): Promise<RuleResult> {
    if (result.ok) await this.ctx.storage.put(STATE_KEY, result.value);
    return result;
  }

  /** 帰る時刻を過ぎていれば結果を反映する。アラームと取得のどちらから呼ばれても 1 回だけ反映される */
  private async settle(state: CharacterState): Promise<CharacterState> {
    if (state.phase.type !== "exploring") return state;
    const pending = await this.ctx.storage.get<Pending>(PENDING_KEY);
    if (!pending || Date.now() < pending.endsAt) return state;
    const returned = await this.save(returnFromExpedition(state, pending.result));
    await this.ctx.storage.delete(PENDING_KEY);
    return returned.ok ? returned.value : state;
  }

  async state(): Promise<CharacterState> {
    return this.settle(await this.load());
  }

  async explore(target: number, rations: number, timeScale: number): Promise<RuleResult> {
    const state = await this.state();
    const departed = departExpedition(state, { target, rations, seed: randomSeed(), now: Date.now(), timeScale });
    if (!departed.ok) return departed;
    const { endsAt, result } = departed.value;
    await this.ctx.storage.put(PENDING_KEY, { endsAt, result } satisfies Pending);
    await this.ctx.storage.setAlarm(endsAt);
    return this.save({ ok: true, value: departed.value.state });
  }

  async act(action: Action): Promise<RuleResult> {
    return this.save(applyAction(await this.state(), action));
  }

  override async alarm(): Promise<void> {
    const state = await this.load();
    const pending = await this.ctx.storage.get<Pending>(PENDING_KEY);
    if (state.phase.type !== "exploring" || !pending) return;
    // 前の冒険のアラームが遅れて届いた場合は、今の冒険の帰る時刻に設定し直す
    if (Date.now() < pending.endsAt) {
      await this.ctx.storage.setAlarm(pending.endsAt);
      return;
    }
    await this.settle(state);
  }
}
