// ============================================================
// sameplus.test.ts — Same / Plus / Combo 規則測試
// 針對容易出錯的點設計：
//   - Same 需兩邊以上相符
//   - Plus 比的是「和」
//   - 觸發需至少一張敵卡
//   - Combo 只從 Same/Plus 種子展開，且用基本比大小
// ============================================================

import { describe, it, expect } from 'vitest'
import { resolvePlacement } from './flip'
import type { Board, Card, Cell, EdgeValue, Rules } from './types'

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

function makeCard(
  id: number,
  top: EdgeValue,
  right: EdgeValue,
  bottom: EdgeValue,
  left: EdgeValue,
): Card {
  return { id, name: `c${id}`, stars: 1, edges: { top, right, bottom, left } }
}

function emptyBoard(): Board {
  const b: Cell[] = []
  for (let i = 0; i < 9; i++) b.push({ card: null, owner: null })
  return b
}

// 把卡放到指定格（設定 owner），方便佈局。
function place(board: Board, idx: number, card: Card, owner: 'RED' | 'BLUE'): void {
  board[idx] = { card, owner }
}

// ---------- Same 基本觸發 ----------

describe('Same 規則', () => {
  it('兩邊數字相同且含敵卡 → 兩張都翻', () => {
    const rules = { ...baseRules(), same: true }
    const board = emptyBoard()
    // 中心(4)放紅卡：上=5、右=5。
    // 上鄰(1)藍卡，其下=5 → mine(top5)==theirs(bottom5) 成立。
    // 右鄰(5)藍卡，其左=5 → mine(right5)==theirs(left5) 成立。
    // 兩組相符、皆敵卡 → 兩張都翻。
    place(board, 1, makeCard(11, 9, 9, 5, 9), 'BLUE') // bottom=5
    place(board, 5, makeCard(12, 9, 9, 9, 5), 'BLUE') // left=5
    place(board, 4, makeCard(1, 5, 5, 9, 9), 'RED')

    const flipped = resolvePlacement(board, 4, 'RED', rules)
    expect(board[1]!.owner).toBe('RED')
    expect(board[5]!.owner).toBe('RED')
    expect(flipped.sort()).toEqual([1, 5])
  })

  it('只有一邊相同 → 不觸發 Same（且基本比大小也不翻）', () => {
    const rules = { ...baseRules(), same: true }
    const board = emptyBoard()
    // 只有上鄰一組 mine==theirs；右鄰故意做成不相等且我方較小。
    place(board, 1, makeCard(11, 9, 9, 5, 9), 'BLUE') // bottom=5，與 top5 相同
    place(board, 5, makeCard(12, 9, 9, 9, 8), 'BLUE') // left=8，與 right5 不同且較大
    place(board, 4, makeCard(1, 5, 5, 2, 2), 'RED')

    resolvePlacement(board, 4, 'RED', rules)
    // Same 沒湊到兩組 → 不翻；基本比大小：right5<left8 也不翻。
    expect(board[1]!.owner).toBe('BLUE')
    expect(board[5]!.owner).toBe('BLUE')
  })

  it('兩組相同但全是我方卡 → 不觸發', () => {
    const rules = { ...baseRules(), same: true }
    const board = emptyBoard()
    place(board, 1, makeCard(11, 9, 9, 5, 9), 'RED') // 我方
    place(board, 5, makeCard(12, 9, 9, 9, 5), 'RED') // 我方
    place(board, 4, makeCard(1, 5, 5, 9, 9), 'RED')

    const flipped = resolvePlacement(board, 4, 'RED', rules)
    expect(flipped.length).toBe(0)
  })
})

// ---------- Plus ----------

describe('Plus 規則', () => {
  it('兩邊和相同且含敵卡 → 翻面', () => {
    const rules = { ...baseRules(), plus: true }
    const board = emptyBoard()
    // 中心放紅卡 top=2、right=3。
    // 上鄰 bottom=8 → 和=10；右鄰 left=7 → 和=10。兩組和相同。
    place(board, 1, makeCard(11, 9, 9, 8, 9), 'BLUE') // bottom=8
    place(board, 5, makeCard(12, 9, 9, 9, 7), 'BLUE') // left=7
    place(board, 4, makeCard(1, 2, 3, 9, 9), 'RED')

    const flipped = resolvePlacement(board, 4, 'RED', rules)
    expect(board[1]!.owner).toBe('RED')
    expect(board[5]!.owner).toBe('RED')
    expect(flipped.sort()).toEqual([1, 5])
  })

  it('和不相等 → 不觸發 Plus', () => {
    const rules = { ...baseRules(), plus: true }
    const board = emptyBoard()
    place(board, 1, makeCard(11, 9, 9, 8, 9), 'BLUE') // 和=2+8=10
    place(board, 5, makeCard(12, 9, 9, 9, 6), 'BLUE') // 和=3+6=9
    place(board, 4, makeCard(1, 2, 3, 2, 2), 'RED') // 較小，基本也不翻

    resolvePlacement(board, 4, 'RED', rules)
    expect(board[1]!.owner).toBe('BLUE')
    expect(board[5]!.owner).toBe('BLUE')
  })
})

// ---------- Combo 連鎖 ----------

describe('Combo 連鎖（自動機制）', () => {
  it('Same 奪取的卡會自動用基本比大小再翻鄰居', () => {
    // Combo 是自動機制：只要有 Same/Plus，奪取的卡就會連鎖。
    const rules = { ...baseRules(), same: true }
    const board = emptyBoard()
    // 中心紅卡 top=5、left=5：與上鄰(1)、左鄰(3)各成一組 Same。
    place(board, 1, makeCard(11, 5, 9, 5, 9), 'BLUE') // bottom=5
    place(board, 3, makeCard(13, 9, 5, 9, 9), 'BLUE') // right=5
    place(board, 4, makeCard(1, 5, 9, 9, 5), 'RED')
    // (0) 在 (1) 左邊：(1) 被 Same 翻後，(1).left=9 對 (0).right=1 → 連鎖翻。
    place(board, 0, makeCard(20, 9, 1, 9, 9), 'BLUE')

    const flipped = resolvePlacement(board, 4, 'RED', rules)
    expect(board[1]!.owner).toBe('RED') // Same
    expect(board[3]!.owner).toBe('RED') // Same
    expect(board[0]!.owner).toBe('RED') // Combo 連鎖
    expect(flipped).toContain(0)
  })

  it('純基本翻面（無 Same/Plus）不會觸發連鎖', () => {
    // 沒有 Same/Plus 時，基本翻面奪取的卡不引發連鎖。
    const rules = baseRules()
    const board = emptyBoard()
    // 中心紅卡 right=8 翻掉右鄰(5)藍卡。
    place(board, 5, makeCard(12, 9, 9, 9, 3), 'BLUE') // left=3，被翻
    place(board, 4, makeCard(1, 5, 8, 5, 5), 'RED')
    // (2) 在 (5) 上方：若有連鎖，(5).top 可能翻 (2)；驗證它「不」被翻。
    place(board, 2, makeCard(30, 9, 9, 1, 9), 'BLUE')
    const before = board[2]!.owner

    resolvePlacement(board, 4, 'RED', rules)
    expect(board[5]!.owner).toBe('RED') // 基本翻面
    expect(board[2]!.owner).toBe(before) // 未被連鎖
  })
})

// ---------- 規則全關時等同基本翻面 ----------

describe('規則全關', () => {
  it('Same/Plus/Combo 全關時，只做基本翻面', () => {
    const rules = baseRules()
    const board = emptyBoard()
    place(board, 5, makeCard(12, 9, 9, 9, 3), 'BLUE') // left=3
    place(board, 4, makeCard(1, 5, 8, 5, 5), 'RED') // right=8 > 3 → 翻

    const flipped = resolvePlacement(board, 4, 'RED', rules)
    expect(board[5]!.owner).toBe('RED')
    expect(flipped).toContain(5)
  })
})
