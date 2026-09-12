// ============================================================
// opponent-model.test.ts — 對手牌組模型
//
// 這裡測的是「未知牌從哪裡抽」的正確性，不涉及搜尋。
// 重點三件事：
//   1. uniform 必須與改動前的內建 draw 逐輪一致（不得回歸）。
//   2. NPC 牌組資料與卡池對得起來，且固定牌必抽、已亮牌不外洩。
//   3. 玩家模型抽出的牌永遠符合遊戲的牌組合法性，且填充位是強 3★。
// ============================================================

import { describe, expect, it } from 'vitest'
import { CARD_POOL } from './card-pool'
import { NPC_DECKS } from './npc-decks'
import { cardSignature, createOpponentModel } from './opponent-model'
import type { Card } from './types'

// 固定種子亂數，求重現。
let seed = 20260725
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

// 星級一律用 id 查（抽出的卡就是卡池物件）。
const STAR_BY_ID = new Map(CARD_POOL.map((c) => [c.id, c.stars]))
const starOf = (c: Card) => STAR_BY_ID.get(c.id) ?? c.stars
const edgeSum = (c: Card) => c.edges.top + c.edges.right + c.edges.bottom + c.edges.left

describe('卡池前提', () => {
  // 模型用「四邊＋陣營」簽名比對已亮出的牌（手動填值的卡沒有卡池 id）。
  // 若同一簽名對到不同星級，玩家模型會把已亮牌的星級認錯。
  it('同一內容簽名不會對應到不同星級', () => {
    const byS = new Map<string, number>()
    const bad: string[] = []
    for (const c of CARD_POOL) {
      const s = cardSignature(c)
      const prev = byS.get(s)
      if (prev === undefined) byS.set(s, c.stars)
      else if (prev !== c.stars) bad.push(`${s}: ${prev}★ vs ${c.stars}★`)
    }
    expect(bad).toEqual([])
  })
})

describe('uniform 模型（維持舊行為）', () => {
  it('抽樣序列與改動前的內建 draw 逐輪一致', () => {
    const exclude = CARD_POOL.slice(0, 40)
    // 改動前 montecarlo.ts 的實作，原樣複製。
    const excluded = new Set(exclude.map(cardSignature))
    const candidates = CARD_POOL.filter((c) => !excluded.has(cardSignature(c)))
    const n = 4
    const idx = candidates.map((_, i) => i)
    const oldDraw = (): Card[] => {
      for (let i = 0; i < n; i++) {
        const j = i + Math.floor(rnd() * (idx.length - i))
        const t = idx[i]!
        idx[i] = idx[j]!
        idx[j] = t
      }
      return idx.slice(0, n).map((i) => candidates[i]!)
    }
    const model = createOpponentModel({ kind: 'uniform' }, { excludeCards: exclude })
    expect(model.candidates.length).toBe(candidates.length)

    seed = 111
    const a = Array.from({ length: 200 }, () => oldDraw().map((c) => c.id).join(','))
    seed = 111
    const b = Array.from({ length: 200 }, () =>
      model.draw(n, rnd).map((c) => c.id).join(','),
    )
    expect(b).toEqual(a)
  })
})

describe('NPC 模型', () => {
  it('所有 NPC 牌組的卡 id 都能在卡池解析', () => {
    const ids = new Set(CARD_POOL.map((c) => c.id))
    const missing: number[] = []
    for (const d of NPC_DECKS)
      for (const id of [...d.fixed, ...d.variable]) if (!ids.has(id)) missing.push(id)
    expect(missing).toEqual([])
  })

  it('每個 NPC 的 fixed + variable 至少 5 張（湊得出一副手牌）', () => {
    const bad = NPC_DECKS.filter((d) => d.fixed.length + d.variable.length < 5).map((d) => d.name)
    expect(bad).toEqual([])
  })

  it('抽出的 5 張都在該牌組內、互不重複，且固定牌必中', () => {
    for (const d of NPC_DECKS) {
      const m = createOpponentModel({ kind: 'npc', npcId: d.id })
      const deckIds = new Set([...d.fixed, ...d.variable])
      for (let t = 0; t < 10; t++) {
        const drawn = m.draw(5, rnd)
        expect(drawn).toHaveLength(5)
        const ids = new Set(drawn.map((c) => c.id))
        expect(ids.size).toBe(5)
        for (const c of drawn) expect(deckIds.has(c.id)).toBe(true)
        for (const f of d.fixed) expect(ids.has(f)).toBe(true)
      }
    }
  })

  it('排除已亮出的牌後：該牌不再出現，剩餘固定牌仍必中', () => {
    const byId = new Map(CARD_POOL.map((c) => [c.id, c]))
    for (const d of NPC_DECKS.filter((x) => x.fixed.length >= 2)) {
      const shown = [byId.get(d.fixed[0]!)!]
      const shownSig = cardSignature(shown[0]!)
      const m = createOpponentModel({ kind: 'npc', npcId: d.id }, { excludeCards: shown })
      for (let t = 0; t < 10; t++) {
        const drawn = m.draw(4, rnd)
        expect(drawn).toHaveLength(4)
        for (const c of drawn) expect(cardSignature(c)).not.toBe(shownSig)
        const ids = new Set(drawn.map((c) => c.id))
        for (const f of d.fixed.slice(1)) expect(ids.has(f)).toBe(true)
      }
    }
  })

  it('候選數塌縮到 12 張以內（全卡池是數百張）', () => {
    for (const d of NPC_DECKS) {
      const m = createOpponentModel({ kind: 'npc', npcId: d.id })
      expect(m.candidates.length).toBeLessThanOrEqual(12)
    }
  })

  it('找不到 npcId 時退回 uniform，不假裝有牌組資訊', () => {
    expect(createOpponentModel({ kind: 'npc', npcId: -1 }).kind).toBe('uniform')
  })
})

describe('玩家模型', () => {
  it('抽出的牌永遠符合牌組合法性：5★ ≤ 1、4★+5★ ≤ 2', () => {
    const m = createOpponentModel({ kind: 'player' })
    for (let t = 0; t < 2000; t++) {
      const drawn = m.draw(5, rnd)
      expect(drawn).toHaveLength(5)
      expect(new Set(drawn.map((c) => c.id)).size).toBe(5)
      const n5 = drawn.filter((c) => starOf(c) === 5).length
      const n4 = drawn.filter((c) => starOf(c) === 4).length
      expect(n5).toBeLessThanOrEqual(1)
      expect(n4 + n5).toBeLessThanOrEqual(2)
    }
  })

  it('填充位只放 3★，不抽 1-2★ 垃圾卡', () => {
    const m = createOpponentModel({ kind: 'player' })
    for (let t = 0; t < 500; t++)
      for (const c of m.draw(5, rnd)) expect(starOf(c)).toBeGreaterThanOrEqual(3)
  })

  it('已亮出 1×5★ + 1×4★ 後，剩餘未知牌必為 3★ 以下（規則推論）', () => {
    const five = CARD_POOL.find((c) => c.stars === 5)!
    const four = CARD_POOL.find((c) => c.stars === 4)!
    const m = createOpponentModel({ kind: 'player' }, { excludeCards: [five, four] })
    for (let t = 0; t < 500; t++)
      for (const c of m.draw(3, rnd)) expect(starOf(c)).toBeLessThanOrEqual(3)
  })

  it('填充位是「有競爭力的 3★」而非隨機 3★', () => {
    const five = CARD_POOL.find((c) => c.stars === 5)!
    const four = CARD_POOL.find((c) => c.stars === 4)!
    const m = createOpponentModel({ kind: 'player' }, { excludeCards: [five, four] })
    const all3 = CARD_POOL.filter((c) => c.stars === 3)
    const avgAll3 = all3.reduce((a, c) => a + edgeSum(c), 0) / all3.length
    let sum = 0
    let n = 0
    for (let t = 0; t < 500; t++)
      for (const c of m.draw(3, rnd)) {
        sum += edgeSum(c)
        n++
      }
    expect(sum / n).toBeGreaterThan(avgAll3)
  })
})

describe('退化情境：未知槽一定要填滿', () => {
  it('卡池小於未知槽數時，回傳卡池全部而非殘缺卡', () => {
    const tiny = CARD_POOL.slice(0, 3)
    const m = createOpponentModel({ kind: 'player' }, { pool: tiny })
    for (let t = 0; t < 20; t++) {
      const drawn = m.draw(5, rnd)
      expect(drawn).toHaveLength(3)
      for (const c of drawn) expect(c.edges).toBeDefined()
    }
  })

  it('未知槽數少於固定牌數時仍回傳正確張數', () => {
    const d = NPC_DECKS[0]!
    const m = createOpponentModel({ kind: 'npc', npcId: d.id })
    for (let t = 0; t < 20; t++) {
      const drawn = m.draw(2, rnd)
      expect(drawn).toHaveLength(2)
      expect(new Set(drawn.map((c) => c.id)).size).toBe(2)
    }
  })
})