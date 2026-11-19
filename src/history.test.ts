// ============================================================
// history.test.ts — 「上一步」收回落子
//
// 最重要的性質：落子 → 收回，局面要跟落子前一模一樣，
// 不管那一手引發了多少翻面（同數／加算／連鎖／強化弱化都算）。
// 用引擎實際下完整局、再一路收回到開局來驗證。
// ============================================================

import { describe, expect, it } from 'vitest'
import { CARD_POOL } from './engine/card-pool'
import { applyMove, getLegalMoves, isGameOver } from './engine/game'
import { recordPlacement, undoPlacement } from './history'
import type { PlacementRecord } from './history'
import type { Board, Card, GameState, Rules } from './engine/types'

// 固定種子亂數，求重現。
let seed = 20261117
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const ri = (n: number) => Math.floor(rnd() * n)

function randomRules(): Rules {
  const r: Rules = {
    same: rnd() < 0.5,
    plus: rnd() < 0.5,
    combo: false,
    reverse: rnd() < 0.3,
    fallenAce: rnd() < 0.3,
    order: rnd() < 0.3,
    chaos: false,
    threeOpen: false,
    allOpen: false,
    ascension: false,
    descension: false,
    swap: false,
  }
  const t = rnd()
  if (t < 0.25) r.ascension = true
  else if (t < 0.5) r.descension = true
  return r
}

// 紅方 id 1~5、藍方 id -1~-5（跟 App.vue 一樣：我方正數、未知卡負數）。
function deal(): { red: Card[]; blue: Card[] } {
  const pick = (id: number): Card => ({ ...CARD_POOL[ri(CARD_POOL.length)]!, id })
  return {
    red: [1, 2, 3, 4, 5].map(pick),
    blue: [-1, -2, -3, -4, -5].map(pick),
  }
}

function newGame(): { state: GameState; redOrig: Card[]; blueOrig: Card[] } {
  const { red, blue } = deal()
  return {
    state: {
      board: Array.from({ length: 9 }, () => ({ card: null, owner: null })),
      redHand: red,
      blueHand: blue,
      turn: rnd() < 0.5 ? 'RED' : 'BLUE',
      rules: randomRules(),
    },
    redOrig: [...red],
    blueOrig: [...blue],
  }
}

function undo(
  state: GameState,
  rec: PlacementRecord,
  redOrig: Card[],
  blueOrig: Card[],
): GameState {
  const r = undoPlacement(rec, state.board, state.redHand, state.blueHand, redOrig, blueOrig)!
  return { ...state, board: r.board, redHand: r.redHand, blueHand: r.blueHand, turn: rec.player }
}

// 只比局面本身（規則整局不變）。
const view = (s: GameState) => ({
  board: s.board,
  redHand: s.redHand,
  blueHand: s.blueHand,
  turn: s.turn,
})

describe('落子後收回 = 回到落子前', () => {
  it('隨機規則下完整局，再一路收回到開局，每一步都與當時的局面相同', () => {
    let flippedSomething = 0
    for (let g = 0; g < 200; g++) {
      const { state: start, redOrig, blueOrig } = newGame()
      const before: GameState[] = []
      const records: PlacementRecord[] = []
      let s = start
      while (!isGameOver(s)) {
        const moves = getLegalMoves(s)
        const m = moves[ri(moves.length)]!
        before.push(s)
        records.push(recordPlacement(s.board, s.turn, m.cardId))
        const next = applyMove(s, m)
        // 這一手有沒有翻面（確認測試真的涵蓋到翻面還原）。
        if (s.board.some((c, i) => c.card && c.owner !== next.board[i]!.owner)) flippedSomething++
        s = next
      }
      expect(records).toHaveLength(9)
      while (records.length > 0) {
        s = undo(s, records.pop()!, redOrig, blueOrig)
        expect(view(s)).toEqual(view(before.pop()!))
      }
    }
    // 200 局 × 9 手，有翻面的手數應該很多；太少代表測試沒測到重點。
    expect(flippedSomething).toBeGreaterThan(300)
  })
})

describe('落子之後又改過東西，收回時要留著', () => {
  // 開一局、紅方先下一手到中央，回傳下完的局面與記錄。
  function oneMove() {
    const { state, redOrig, blueOrig } = newGame()
    const s0: GameState = { ...state, turn: 'RED', rules: { ...state.rules, order: false } }
    const cardId = s0.redHand[2]!.id
    const rec = recordPlacement(s0.board, 'RED', cardId)
    const s1 = applyMove(s0, { cardId, cellIndex: 4 })
    return { s0, s1, rec, cardId, redOrig, blueOrig }
  }

  it('棋盤上那張卡的數值被修正過 → 回到手牌的是修正後的卡', () => {
    const { s1, rec, cardId, redOrig, blueOrig } = oneMove()
    const fixed: Card = {
      ...s1.board[4]!.card!,
      name: '修正後',
      edges: { top: 9, right: 9, bottom: 9, left: 9 },
    }
    const board: Board = s1.board.map((c, i) => (i === 4 ? { card: fixed, owner: c.owner } : c))
    const r = undoPlacement(rec, board, s1.redHand, s1.blueHand, redOrig, blueOrig)!
    expect(r.redHand.find((c) => c.id === cardId)).toEqual(fixed)
    expect(r.board.every((c) => c.card === null)).toBe(true)
  })

  it('那張卡被「調換位置」搬到別格 → 照樣找得到並收回', () => {
    const { s1, rec, cardId, redOrig, blueOrig } = oneMove()
    const board: Board = s1.board.map((c) => ({ ...c }))
    board[8] = board[4]!
    board[4] = { card: null, owner: null }
    const r = undoPlacement(rec, board, s1.redHand, s1.blueHand, redOrig, blueOrig)!
    expect(r.board.every((c) => c.card === null)).toBe(true)
    expect(r.redHand.map((c) => c.id)).toContain(cardId)
  })

  it('卡回到它原本的手牌槽位（秩序規則靠這個順序）', () => {
    const { s0, s1, rec, redOrig, blueOrig } = oneMove()
    const r = undoPlacement(rec, s1.board, s1.redHand, s1.blueHand, redOrig, blueOrig)!
    expect(r.redHand.map((c) => c.id)).toEqual(s0.redHand.map((c) => c.id))
    expect(r.blueHand).toBe(s1.blueHand) // 沒出牌的那一方原封不動
  })

  it('落子後手牌槽位被對調過 → 照對調後的槽位順序放回', () => {
    const { s1, rec, cardId, redOrig, blueOrig } = oneMove()
    // 對調槽位 0 與 2（2 是已出的那張）：開局槽位順序變成 [c2, c1, c0, c3, c4]。
    const swapped = [redOrig[2]!, redOrig[1]!, redOrig[0]!, redOrig[3]!, redOrig[4]!]
    const live = swapped.filter((o) => o.id !== cardId)
    const r = undoPlacement(rec, s1.board, live, s1.blueHand, swapped, blueOrig)!
    expect(r.redHand.map((c) => c.id)).toEqual(swapped.map((c) => c.id))
  })

  it('記錄的卡不在棋盤上 → 回 null，不動局面', () => {
    const { s1, rec, redOrig, blueOrig } = oneMove()
    const bogus = { ...rec, cardId: 999 }
    expect(undoPlacement(bogus, s1.board, s1.redHand, s1.blueHand, redOrig, blueOrig)).toBeNull()
  })
})
