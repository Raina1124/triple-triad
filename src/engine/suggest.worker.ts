// ============================================================
// suggest.worker.ts — 在 Web Worker 裡跑「建議最佳手」的搜尋
//
// 搜尋最重的情況（空盤開局＋同分決勝）要算好幾秒，跑在主執行緒會讓整個
// 頁面凍結。搬到 Worker 後畫面保持可操作，也才能中途取消。
//
// 一次只處理一個請求、算完回一個結果，不帶請求編號：
// 「取消」的做法是主執行緒直接 terminate 這個 Worker（見 App.vue 的
// cancelSuggest），被終止的 Worker 不會再回任何訊息，所以不會有過期結果。
//
// 傳進來的局面必須是純資料（App.vue 用 JSON 複製一份）：Vue 的 reactive
// 代理物件不能直接 postMessage。
// ============================================================

import { findBestMoveMonteCarlo } from './montecarlo'
import type { MonteCarloOptions, MonteCarloResult } from './montecarlo'
import type { GameState } from './types'

export interface SuggestRequest {
  state: GameState
  // rng / pool 等函式或測試用選項不走 Worker，只帶 UI 實際會用到的三個。
  options: Pick<MonteCarloOptions, 'excludeCards' | 'restrictToCardId' | 'opponent'>
}

addEventListener('message', (e: MessageEvent<SuggestRequest>) => {
  const result: MonteCarloResult = findBestMoveMonteCarlo(e.data.state, e.data.options)
  postMessage(result)
})
