// ============================================================
// selfplay.test.ts — 自我對弈整合測試
// 讓引擎用 findBestMove 自己跟自己下完一整局，
// 印出每一手與最終比分。同時驗證：
//   - 一整局跑完不出錯（接合處整合測試）
//   - 每手都是合法手、棋盤最終填滿
// 執行：npm run test:unit（會在輸出看到對弈過程）
// ============================================================

import { describe, it, expect } from 'vitest'
import { findBestMove } from './minimax'
import { applyMove, isGameOver, getWinner } from './game'
import type { Board, Card, Cell, EdgeValue, GameState, Hand, Rules } from './types'

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
  name: string,
  top: EdgeValue,
  right: EdgeValue,
  bottom: EdgeValue,
  left: EdgeValue,
): Card {
  return { id, name, stars: 1, edges: { top, right, bottom, left } }
}

function emptyBoard(): Board {
  const board: Cell[] = []
  for (let i = 0; i < 9; i++) board.push({ card: null, owner: null })
  return board
}

// 把棋盤印成 3x3，每格顯示「持有者首字母 + 卡名」或空格。
function renderBoard(board: Board): string {
  const cellStr = (c: Cell): string => {
    if (c.card === null) return '   .   '
    const o = c.owner === 'RED' ? 'R' : 'B'
    const name = c.card.name.slice(0, 4).padEnd(4, ' ')
    return ` ${o}:${name}`
  }
  let out = ''
  for (let row = 0; row < 3; row++) {
    const cells = [0, 1, 2].map((col) => cellStr(board[row * 3 + col]!))
    out += cells.join('|') + '\n'
    if (row < 2) out += '-------+-------+-------\n'
  }
  return out
}

describe('自我對弈', () => {
  it('引擎自己對弈一整局，印出過程並正確結束', () => {
    // 雙方各 5 張卡（數值隨意設計，讓對局有翻面變化）。
    const red: Hand = [
      makeCard(1, '陸行鳥', 5, 5, 4, 6),
      makeCard(2, '莫古力', 7, 3, 5, 5),
      makeCard(3, '仙人薔薇', 4, 8, 6, 2),
      makeCard(4, '骷髏', 6, 4, 7, 5),
      makeCard(5, '哥布林', 3, 6, 5, 7),
    ]
    const blue: Hand = [
      makeCard(11, '巨蟻', 6, 4, 5, 5),
      makeCard(12, '寶箱怪', 5, 7, 4, 6),
      makeCard(13, '蜥蜴', 8, 2, 6, 4),
      makeCard(14, '食人魔', 4, 6, 5, 7),
      makeCard(15, '飛龍', 7, 5, 6, 3),
    ]

    let state: GameState = {
      board: emptyBoard(),
      redHand: red,
      blueHand: blue,
      turn: 'RED',
      rules: noRules(),
    }

    console.log('\n=== 幻卡自我對弈開始（紅方先手）===\n')

    let ply = 0
    while (!isGameOver(state)) {
      ply++
      const mover = state.turn
      const t0 = performance.now()
      const result = findBestMove(state)
      const ms = (performance.now() - t0).toFixed(1)

      expect(result.move).not.toBeNull()
      state = applyMove(state, result.move!)

      console.log(
        `第 ${ply} 手：${mover} 出卡 id=${result.move!.cardId} → 格 ${result.move!.cellIndex}` +
          `（搜尋分數 ${result.score}，耗時 ${ms}ms）`,
      )
      console.log(renderBoard(state.board))
    }

    // 終局統計。
    let redCount = state.redHand.length
    let blueCount = state.blueHand.length
    for (const c of state.board) {
      if (c.owner === 'RED') redCount++
      else if (c.owner === 'BLUE') blueCount++
    }
    const winner = getWinner(state)

    console.log('=== 對弈結束 ===')
    console.log(`最終比分　紅 ${redCount} : ${blueCount} 藍`)
    console.log(`勝方：${winner ?? '平手'}\n`)

    // 整合驗證：一定走滿 9 手、棋盤填滿、雙方手牌出清。
    expect(ply).toBe(9)
    expect(isGameOver(state)).toBe(true)
    expect(redCount + blueCount).toBe(10) // 9 格 + 先手剩 1 張手牌
  })
})
