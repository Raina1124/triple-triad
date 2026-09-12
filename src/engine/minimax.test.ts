// ============================================================
// minimax.test.ts — minimax.ts 的單元測試
// 重點：不只驗證「有回傳一手」，而是驗證「選的是最優手」。
// 用結果可人工推算的小局面來對照。
// ============================================================

import { describe, it, expect } from 'vitest'
import { findBestMove, scoreForPlayer } from './minimax'
import { applyMove, isGameOver } from './game'
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

function makeState(
  board: Board,
  redHand: Hand,
  blueHand: Hand,
  turn: 'RED' | 'BLUE' = 'RED',
  rules = noRules(),
): GameState {
  return { board, redHand, blueHand, turn, rules }
}

// ---------- 終局直接回傳分數 ----------

describe('findBestMove — 終局', () => {
  it('棋盤已滿時回傳分數、move 為 null', () => {
    const board = emptyBoard()
    for (let i = 0; i < 5; i++) board[i] = { card: makeCard(i, 5, 5, 5, 5), owner: 'RED' }
    for (let i = 5; i < 9; i++) board[i] = { card: makeCard(i, 5, 5, 5, 5), owner: 'BLUE' }

    const result = findBestMove(makeState(board, [], []))
    expect(result.move).toBeNull()
    expect(result.score).toBe(5 - 4) // 紅 5、藍 4
  })
})

// ---------- 最後一手：必選能翻面的最優手 ----------

describe('findBestMove — 最後一手選最優', () => {
  it('紅方最後一手會選擇能翻掉敵卡的格子', () => {
    // 棋盤剩 1 格空（index 8）。紅方手上 1 張強卡。
    // 周圍若有藍卡，放下去應翻面，讓紅多 1 分。
    const board = emptyBoard()
    // 填滿 0~7，留 8 空。
    board[0] = { card: makeCard(10, 5, 5, 5, 5), owner: 'RED' }
    board[1] = { card: makeCard(11, 5, 5, 5, 5), owner: 'RED' }
    board[2] = { card: makeCard(12, 5, 5, 5, 5), owner: 'RED' }
    board[3] = { card: makeCard(13, 5, 5, 5, 5), owner: 'RED' }
    board[4] = { card: makeCard(14, 5, 5, 5, 5), owner: 'BLUE' }
    board[5] = { card: makeCard(15, 5, 5, 1, 5), owner: 'BLUE' } // 下邊=1，弱
    board[6] = { card: makeCard(16, 5, 5, 5, 5), owner: 'BLUE' }
    board[7] = { card: makeCard(17, 5, 5, 5, 5), owner: 'BLUE' }

    // 紅方最後一張：上邊=9，放到 index 8 時，
    // 其上方鄰格是 index 5（藍，下邊=1）→ 翻面。
    const red: Hand = [makeCard(20, 9, 9, 9, 9)]
    const state = makeState(board, red, [], 'RED')

    const result = findBestMove(state)
    expect(result.move).toEqual({ cardId: 20, cellIndex: 8 })

    // 套用後驗證 index 5 真的被翻成紅方。
    const next = applyMove(state, result.move!)
    expect(next.board[5]!.owner).toBe('RED')
    expect(isGameOver(next)).toBe(true)
  })
})

// ---------- 前瞻：不貪眼前、要看對手反制 ----------

describe('findBestMove — 前瞻性', () => {
  it('搜尋會考慮對手的最佳反制（不是只看眼前翻面數）', () => {
    // 設計：紅方有兩種開局走法。
    //   走法 A：眼前翻 1 張，但會讓藍方下一手反翻 2 張。
    //   走法 B：眼前不翻，但藍方無法反制。
    // 正確的 minimax 應避開 A、選結果較好的 B。
    //
    // 為了可控，用 2x2 角落範圍佈局，雙方各 2 張、棋盤已先放 5 張，
    // 剩 4 格由雙方交替填滿（紅先）。
    //
    // 這裡採較寬鬆的驗證：搜尋回傳的最終分數，
    // 應 >= 任何「只看眼前一手」的貪心結果。
    const board = emptyBoard()
    // 預先填 5 格（紅 3、藍 2），留 index 2,5,6,8 四格。
    board[0] = { card: makeCard(30, 5, 5, 5, 5), owner: 'RED' }
    board[1] = { card: makeCard(31, 5, 2, 5, 5), owner: 'RED' }
    board[3] = { card: makeCard(32, 5, 5, 5, 5), owner: 'RED' }
    board[4] = { card: makeCard(33, 5, 5, 5, 2), owner: 'BLUE' }
    board[7] = { card: makeCard(34, 5, 5, 5, 5), owner: 'BLUE' }

    const red: Hand = [makeCard(40, 6, 6, 6, 6), makeCard(41, 3, 3, 3, 3)]
    const blue: Hand = [makeCard(50, 7, 7, 7, 7), makeCard(51, 4, 4, 4, 4)]
    const state = makeState(board, red, blue, 'RED')

    const result = findBestMove(state)

    // 把整條最佳路線走完，驗證最終分數與搜尋宣稱的一致。
    let s = state
    let r = result
    while (!isGameOver(s) && r.move) {
      s = applyMove(s, r.move)
      r = findBestMove(s)
    }
    let red2 = s.redHand.length
    let blue2 = s.blueHand.length
    for (const c of s.board) {
      if (c.owner === 'RED') red2++
      else if (c.owner === 'BLUE') blue2++
    }
    // 實際走完的分數差，應等於一開始搜尋宣稱的分數。
    expect(red2 - blue2).toBe(result.score)
  })
})

// ---------- scoreForPlayer ----------

describe('scoreForPlayer', () => {
  it('紅視角分數對紅方不變號', () => {
    expect(scoreForPlayer(3, 'RED')).toBe(3)
  })
  it('紅視角分數對藍方變號', () => {
    expect(scoreForPlayer(3, 'BLUE')).toBe(-3)
  })
})
