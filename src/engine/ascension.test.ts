// ============================================================
// ascension.test.ts — 同類強化／弱化規則測試
// 關鍵時機：翻面判定時，加成層數＝「落子前」場上已結算的同陣營數，
// 排除正在落子的這張卡（它的加成是結算後才生效）。
// ============================================================

import { describe, it, expect } from 'vitest'
import { resolvePlacement, effectiveEdges } from './flip'
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
  type: Card['type'] = 'none',
): Card {
  return { id, name: `c${id}`, stars: 1, edges: { top, right, bottom, left }, type }
}

function emptyBoard(): Board {
  const b: Cell[] = []
  for (let i = 0; i < 9; i++) b.push({ card: null, owner: null })
  return b
}

function place(board: Board, idx: number, card: Card, owner: 'RED' | 'BLUE'): void {
  board[idx] = { card, owner }
}

describe('同類強化（Ascension）— 落子當下排除自己', () => {
  it('場上無同陣營，第一張落子用原值（8 vs 8 不翻）', () => {
    const rules = { ...baseRules(), ascension: true }
    const board = emptyBoard()
    place(board, 5, makeCard(12, 5, 5, 5, 8), 'BLUE')
    place(board, 4, makeCard(1, 5, 8, 5, 5, 'primal'), 'RED')
    resolvePlacement(board, 4, 'RED', rules)
    expect(board[5]!.owner).toBe('BLUE')
  })

  it('場上已有 1 張同陣營，落子用 +1（7+1=8 vs 8 不翻）', () => {
    const rules = { ...baseRules(), ascension: true }
    const board = emptyBoard()
    place(board, 0, makeCard(10, 5, 5, 5, 5, 'primal'), 'RED')
    place(board, 5, makeCard(12, 5, 5, 5, 8), 'BLUE')
    place(board, 4, makeCard(1, 5, 7, 5, 5, 'primal'), 'RED')
    resolvePlacement(board, 4, 'RED', rules)
    expect(board[5]!.owner).toBe('BLUE')
  })

  it('場上已有 2 張同陣營，落子 +2 翻面（7+2=9 > 8）', () => {
    const rules = { ...baseRules(), ascension: true }
    const board = emptyBoard()
    place(board, 0, makeCard(10, 5, 5, 5, 5, 'primal'), 'RED')
    place(board, 1, makeCard(11, 5, 5, 5, 5, 'primal'), 'RED')
    place(board, 5, makeCard(12, 5, 5, 5, 8), 'BLUE')
    place(board, 4, makeCard(1, 5, 7, 5, 5, 'primal'), 'RED')
    resolvePlacement(board, 4, 'RED', rules)
    expect(board[5]!.owner).toBe('RED')
  })
})

describe('落子後的顯示數值（含自己）', () => {
  it('落子後該卡顯示含自己的加成（2 張 → +2）', () => {
    const rules = { ...baseRules(), ascension: true }
    const board = emptyBoard()
    place(board, 0, makeCard(10, 8, 8, 8, 8, 'primal'), 'RED')
    place(board, 4, makeCard(1, 8, 8, 8, 8, 'primal'), 'RED')
    const e = effectiveEdges(board[4]!.card!, board, rules)
    expect(e.right).toBe(10)
  })

  it('手牌中的同陣營卡也受場上影響（顯示 +1）', () => {
    const rules = { ...baseRules(), ascension: true }
    const board = emptyBoard()
    place(board, 0, makeCard(10, 5, 5, 5, 5, 'primal'), 'RED')
    const handCard = makeCard(99, 6, 6, 6, 6, 'primal')
    const e = effectiveEdges(handCard, board, rules)
    expect(e.right).toBe(7)
  })
})

describe('同類弱化（Descension）', () => {
  it('場上已有 2 張同陣營，落子 −2（6-2=4 vs 4 不翻）', () => {
    const rules = { ...baseRules(), descension: true }
    const board = emptyBoard()
    place(board, 0, makeCard(10, 5, 5, 5, 5, 'primal'), 'RED')
    place(board, 1, makeCard(11, 5, 5, 5, 5, 'primal'), 'RED')
    place(board, 5, makeCard(12, 5, 5, 5, 4), 'BLUE')
    place(board, 4, makeCard(1, 5, 6, 5, 5, 'primal'), 'RED')
    resolvePlacement(board, 4, 'RED', rules)
    expect(board[5]!.owner).toBe('BLUE')
  })

  it('弱化下限夾 1（顯示，3 張 → 2-3 夾 1）', () => {
    const rules = { ...baseRules(), descension: true }
    const board = emptyBoard()
    place(board, 0, makeCard(10, 2, 2, 2, 2, 'primal'), 'RED')
    place(board, 1, makeCard(11, 2, 2, 2, 2, 'primal'), 'RED')
    place(board, 4, makeCard(1, 2, 2, 2, 2, 'primal'), 'RED')
    const e = effectiveEdges(board[4]!.card!, board, rules)
    expect(e.right).toBe(1)
  })
})

describe('不分敵我：敵方同陣營卡也參與加成', () => {
  it('敵方同陣營卡也算進加成層數', () => {
    const rules = { ...baseRules(), ascension: true }
    const board = emptyBoard()
    // 一張敵方蠻神 + 一張我方蠻神都在場（都算層數）。
    place(board, 0, makeCard(10, 5, 5, 5, 5, 'primal'), 'BLUE')
    place(board, 1, makeCard(11, 5, 5, 5, 5, 'primal'), 'RED')
    place(board, 5, makeCard(12, 5, 5, 5, 8), 'BLUE')
    // 我方落蠻神 right=7，場上 2 張蠻神（1 敵 1 我，排除自己）→ 7+2=9 > 8 翻。
    place(board, 4, makeCard(1, 5, 7, 5, 5, 'primal'), 'RED')
    resolvePlacement(board, 4, 'RED', rules)
    expect(board[5]!.owner).toBe('RED')
  })

  it('敵方同陣營卡的顯示數值也被加成', () => {
    const rules = { ...baseRules(), ascension: true }
    const board = emptyBoard()
    place(board, 0, makeCard(10, 8, 8, 8, 8, 'primal'), 'BLUE') // 敵方蠻神
    place(board, 1, makeCard(11, 5, 5, 5, 5, 'primal'), 'RED') // 我方蠻神
    // 場上 2 張蠻神，敵方那張顯示 8+2=10。
    const e = effectiveEdges(board[0]!.card!, board, rules)
    expect(e.top).toBe(10)
  })
})

describe('無陣營與未啟用', () => {
  it('一般卡（none）不受強化影響', () => {
    const rules = { ...baseRules(), ascension: true }
    const board = emptyBoard()
    place(board, 0, makeCard(10, 5, 5, 5, 5, 'beastman'), 'RED')
    place(board, 5, makeCard(12, 5, 5, 5, 6), 'BLUE')
    place(board, 4, makeCard(1, 5, 6, 5, 5, 'none'), 'RED')
    resolvePlacement(board, 4, 'RED', rules)
    expect(board[5]!.owner).toBe('BLUE')
  })

  it('未啟用規則時用原值（6 > 5 翻面）', () => {
    const rules = baseRules()
    const board = emptyBoard()
    place(board, 0, makeCard(10, 5, 5, 5, 5, 'beastman'), 'RED')
    place(board, 5, makeCard(11, 5, 5, 5, 5), 'BLUE')
    place(board, 4, makeCard(1, 5, 6, 5, 5, 'beastman'), 'RED')
    resolvePlacement(board, 4, 'RED', rules)
    expect(board[5]!.owner).toBe('RED')
  })
})
