// ============================================================
// montecarlo.ts — 含未知卡局面的最佳手估計
//
// 依盤面深度自動選擇兩種模式（實測基準見下）：
//
//   【sampled 抽樣平均】空格 ≤ 7 時：
//     1. 從「對手牌組模型」抽 N 組未知牌的可能組合（見 opponent-model.ts；
//        預設 uniform＝全卡池均勻抽，指定 NPC／玩家時抽樣空間會大幅收斂），
//        每組把未知槽填成真實卡，得到一個完全資訊局面。
//     2. 對每個局面，把「當前玩家的每個根節點著手」都用 alpha-beta 精確評分。
//     3. 同一著手跨 N 組樣本取平均分，選平均最好的——即對「對手可能拿
//        什麼牌」最穩健的一手。抽真實卡自帶陣營，強化/弱化不再失真。
//     4. N 用時間預算自適應（目標總耗時 < 1 秒）。
//
//   【estimate 估計卡】空格 ≥ 8 時：
//     單一樣本的全根評分實測即需 1~13 秒，抽樣統計無意義。
//     退回原本做法：未知卡全換成估計卡（四邊 STRONG_EDGE）做精確搜尋。
//     搜尋端的走法去重（minimax 改法 A）讓多張同內容估計卡只展開一次，
//     此情境下實測快約 7 倍，深盤面反而是估計卡最高效的地方。
//
//   【exact 精確】無未知卡時：直接 findBestMove，結果與原流程完全一致。
//
// 成本實測基準（本次開發環境，空格數 → 每樣本全根評分耗時）：
//   ≤6: <20ms ／ 7: ~170ms ／ 8: ~950ms ／ 9: ~13000ms
//
// 著手識別：未知槽被填卡時「保留槽位原本的 id」（負數 id），
// 所以同一個著手 (cardId, cellIndex) 在所有樣本間、以及與 UI 的
// selectedCardId 之間都對得起來。
// ============================================================

import { applyMove, getLegalMoves, isGameOver } from './game'
import { evaluateState, findBestMove, findBestMoveForCard } from './minimax'
import { makeEstimateCard } from './card-pool'
import { createOpponentModel } from './opponent-model'
import type { OpponentModel, OpponentModelSpec } from './opponent-model'
import type { Card, GameState, Move } from './types'

// ---------- 結果 ----------
export interface MonteCarloResult {
  move: Move | null // 建議著手；終局為 null
  score: number // 該著手的分數（紅視角）。sampled 模式為跨樣本平均（可能非整數）
  samples: number // 實際抽樣組數；exact / estimate 模式為 0
  mode: 'exact' | 'sampled' | 'estimate'
  // 對手未知牌的候選張數（依對手牌組模型與已亮出的牌算出）。
  // exact 模式為 0。數字很小時代表推論收得很緊，可供 UI 標註信心。
  candidates: number
}

// ---------- 選項 ----------
export interface MonteCarloOptions {
  // 抽樣卡池（預設全卡池）。測試時可注入小卡池。
  pool?: Card[]
  // 從卡池排除的牌（對手已亮出的：已填值的手牌、牌組記憶）。
  // 用「內容簽名」（四邊值＋陣營）比對，因為手動填值的卡沒有卡池 id。
  // 同一副牌組內不會有重複卡，所以已亮出的牌不可能再是未知牌。
  excludeCards?: Card[]
  // 混亂規則：根節點只算這張牌的落點。
  restrictToCardId?: number
  // 時間預算（毫秒），預設 900。抽滿預算即停。
  timeBudgetMs?: number
  // 樣本數上下限。下限保證統計基礎（單樣本過重時由 3 倍預算保險截斷），
  // 上限避免淺盤面（搜尋極快）抽到天荒地老。
  minSamples?: number
  maxSamples?: number
  // 抽樣模式的空格數上限（超過走 estimate 模式）。依實測基準預設 7。
  sampledMaxEmpties?: number
  // 亂數來源（預設 Math.random；測試可注入固定序列求重現）。
  rng?: () => number
  // 對手牌組模型（預設 uniform＝全卡池均勻抽，即舊行為）。
  // 指定 NPC 或玩家時，抽樣空間會依實際牌組／規則約束大幅收斂。
  opponent?: OpponentModelSpec
}

// 精確搜尋（依混亂限制選入口）。exact 與 estimate 模式共用。
function exactSearch(state: GameState, restrictToCardId?: number) {
  return restrictToCardId !== undefined
    ? findBestMoveForCard(state, restrictToCardId)
    : findBestMove(state)
}

// ---------- 主入口 ----------
export function findBestMoveMonteCarlo(
  state: GameState,
  opts: MonteCarloOptions = {},
): MonteCarloResult {
  const hasUnknown = state.redHand.some((c) => c.unknown) || state.blueHand.some((c) => c.unknown)

  // 無未知卡：精確搜尋，結果與原流程完全一致。
  if (!hasUnknown || isGameOver(state)) {
    const r = exactSearch(state, opts.restrictToCardId)
    return { move: r.move, score: r.score, samples: 0, mode: 'exact', candidates: 0 }
  }

  // 對手牌組模型：決定 sampled 模式的未知牌從哪裡抽。
  // estimate 模式不用它挑邊值——實測牌組專屬平均邊值比全域 STRONG_EDGE 更差
  // （相對代價 0.55 vs 0.45、自報高估 4.40 vs 3.55，40 個開局），只取候選數。
  const model: OpponentModel = createOpponentModel(opts.opponent ?? { kind: 'uniform' }, {
    pool: opts.pool,
    excludeCards: opts.excludeCards,
  })

  const empties = state.board.filter((c) => c.card === null).length
  const sampledMaxEmpties = opts.sampledMaxEmpties ?? 7

  // 深盤面：estimate 模式（未知卡 → 估計卡，精確搜尋）。
  if (empties > sampledMaxEmpties) {
    const sub = (hand: Card[]): Card[] => hand.map((c) => (c.unknown ? makeEstimateCard(c.id) : c))
    const est: GameState = {
      board: state.board,
      redHand: sub(state.redHand),
      blueHand: sub(state.blueHand),
      turn: state.turn,
      rules: state.rules,
    }
    const r = exactSearch(est, opts.restrictToCardId)
    return {
      move: r.move,
      score: r.score,
      samples: 0,
      mode: 'estimate',
      candidates: model.candidates.length,
    }
  }

  // ---------- sampled 模式 ----------
  const timeBudgetMs = opts.timeBudgetMs ?? 900
  const minSamples = opts.minSamples ?? 3
  const maxSamples = opts.maxSamples ?? 200
  const rng = opts.rng ?? Math.random

  // 未知槽總數（跨雙方手牌；通常只有對手側）。
  const unknownCount =
    state.redHand.filter((c) => c.unknown).length + state.blueHand.filter((c) => c.unknown).length

  // 根節點著手：直接用原局面列（合法性只看 id 與空格，佔位數值無關）。
  // 這組 (cardId, cellIndex) 鍵在所有樣本間固定不變。
  let rootMoves = getLegalMoves(state)
  if (opts.restrictToCardId !== undefined) {
    rootMoves = rootMoves.filter((m) => m.cardId === opts.restrictToCardId)
  }
  if (rootMoves.length === 0) {
    return { move: null, score: evaluateState(state), samples: 0, mode: 'exact', candidates: 0 }
  }

  // 把未知槽填成抽到的真實卡：內容用真卡（含陣營），id 保留槽位原 id。
  const determinize = (drawn: Card[]): GameState => {
    let k = 0
    const fill = (hand: Card[]): Card[] =>
      hand.map((c) => {
        if (!c.unknown) return c
        const real = drawn[k++]!
        return { ...real, id: c.id }
      })
    return {
      board: state.board,
      redHand: fill(state.redHand),
      blueHand: fill(state.blueHand),
      turn: state.turn,
      rules: state.rules,
    }
  }

  // ---------- 抽樣主迴圈 ----------
  const sums = new Array<number>(rootMoves.length).fill(0)
  const start = Date.now()
  let n = 0

  while (n < maxSamples) {
    const det = determinize(model.draw(unknownCount, rng))
    // 每個根著手都精確評分（applyMove 會自己 clone，det 不被污染）。
    for (let i = 0; i < rootMoves.length; i++) {
      sums[i]! += evaluateState(applyMove(det, rootMoves[i]!))
    }
    n++
    const elapsed = Date.now() - start
    if (n >= minSamples && elapsed >= timeBudgetMs) break
    if (n < minSamples && elapsed >= timeBudgetMs * 3) break // 單樣本過重的保險
  }

  // ---------- 跨樣本平均，選最穩的一手 ----------
  const isMax = state.turn === 'RED'
  let bestIdx = 0
  let bestAvg = sums[0]! / n
  for (let i = 1; i < rootMoves.length; i++) {
    const avg = sums[i]! / n
    if (isMax ? avg > bestAvg : avg < bestAvg) {
      bestAvg = avg
      bestIdx = i
    }
  }

  return {
    move: rootMoves[bestIdx]!,
    score: bestAvg,
    samples: n,
    mode: 'sampled',
    candidates: model.candidates.length,
  }
}