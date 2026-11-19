// ============================================================
// storage.test.ts — 牌組與設定的存檔讀寫
//
// 重點：
//   1. 存進去再讀出來，內容不變。
//   2. 壞掉或對不上版本的存檔整份丟掉（回 null），不讓壞資料進到畫面狀態。
//   3. 之後新增規則欄位時，舊存檔自動補預設值。
//   4. 重新整理後新發的未知卡 id 不會跟記住的對手牌撞號。
// ============================================================

import { describe, expect, it } from 'vitest'
import { CARD_POOL } from './engine/card-pool'
import { NPC_DECKS } from './engine/npc-decks'
import { firstFreeUnknownId, parseSaved, serializeState } from './storage'
import type { SavedState } from './storage'
import type { Card, Rules } from './engine/types'

function defaultRules(): Rules {
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

// 牌組裡的卡：內容取自卡池，id 是槽位 id（跟 App.vue 的做法一致）。
const deckCard = (poolIndex: number, id: number): Card => ({ ...CARD_POOL[poolIndex]!, id })

function sample(): SavedState {
  return {
    myDeck: [0, 1, 2, 3, 4].map((i) => deckCard(100 + i, i + 1)),
    oppDeck: [deckCard(200, -3), null, null, deckCard(201, -7), null],
    myDeckSlots: [
      { name: '同數加算', deck: [0, 1, 2, 3, 4].map((i) => deckCard(50 + i, i + 1)) },
      { name: '', deck: null },
      { name: '', deck: null },
    ],
    oppDeckSlots: [
      { name: '', deck: null },
      { name: '某 NPC', deck: [null, deckCard(210, -12), null, null, null] },
      { name: '', deck: null },
    ],
    mySide: 'BLUE',
    firstPlayer: 'RED',
    rules: { ...defaultRules(), same: true, plus: true },
    oppKind: 'npc',
    oppNpcId: NPC_DECKS[0]!.id,
    lastNpcId: NPC_DECKS[0]!.id,
  }
}

// 把存檔字串改掉一部分再讀，用來造壞資料。
function tampered(change: (data: Record<string, unknown>) => void): string {
  const data = JSON.parse(serializeState(sample())) as Record<string, unknown>
  change(data)
  return JSON.stringify(data)
}

describe('存檔往返', () => {
  it('存進去再讀出來，內容完全相同', () => {
    const state = sample()
    expect(parseSaved(serializeState(state), defaultRules())).toEqual(state)
  })

  it('沒存過（null）→ 回 null', () => {
    expect(parseSaved(null, defaultRules())).toBeNull()
  })
})

describe('壞資料整份丟掉', () => {
  it('不是 JSON', () => {
    expect(parseSaved('{oops', defaultRules())).toBeNull()
    expect(parseSaved('', defaultRules())).toBeNull()
  })

  it('版本對不上', () => {
    expect(
      parseSaved(
        tampered((d) => (d.v = 999)),
        defaultRules(),
      ),
    ).toBeNull()
    expect(
      parseSaved(
        tampered((d) => delete d.v),
        defaultRules(),
      ),
    ).toBeNull()
  })

  it('我方牌組不是 5 張', () => {
    const raw = tampered((d) => (d.myDeck = (d.myDeck as unknown[]).slice(0, 4)))
    expect(parseSaved(raw, defaultRules())).toBeNull()
  })

  it('卡的邊值超出 1~10', () => {
    const raw = tampered((d) => ((d.myDeck as Card[])[0]!.edges.top = 11 as never))
    expect(parseSaved(raw, defaultRules())).toBeNull()
  })

  it('牌組槽裡的卡缺欄位', () => {
    const raw = tampered((d) => {
      const slots = d.oppDeckSlots as { deck: unknown[] | null }[]
      slots[1]!.deck![1] = { id: -12, name: 'x' }
    })
    expect(parseSaved(raw, defaultRules())).toBeNull()
  })

  it('座位、對手類型不是認得的值', () => {
    expect(
      parseSaved(
        tampered((d) => (d.mySide = 'GREEN')),
        defaultRules(),
      ),
    ).toBeNull()
    expect(
      parseSaved(
        tampered((d) => (d.oppKind = 'uniform')),
        defaultRules(),
      ),
    ).toBeNull()
  })

  it('少了整個欄位', () => {
    expect(
      parseSaved(
        tampered((d) => delete d.oppDeckSlots),
        defaultRules(),
      ),
    ).toBeNull()
  })
})

describe('容許的差異', () => {
  it('舊存檔沒有的規則欄位補預設值，不認得的欄位略過', () => {
    const raw = tampered((d) => {
      const rules = d.rules as Record<string, unknown>
      delete rules.swap // 假裝這是舊版存檔，當時還沒有這條規則
      rules.someFutureRule = true
      rules.reverse = 'yes' // 型別不對的值不採用
    })
    const got = parseSaved(raw, defaultRules())!
    expect(got.rules).toEqual({ ...defaultRules(), same: true, plus: true })
  })

  it('存檔的 NPC 已不在資料裡 → 當作還沒選，其餘照常讀回', () => {
    const got = parseSaved(
      tampered((d) => (d.oppNpcId = -999)),
      defaultRules(),
    )!
    expect(got.oppNpcId).toBeNull()
    expect(got.oppKind).toBe('npc')
    expect(got.myDeck).toEqual(sample().myDeck)
  })

  it('中文卡名以目前卡池為準（之後才補的中文名也會出現）', () => {
    const pool = CARD_POOL.find((c) => c.nameZh)!
    const raw = tampered((d) => {
      const deck = d.myDeck as Card[]
      deck[0] = { ...pool, id: 1, nameZh: '舊名' }
      const noZh = { ...pool, id: 2 }
      delete noZh.nameZh
      deck[1] = noZh
      deck[2] = { ...pool, id: 3, name: '已填入', nameZh: undefined } // 手動輸入的卡
    })
    const got = parseSaved(raw, defaultRules())!
    expect(got.myDeck[0]!.nameZh).toBe(pool.nameZh)
    expect(got.myDeck[1]!.nameZh).toBe(pool.nameZh)
    expect(got.myDeck[2]!.nameZh).toBeUndefined()
    expect(got.myDeck[0]!.id).toBe(1) // 槽位 id 不被卡池 id 蓋掉
  })
})

describe('未知卡 id 起點', () => {
  it('沒有存檔 → 從 -1 開始', () => {
    expect(firstFreeUnknownId(null)).toBe(-1)
  })

  it('排在對手牌組記憶與牌組槽裡最小的 id 下面', () => {
    // sample() 裡最小的是對手牌組槽的 -12。
    expect(firstFreeUnknownId(sample())).toBe(-13)
  })

  it('存檔裡沒有負數 id → 仍從 -1 開始', () => {
    const s = sample()
    s.oppDeck = [null, null, null, null, null]
    s.oppDeckSlots = s.oppDeckSlots.map(() => ({ name: '', deck: null }))
    expect(firstFreeUnknownId(s)).toBe(-1)
  })
})
