// ============================================================
// opponent-model.ts — 對手牌組模型
//
// 蒙地卡羅抽樣的「對手未知牌從哪裡抽」這件事，原本寫死在 montecarlo.ts
// 裡：從全卡池 475 張均勻抽。那等於假設對手拿一副隨機爛牌，實測是目前
// 最大的可修誤差源（自報分數高估 2.12 卡；把卡池換對後降到 0.02 卡，
// 樣本數與抽樣雜訊的影響可忽略）。
//
// 這裡把「抽樣來源」抽成一個介面，依對手類型分流：
//
//   uniform — 舊行為（全卡池均勻抽）。保留為預設值與退路。
//   npc     — 用該 NPC 的實際牌組（fixed 必中 + variable 補滿），
//             抽樣空間從 470 塌縮到約 5~10 張。
//   player  — 玩家牌組：星級上限照遊戲規則 ＋ 填充位假設為有競爭力的 3★。
//             兩者必須並用，只加合法性約束會讓結果更糟（見下方註解）。
//
// 介面刻意只有一個方法 draw(n, rng)：抽 n 張未知牌，供 sampled 模式用。
// 深盤面的 estimate 模式不走這裡——實測過讓模型提供「牌組專屬估計邊值」，
// 結果比全域 STRONG_EDGE 更差（見 montecarlo.ts 的註解），已放棄該方向。
// ============================================================

import type { Card } from './types'
import { CARD_POOL } from './card-pool'
import { getNpcDeck } from './npc-decks'

// ---------- 對外型別 ----------
export type OpponentModelSpec =
  | { kind: 'uniform' }
  | { kind: 'npc'; npcId: number }
  | { kind: 'player' }

export interface OpponentModelContext {
  // 抽樣卡池（預設全卡池）。測試可注入小卡池。
  pool?: Card[]
  // 對手已亮出的牌（牌組記憶 ＋ 手牌中已填值的卡）。用內容簽名比對排除。
  excludeCards?: Card[]
}

export interface OpponentModel {
  readonly kind: OpponentModelSpec['kind']
  // 目前仍可能出現在對手未知牌中的卡（診斷／UI 用）。
  readonly candidates: Card[]
  // 抽 n 張互不重複的未知牌。保證回傳長度為 n（不足時由全卡池補足）。
  draw(n: number, rng: () => number): Card[]
}

// ---------- 內容簽名 ----------
// 用「四邊值＋陣營」而非 id：手動填值的卡沒有卡池 id，
// 而未知槽的 id 是負數佔位值，兩者都不能拿來比對。
export function cardSignature(c: Card): string {
  return `${c.edges.top},${c.edges.right},${c.edges.bottom},${c.edges.left},${c.type ?? 'none'}`
}

// ---------- 共用小工具 ----------
function edgeSum(c: Card): number {
  return c.edges.top + c.edges.right + c.edges.bottom + c.edges.left
}

// 部分 Fisher-Yates：從 source 抽 k 張不重複。
// idx 由呼叫端持有並重複使用（每輪只洗前 k 個位置），避免每次抽樣都重配陣列。
function takeDistinct(source: Card[], k: number, rng: () => number, idx: number[]): Card[] {
  const m = Math.min(k, source.length)
  for (let i = 0; i < m; i++) {
    const j = i + Math.floor(rng() * (idx.length - i))
    const t = idx[i]!
    idx[i] = idx[j]!
    idx[j] = t
  }
  return idx.slice(0, m).map((i) => source[i]!)
}

function makeIdx(source: Card[]): number[] {
  return source.map((_, i) => i)
}

// 抽到的張數不足 n 時，從備援卡池補滿（排除已抽到的簽名）。
// 會發生的情境：選錯 NPC 導致固定牌與已亮牌對不上、或測試注入的小卡池抽乾。
// 未知槽一定要填滿，否則 determinize 會產生殘缺的卡。
function padTo(out: Card[], n: number, fallback: Card[], rng: () => number): Card[] {
  if (out.length >= n) return out
  const used = new Set(out.map(cardSignature))
  const rest = fallback.filter((c) => !used.has(cardSignature(c)))
  return [...out, ...takeDistinct(rest, n - out.length, rng, makeIdx(rest))]
}

// ---------- uniform：舊行為 ----------
class UniformModel implements OpponentModel {
  readonly kind = 'uniform' as const
  private idx: number[]
  constructor(readonly candidates: Card[]) {
    this.idx = makeIdx(candidates)
  }
  draw(n: number, rng: () => number): Card[] {
    return takeDistinct(this.candidates, n, rng, this.idx)
  }
}

// ---------- npc：用實際牌組 ----------
// NPC 手上 5 張 = fixed 全部 + 從 variable 隨機補滿。NPC 不受玩家的星級規則限制。
// 已亮出的牌從兩邊各自扣掉；剩下的 fixed 必定還在對手手上，所以「必抽」。
class NpcModel implements OpponentModel {
  readonly kind = 'npc' as const
  readonly candidates: Card[]
  private fixedIdx: number[]
  private varIdx: number[]
  constructor(
    private fixedRemaining: Card[],
    private variableRemaining: Card[],
    private fallback: Card[],
  ) {
    this.candidates = [...fixedRemaining, ...variableRemaining]
    this.fixedIdx = makeIdx(fixedRemaining)
    this.varIdx = makeIdx(variableRemaining)
  }
  draw(n: number, rng: () => number): Card[] {
    // 未知槽比剩餘固定牌還少：資料對不上（多半是選錯 NPC），退化成從固定牌抽。
    if (this.fixedRemaining.length >= n) {
      return padTo(takeDistinct(this.fixedRemaining, n, rng, this.fixedIdx), n, this.fallback, rng)
    }
    const rest = takeDistinct(
      this.variableRemaining,
      n - this.fixedRemaining.length,
      rng,
      this.varIdx,
    )
    return padTo([...this.fixedRemaining, ...rest], n, this.fallback, rng)
  }
}

// ---------- player：規則約束 ＋ meta 假設 ----------
// 玩家牌組受遊戲規則硬性限制：1-3★ 任意數量、4★+5★ 合計最多 2 張、5★ 最多 1 張。
//
// ⚠ 只加這條約束會讓結果更糟（實測自報高估 0.956 → 1.402 卡）：
// 規則只限制上限，不代表玩家用爛牌。單獨加約束會逼引擎抽 1-2★ 垃圾卡當填充位，
// 但真人的填充位放的是最好的 3★。必須「星級上限照規則 ＋ 填充位假設為
// 有競爭力的 3★」兩者並用（實測 0.204 卡，是三種做法中最低）。
//
// 下列機率參數是依主流牌組組成（1×5★ + 1×4★ + 3×3★）設的估計值，
// 未經實際牌組分布校準——要調準確度就調這裡，不要去改抽樣邏輯。
const HIGH_STAR_PROFILES: { five: number; four: number; weight: number }[] = [
  { five: 1, four: 1, weight: 0.55 }, // 主流組成
  { five: 0, four: 2, weight: 0.25 }, // 沒 5★ 就補兩張 4★
  { five: 1, four: 0, weight: 0.1 },
  { five: 0, four: 1, weight: 0.07 },
  { five: 0, four: 0, weight: 0.03 }, // 純低星牌組
]

// 填充位卡池：3★ 之中四邊總和最高的前 40%。
const FILLER_TOP_FRACTION = 0.4

class PlayerModel implements OpponentModel {
  readonly kind = 'player' as const
  readonly candidates: Card[]
  private idx5: number[]
  private idx4: number[]
  private idxFill: number[]
  constructor(
    private pool5: Card[],
    private pool4: Card[],
    private fillerPool: Card[],
    private revealedFive: number,
    private revealedFour: number,
    private fallback: Card[],
  ) {
    this.candidates = [...pool5, ...pool4, ...fillerPool]
    this.idx5 = makeIdx(pool5)
    this.idx4 = makeIdx(pool4)
    this.idxFill = makeIdx(fillerPool)
  }

  // 依已亮出的高星牌篩掉不可能的組成，再按權重抽一個。
  // 對手一旦亮出 5★ 和一張 4★，剩下的未知牌依規則必定是 3★ 以下——
  // 這是推論不是猜測，中後盤最強。
  private pickProfile(n: number, rng: () => number): { five: number; four: number } {
    let total = 0
    const valid: { five: number; four: number; weight: number }[] = []
    for (const p of HIGH_STAR_PROFILES) {
      const need5 = p.five - this.revealedFive
      const need4 = p.four - this.revealedFour
      if (need5 < 0 || need4 < 0 || need5 + need4 > n) continue
      valid.push(p)
      total += p.weight
    }
    if (valid.length === 0) return { five: 0, four: 0 }
    let r = rng() * total
    for (const p of valid) {
      r -= p.weight
      if (r <= 0) return { five: p.five - this.revealedFive, four: p.four - this.revealedFour }
    }
    const last = valid[valid.length - 1]!
    return { five: last.five - this.revealedFive, four: last.four - this.revealedFour }
  }

  draw(n: number, rng: () => number): Card[] {
    const { five, four } = this.pickProfile(n, rng)
    const out = [
      ...takeDistinct(this.pool5, five, rng, this.idx5),
      ...takeDistinct(this.pool4, four, rng, this.idx4),
    ]
    const fillers = takeDistinct(this.fillerPool, n - out.length, rng, this.idxFill)
    return padTo([...out, ...fillers], n, this.fallback, rng)
  }
}

// ---------- 建構入口 ----------
export function createOpponentModel(
  spec: OpponentModelSpec,
  ctx: OpponentModelContext = {},
): OpponentModel {
  const pool = ctx.pool ?? CARD_POOL
  const excluded = new Set((ctx.excludeCards ?? []).map(cardSignature))
  const remaining = excluded.size > 0 ? pool.filter((c) => !excluded.has(cardSignature(c))) : pool

  if (spec.kind === 'npc') {
    const deck = getNpcDeck(spec.npcId)
    // 找不到牌組（資料未更新／id 傳錯）：退回舊行為，不要假裝有牌組資訊。
    if (!deck) return new UniformModel(remaining)
    const byId = new Map(pool.map((c) => [c.id, c]))
    const resolve = (ids: number[]): Card[] =>
      ids.map((id) => byId.get(id)).filter((c): c is Card => c !== undefined)
    const keep = (cards: Card[]) => cards.filter((c) => !excluded.has(cardSignature(c)))
    return new NpcModel(keep(resolve(deck.fixed)), keep(resolve(deck.variable)), remaining)
  }

  if (spec.kind === 'player') {
    // 已亮出的牌拿星級：手動填值的卡 stars 可能是佔位值，
    // 先用簽名回卡池查真正的星級，查不到才用卡上的 stars。
    const starBySig = new Map<string, number>()
    for (const c of pool) {
      const sig = cardSignature(c)
      if (!starBySig.has(sig)) starBySig.set(sig, c.stars)
    }
    let revealedFive = 0
    let revealedFour = 0
    for (const c of ctx.excludeCards ?? []) {
      const s = starBySig.get(cardSignature(c)) ?? c.stars
      if (s === 5) revealedFive++
      else if (s === 4) revealedFour++
    }
    const pool5 = remaining.filter((c) => c.stars === 5)
    const pool4 = remaining.filter((c) => c.stars === 4)
    const three = remaining.filter((c) => c.stars === 3).sort((a, b) => edgeSum(b) - edgeSum(a))
    const cut = Math.max(1, Math.round(three.length * FILLER_TOP_FRACTION))
    const fillerPool = three.length > 0 ? three.slice(0, cut) : remaining.filter((c) => c.stars <= 3)
    return new PlayerModel(pool5, pool4, fillerPool, revealedFive, revealedFour, remaining)
  }

  return new UniformModel(remaining)
}