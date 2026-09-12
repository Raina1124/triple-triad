// ============================================================
// flip.test.ts — 王牌殺手（Fallen Ace）判定
//
// 這個檔案是為了一個實際踩到的 bug 而建：原本把王牌殺手寫成
// 「把 1↔10 的大小反轉」，導致 A(10) 當攻擊方翻不動盤面上的 1。
// 正確語意是「多開一個例外」——1 能翻 A，但 A 照樣能用 10 > 1 翻 1，
// 所以這組對撞永遠是後出的那張（攻擊方）獲勝。
// ============================================================

import { describe, expect, it } from 'vitest'
import { attackerWins, resolvePlacement } from './flip'
import type { Board, Card, EdgeValue, Rules } from './types'

function rules(over: Partial<Rules> = {}): Rules {
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
    ...over,
  }
}

const card = (top: EdgeValue, right: EdgeValue, bottom: EdgeValue, left: EdgeValue): Card => ({
  id: Math.floor(Math.random() * 1e9),
  name: 'T',
  stars: 1,
  edges: { top, right, bottom, left },
  type: 'none',
})

describe('attackerWins：1 與 A(10) 對撞', () => {
  it('王牌殺手關閉：照一般大小，10 勝 1、1 不勝 10', () => {
    const r = rules()
    expect(attackerWins(10, 1, r)).toBe(true)
    expect(attackerWins(1, 10, r)).toBe(false)
  })

  it('王牌殺手開啟：兩個方向都是攻擊方勝（1 剋 A，A 也剋 1）', () => {
    const r = rules({ fallenAce: true })
    expect(attackerWins(1, 10, r)).toBe(true)
    // 這一條就是原本的 bug：A 當攻擊方時翻不動 1。
    expect(attackerWins(10, 1, r)).toBe(true)
  })

  it('王牌殺手＋逆轉：仍是兩個方向都攻擊方勝', () => {
    const r = rules({ fallenAce: true, reverse: true })
    expect(attackerWins(1, 10, r)).toBe(true)
    expect(attackerWins(10, 1, r)).toBe(true)
  })

  it('只有逆轉（沒王牌殺手）：小的勝，1 勝 10、10 不勝 1', () => {
    const r = rules({ reverse: true })
    expect(attackerWins(1, 10, r)).toBe(true)
    expect(attackerWins(10, 1, r)).toBe(false)
  })
})

describe('attackerWins：王牌殺手不得影響其他數值組合', () => {
  it('98 組非 1-vs-10 的對撞，開關王牌殺手結果完全相同', () => {
    for (let a = 1; a <= 10; a++) {
      for (let d = 1; d <= 10; d++) {
        if ((a === 1 && d === 10) || (a === 10 && d === 1)) continue
        const av = a as EdgeValue
        const dv = d as EdgeValue
        expect(attackerWins(av, dv, rules({ fallenAce: true }))).toBe(attackerWins(av, dv, rules()))
        expect(attackerWins(av, dv, rules({ fallenAce: true, reverse: true }))).toBe(
          attackerWins(av, dv, rules({ reverse: true })),
        )
      }
    }
  })
})

// 盤面實測：攻擊方放在中央(4)，唯一鄰居在上方(1)，其餘格空著，
// 所以只會發生「攻擊方 top vs 防守方 bottom」這一次對撞。
function placeAgainst(attacker: Card, defender: Card, r: Rules): number[] {
  const board: Board = Array.from({ length: 9 }, () => ({ card: null, owner: null }))
  board[1] = { card: defender, owner: 'BLUE' }
  board[4] = { card: attacker, owner: 'RED' }
  return resolvePlacement(board, 4, 'RED', r)
}

describe('盤面實測：後出的 A 要能翻掉盤面上的 1', () => {
  it('王牌殺手開啟，後出 A(top=10) 對上盤面 1(bottom=1) → 翻面', () => {
    // 這正是回報的情境：對手先放 1，我後放 A，A 應該吃掉那張 1。
    const flipped = placeAgainst(card(10, 5, 5, 5), card(5, 5, 1, 5), rules({ fallenAce: true }))
    expect(flipped).toContain(1)
  })

  it('王牌殺手開啟，後出 1(top=1) 對上盤面 A(bottom=10) → 翻面', () => {
    const flipped = placeAgainst(card(1, 5, 5, 5), card(5, 5, 10, 5), rules({ fallenAce: true }))
    expect(flipped).toContain(1)
  })

  it('王牌殺手關閉，後出 1 對上盤面 A → 不翻面', () => {
    const flipped = placeAgainst(card(1, 5, 5, 5), card(5, 5, 10, 5), rules())
    expect(flipped).not.toContain(1)
  })

  it('王牌殺手關閉，後出 A 對上盤面 1 → 照常翻面', () => {
    const flipped = placeAgainst(card(10, 5, 5, 5), card(5, 5, 1, 5), rules())
    expect(flipped).toContain(1)
  })
})

describe('王牌殺手不影響 Same/Plus 的判定', () => {
  it('Same：1 與 1 相等成立，與王牌殺手無關', () => {
    // 中央(4) 的 top=1、left=1；上方(1) 的 bottom=1、左方(3) 的 right=1
    // → 兩邊皆 Same 成立，兩張敵卡都被奪取。
    const board: Board = Array.from({ length: 9 }, () => ({ card: null, owner: null }))
    board[1] = { card: card(5, 5, 1, 5), owner: 'BLUE' }
    board[3] = { card: card(5, 1, 5, 5), owner: 'BLUE' }
    board[4] = { card: card(1, 5, 5, 1), owner: 'RED' }
    const withFa = resolvePlacement(
      board.map((c) => ({ ...c })),
      4,
      'RED',
      rules({ same: true, fallenAce: true }),
    )
    const withoutFa = resolvePlacement(
      board.map((c) => ({ ...c })),
      4,
      'RED',
      rules({ same: true }),
    )
    expect(withFa.sort()).toEqual([1, 3])
    expect(withoutFa.sort()).toEqual([1, 3])
  })
})
