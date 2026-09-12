// ============================================================
// game.test.ts — game.ts 的單元測試
// 最重要的驗證：applyMove 的「不可變性」——絕不改到原局面。
// 執行：npm run test:unit
// ============================================================

import { describe, it, expect } from 'vitest'
import { applyMove, cloneState, getLegalMoves, getWinner, isGameOver } from './game'
import type { Board, Card, Cell, EdgeValue, GameState, Hand, Rules } from './types'

// ---------- 測試輔助工具 ----------

function noRules(): Rules {
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

function makeCard(
  id: number,
  top: EdgeValue,
  right: EdgeValue,
  bottom: EdgeValue,
  left: EdgeValue,
): Card {
  return { id, name: `card${id}`, stars: 1, edges: { top, right, bottom, left } }
}

function emptyBoard(): Board {
  const board: Cell[] = []
  for (let i = 0; i < 9; i++) board.push({ card: null, owner: null })
  return board
}

// 造一個基本起始局面：紅方先手，雙方各持指定手牌。
function makeState(redHand: Hand, blueHand: Hand, rules = noRules()): GameState {
  return {
    board: emptyBoard(),
    redHand,
    blueHand,
    turn: 'RED',
    rules,
  }
}

// ---------- 不可變性（最重要） ----------

describe('applyMove — 不可變性', () => {
  it('套用一手後，原局面完全不變', () => {
    const red = [makeCard(1, 5, 5, 5, 5)]
    const blue = [makeCard(2, 3, 3, 3, 3)]
    const state = makeState(red, blue)

    const before = JSON.stringify(state)
    applyMove(state, { cardId: 1, cellIndex: 4 })
    const after = JSON.stringify(state)

    expect(after).toBe(before) // 原 state 一字未改
  })

  it('回傳的是全新局面（棋盤與原局面不同參照）', () => {
    const state = makeState([makeCard(1, 5, 5, 5, 5)], [makeCard(2, 3, 3, 3, 3)])
    const next = applyMove(state, { cardId: 1, cellIndex: 0 })

    expect(next).not.toBe(state)
    expect(next.board).not.toBe(state.board)
    expect(next.board[0]!.card).not.toBeNull()
    expect(state.board[0]!.card).toBeNull() // 原局面那格仍是空的
  })
})

// ---------- cloneState ----------

describe('cloneState', () => {
  it('改動複製品不影響原局面', () => {
    const state = makeState([makeCard(1, 5, 5, 5, 5)], [])
    const clone = cloneState(state)

    clone.board[0]!.owner = 'BLUE'
    clone.redHand.pop()

    expect(state.board[0]!.owner).toBeNull()
    expect(state.redHand.length).toBe(1)
  })
})

// ---------- applyMove 行為 ----------

describe('applyMove — 行為', () => {
  it('出的卡從手牌移除並放上棋盤、歸屬正確', () => {
    const state = makeState([makeCard(1, 5, 5, 5, 5)], [makeCard(2, 3, 3, 3, 3)])
    const next = applyMove(state, { cardId: 1, cellIndex: 4 })

    expect(next.redHand.length).toBe(0)
    expect(next.board[4]!.card!.id).toBe(1)
    expect(next.board[4]!.owner).toBe('RED')
  })

  it('套用後換手', () => {
    const state = makeState([makeCard(1, 5, 5, 5, 5)], [makeCard(2, 3, 3, 3, 3)])
    const next = applyMove(state, { cardId: 1, cellIndex: 4 })
    expect(next.turn).toBe('BLUE')
  })

  it('放下強卡會翻掉相鄰弱敵卡', () => {
    const state = makeState([makeCard(1, 9, 9, 9, 9)], [makeCard(2, 1, 1, 1, 1)])
    // 先讓藍方在 index 5 放一張弱卡。
    state.board[5] = { card: makeCard(2, 1, 1, 1, 1), owner: 'BLUE' }

    // 紅方在 index 4 放強卡，right=9 vs 藍方 left=1 → 翻面。
    const next = applyMove(state, { cardId: 1, cellIndex: 4 })
    expect(next.board[5]!.owner).toBe('RED')
  })

  it('出不存在的卡會丟錯', () => {
    const state = makeState([makeCard(1, 5, 5, 5, 5)], [])
    expect(() => applyMove(state, { cardId: 999, cellIndex: 0 })).toThrow()
  })

  it('放到已占用的格子會丟錯', () => {
    const state = makeState([makeCard(1, 5, 5, 5, 5)], [])
    state.board[0] = { card: makeCard(2, 1, 1, 1, 1), owner: 'BLUE' }
    expect(() => applyMove(state, { cardId: 1, cellIndex: 0 })).toThrow()
  })
})

// ---------- getLegalMoves ----------

describe('getLegalMoves', () => {
  it('空棋盤、手牌 2 張 → 2 卡 × 9 格 = 18 手', () => {
    const state = makeState(
      [makeCard(1, 5, 5, 5, 5), makeCard(2, 4, 4, 4, 4)],
      [makeCard(3, 3, 3, 3, 3)],
    )
    expect(getLegalMoves(state).length).toBe(18)
  })

  it('部分格子已占用時，空格減少', () => {
    const state = makeState([makeCard(1, 5, 5, 5, 5)], [])
    state.board[0] = { card: makeCard(9, 1, 1, 1, 1), owner: 'BLUE' }
    state.board[1] = { card: makeCard(8, 1, 1, 1, 1), owner: 'BLUE' }
    // 1 張卡 × 7 個空格 = 7 手。
    expect(getLegalMoves(state).length).toBe(7)
  })

  it('Order 規則下只能出第一張卡', () => {
    const rules = { ...noRules(), order: true }
    const state = makeState([makeCard(1, 5, 5, 5, 5), makeCard(2, 4, 4, 4, 4)], [], rules)
    // 只有第一張可出 × 9 格 = 9 手。
    expect(getLegalMoves(state).length).toBe(9)
  })
})

// ---------- 勝負判定 ----------

describe('isGameOver / getWinner', () => {
  it('棋盤未滿時遊戲未結束', () => {
    const state = makeState([makeCard(1, 5, 5, 5, 5)], [])
    expect(isGameOver(state)).toBe(false)
  })

  it('棋盤填滿時遊戲結束', () => {
    const state = makeState([], [])
    for (let i = 0; i < 9; i++) {
      state.board[i] = { card: makeCard(i, 5, 5, 5, 5), owner: 'RED' }
    }
    expect(isGameOver(state)).toBe(true)
  })

  it('擁有較多卡的一方獲勝（含手牌計分）', () => {
    const state = makeState([], [])
    // 棋盤上紅 5、藍 4。
    for (let i = 0; i < 5; i++) {
      state.board[i] = { card: makeCard(i, 5, 5, 5, 5), owner: 'RED' }
    }
    for (let i = 5; i < 9; i++) {
      state.board[i] = { card: makeCard(i, 5, 5, 5, 5), owner: 'BLUE' }
    }
    expect(getWinner(state)).toBe('RED')
  })

  it('卡數相同為平手（回傳 null）', () => {
    // 真正的平手：棋盤 9 張是奇數，盤面本身不可能對半分，
    // 平手必來自「先手方棋盤少 1 張，但手上剩的 1 張補回來」。
    // 這裡擺：棋盤紅 4、藍 5，紅方手上剩 1 張 → 紅 4+1=5、藍 5，平手。
    const state = makeState([makeCard(99, 5, 5, 5, 5)], [])
    for (let i = 0; i < 4; i++) {
      state.board[i] = { card: makeCard(i, 5, 5, 5, 5), owner: 'RED' }
    }
    for (let i = 4; i < 9; i++) {
      state.board[i] = { card: makeCard(i, 5, 5, 5, 5), owner: 'BLUE' }
    }
    // 紅：棋盤 4 + 手牌 1 = 5；藍：棋盤 5 + 手牌 0 = 5 → 平手。
    expect(getWinner(state)).toBeNull()
  })
})
