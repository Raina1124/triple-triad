// ============================================================
// montecarlo.test.ts — 改法 A（走法去重）與改法 B（蒙地卡羅）測試
//
// 去重等價性：搜尋端去重不得改變最優分數。用「無剪枝、無去重」的
// 參考實作在小局面上全量對照（大局面由剪枝版自我一致性覆蓋）。
// ============================================================

import { describe, expect, it } from 'vitest'
import { CARD_POOL, makeEstimateCard } from './card-pool'
import { applyMove, getLegalMoves, isGameOver } from './game'
import { evaluateState, findBestMove, findBestMoveForCard } from './minimax'
import { findBestMoveMonteCarlo } from './montecarlo'
import type { Card, GameState, Rules } from './types'

// ---------- 測試用亂數（固定種子求重現）----------
let seed = 20260706
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const ri = (n: number) => Math.floor(rnd() * n)

function baseRules(): Rules {
  return {
    same: false,
    plus: false,
    combo: false,
    reverse: false,
    fallenAce: false,
    order: false,
    chaos: false,
    threeOpen: false,
    allOpen: false,
    ascension: false,
    descension: false,
    swap: false,
  }
}
function randomRules(): Rules {
  const r = baseRules()
  r.same = rnd() < 0.4
  r.plus = rnd() < 0.4
  r.reverse = rnd() < 0.3
  r.fallenAce = rnd() < 0.3
  r.order = rnd() < 0.2
  if (rnd() < 0.5) {
    if (rnd() < 0.5) r.ascension = true
    else r.descension = true
  }
  return r
}

// 抽 5 張手牌；dupProb 為「複製前一張內容（不同 id）」的機率，
// 用來製造去重會作用的重複牌情境。
function pick5(dupProb: number): Card[] {
  const hand: Card[] = []
  for (let i = 0; i < 5; i++) {
    if (i > 0 && rnd() < dupProb) {
      const src = hand[ri(hand.length)]!
      hand.push({ ...src, id: 1000 + ri(1000000) })
    } else {
      hand.push({ ...CARD_POOL[ri(CARD_POOL.length)]!, id: 1000 + ri(1000000) })
    }
  }
  return hand
}

function makeUnknown(i: number): Card {
  return {
    id: -1 - i,
    name: '未知',
    stars: 1,
    edges: { top: 1, right: 1, bottom: 1, left: 1 },
    unknown: true,
  }
}

// 隨機局面：發牌後隨機走 playoutMoves 手。
function randomState(dupProb: number, playoutMoves: number): GameState {
  let s: GameState = {
    board: Array.from({ length: 9 }, () => ({ card: null, owner: null })),
    redHand: pick5(dupProb),
    blueHand: pick5(dupProb),
    turn: rnd() < 0.5 ? 'RED' : 'BLUE',
    rules: randomRules(),
  }
  for (let i = 0; i < playoutMoves && !isGameOver(s); i++) {
    const mv = getLegalMoves(s)
    s = applyMove(s, mv[ri(mv.length)]!)
  }
  return s
}

// ---------- 參考實作：無剪枝、無去重的純 minimax ----------
// 只用於小局面全量對照，證明去重不改變最優分數。
function referenceScore(state: GameState): number {
  if (isGameOver(state)) {
    let red = state.redHand.length
    let blue = state.blueHand.length
    for (const cell of state.board) {
      if (cell.owner === 'RED') red++
      else if (cell.owner === 'BLUE') blue++
    }
    return red - blue
  }
  const moves = getLegalMoves(state)
  const scores = moves.map((m) => referenceScore(applyMove(state, m)))
  return state.turn === 'RED' ? Math.max(...scores) : Math.min(...scores)
}

describe('minimax 走法去重（改法 A）', () => {
  it('高重複牌隨機局面：去重後分數 = 無去重參考實作', () => {
    for (let t = 0; t < 60; t++) {
      const s = randomState(0.6, 4 + ri(3)) // 3~5 空格，參考實作可負擔
      expect(findBestMove(s).score).toBe(referenceScore(s))
    }
  })

  it('對手 5 張同內容估計卡：分數 = 參考實作', () => {
    for (let t = 0; t < 20; t++) {
      let s: GameState = {
        board: Array.from({ length: 9 }, () => ({ card: null, owner: null })),
        redHand: pick5(0),
        blueHand: [0, 1, 2, 3, 4].map((i) => makeEstimateCard(-1 - i)),
        turn: 'RED',
        rules: randomRules(),
      }
      for (let i = 0; i < 5; i++) {
        const mv = getLegalMoves(s)
        s = applyMove(s, mv[ri(mv.length)]!)
      }
      expect(findBestMove(s).score).toBe(referenceScore(s))
    }
  })

  it('findBestMoveForCard：限定牌搜尋分數 = 參考實作（該牌各落點取最佳）', () => {
    for (let t = 0; t < 30; t++) {
      const s = randomState(0.5, 5)
      if (s.rules.order || isGameOver(s)) continue
      const hand = s.turn === 'RED' ? s.redHand : s.blueHand
      const cid = hand[ri(hand.length)]!.id
      const moves = getLegalMoves(s).filter((m) => m.cardId === cid)
      const refs = moves.map((m) => referenceScore(applyMove(s, m)))
      const ref = s.turn === 'RED' ? Math.max(...refs) : Math.min(...refs)
      expect(findBestMoveForCard(s, cid).score).toBe(ref)
    }
  })
})

describe('findBestMoveMonteCarlo（改法 B）', () => {
  it('無未知卡：exact 模式，結果 = findBestMove', () => {
    for (let t = 0; t < 30; t++) {
      const s = randomState(0.2, 3 + ri(4))
      const mc = findBestMoveMonteCarlo(s)
      const ex = findBestMove(s)
      expect(mc.mode).toBe('exact')
      expect(mc.samples).toBe(0)
      expect(mc.score).toBe(ex.score)
    }
  })

  it('排除後只剩單一候選：sampled 結果 = 手動填入該卡的精確搜尋', () => {
    const s = randomState(0, 4)
    const oppHand = s.turn === 'RED' ? s.blueHand : s.redHand
    oppHand[0] = makeUnknown(0)
    const pool = CARD_POOL.slice(10, 16).map((c) => ({ ...c }))
    const mc = findBestMoveMonteCarlo(s, {
      pool,
      excludeCards: pool.slice(0, 5),
      rng: rnd,
      minSamples: 1,
      maxSamples: 3,
    })
    const only = pool[5]!
    const filled: GameState = {
      ...s,
      redHand: s.redHand.map((c) => (c.unknown ? { ...only, id: c.id } : c)),
      blueHand: s.blueHand.map((c) => (c.unknown ? { ...only, id: c.id } : c)),
    }
    const ex = findBestMove(filled)
    expect(mc.mode).toBe('sampled')
    expect(mc.score).toBe(ex.score)
    expect(mc.move!.cellIndex).toBe(ex.move!.cellIndex)
    // 建議的 cardId 必須存在於原局面手牌（UI 的 selectedCardId 才對得起來）
    const hand = s.turn === 'RED' ? s.redHand : s.blueHand
    expect(hand.some((c) => c.id === mc.move!.cardId)).toBe(true)
  })

  it('深盤面（空格 ≥ 8）：estimate 模式，分數 = 估計卡精確搜尋', { timeout: 30000 }, () => {
    // 空盤精確搜尋每輪約 0.5~1 秒，輪數放少。
    for (let t = 0; t < 3; t++) {
      const s = randomState(0, 0)
      const opp = s.turn === 'RED' ? s.blueHand : s.redHand
      for (let i = 0; i < 5; i++) opp[i] = makeUnknown(i)
      const mc = findBestMoveMonteCarlo(s, { rng: rnd })
      const est: GameState = {
        ...s,
        redHand: s.redHand.map((c) => (c.unknown ? makeEstimateCard(c.id) : c)),
        blueHand: s.blueHand.map((c) => (c.unknown ? makeEstimateCard(c.id) : c)),
      }
      expect(mc.mode).toBe('estimate')
      expect(mc.samples).toBe(0)
      expect(mc.score).toBe(findBestMove(est).score)
    }
  })

  it('淺盤面（空格 ≤ 7）＋未知卡：sampled 模式，至少 1 個樣本，建議合法', () => {
    let s: GameState = {
      board: Array.from({ length: 9 }, () => ({ card: null, owner: null })),
      redHand: pick5(0),
      blueHand: [0, 1, 2, 3, 4].map(makeUnknown),
      turn: 'RED',
      rules: baseRules(),
    }
    // RED 出一張、BLUE「填值後」出一張 → 7 空格、剩 4 張未知
    s = applyMove(s, getLegalMoves(s)[0]!)
    const m = getLegalMoves(s)[0]!
    const bi = s.blueHand.findIndex((c) => c.id === m.cardId)
    s.blueHand[bi] = { ...CARD_POOL[123]!, id: m.cardId }
    s = applyMove(s, m)

    const mc = findBestMoveMonteCarlo(s, { rng: rnd, timeBudgetMs: 300 })
    expect(mc.mode).toBe('sampled')
    expect(mc.samples).toBeGreaterThanOrEqual(1)
    expect(mc.move).not.toBeNull()
    expect(s.board[mc.move!.cellIndex]!.card).toBeNull()
    expect(s.redHand.some((c) => c.id === mc.move!.cardId)).toBe(true)
  })

  it('混亂規則：restrictToCardId 在 estimate 與 sampled 模式都只回該牌落點', () => {
    // estimate 模式（空盤）
    const s1: GameState = {
      board: Array.from({ length: 9 }, () => ({ card: null, owner: null })),
      redHand: pick5(0),
      blueHand: [0, 1, 2, 3, 4].map(makeUnknown),
      turn: 'RED',
      rules: { ...baseRules(), chaos: true },
    }
    const cid1 = s1.redHand[2]!.id
    const mc1 = findBestMoveMonteCarlo(s1, { restrictToCardId: cid1, rng: rnd })
    expect(mc1.mode).toBe('estimate')
    expect(mc1.move!.cardId).toBe(cid1)

    // sampled 模式（走到 7 空格）
    let s2: GameState = {
      board: Array.from({ length: 9 }, () => ({ card: null, owner: null })),
      redHand: pick5(0),
      blueHand: [0, 1, 2, 3, 4].map(makeUnknown),
      turn: 'RED',
      rules: { ...baseRules(), chaos: true },
    }
    s2 = applyMove(s2, getLegalMoves(s2)[0]!)
    const m = getLegalMoves(s2)[0]!
    const bi = s2.blueHand.findIndex((c) => c.id === m.cardId)
    s2.blueHand[bi] = { ...CARD_POOL[200]!, id: m.cardId }
    s2 = applyMove(s2, m)
    const cid2 = s2.redHand[1]!.id
    const mc2 = findBestMoveMonteCarlo(s2, { restrictToCardId: cid2, rng: rnd, timeBudgetMs: 300 })
    expect(mc2.mode).toBe('sampled')
    expect(mc2.move!.cardId).toBe(cid2)
  })

  it('抽樣排除：excludeCards 的簽名不會出現在抽到的牌（間接驗證：候選數）', () => {
    // 卡池 3 張、排除 2 張、1 個未知槽 → 每個樣本必然填入剩下那張。
    const pool = CARD_POOL.slice(30, 33).map((c) => ({ ...c }))
    const s = randomState(0, 5)
    const oppHand = s.turn === 'RED' ? s.blueHand : s.redHand
    if (oppHand.length === 0) return
    oppHand[oppHand.length - 1] = makeUnknown(0)
    const mc = findBestMoveMonteCarlo(s, {
      pool,
      excludeCards: pool.slice(0, 2),
      rng: rnd,
      minSamples: 2,
      maxSamples: 5,
    })
    const only = pool[2]!
    const filled: GameState = {
      ...s,
      redHand: s.redHand.map((c) => (c.unknown ? { ...only, id: c.id } : c)),
      blueHand: s.blueHand.map((c) => (c.unknown ? { ...only, id: c.id } : c)),
    }
    // 所有樣本相同 → 平均分 = 對唯一可能局面的精確評分（取最佳根著手）
    const moves = getLegalMoves(filled)
    const scores = moves.map((mv) => evaluateState(applyMove(filled, mv)))
    const best = filled.turn === 'RED' ? Math.max(...scores) : Math.min(...scores)
    expect(mc.score).toBe(best)
  })
})
