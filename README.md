# 金碟幻卡 · 分析台

FF14 九宮幻卡（Triple Triad）的對局分析工具。在手機或第二個螢幕上記錄對局，按「建議最佳手」算出這一手該出哪張、放哪格。

網站：<https://raina1124.github.io/triple-triad/>

## 功能

- 規則：同數、加算（含連鎖）、逆轉、王牌殺手、秩序、混亂、三明牌、全明牌、同類強化、同類弱化、交換。
- 搜尋：雙方的牌都已知時是精確解（minimax + alpha-beta）；對手還有沒亮出的牌時，依對手類型推估：
  - **一般**：照玩家牌組的星級上限，假設對手帶有競爭力的牌；逆轉規則下改為假設對手帶低星牌。
  - **NPC**：用該 NPC 的實際牌組。
  - **選拔**：錦標賽選拔規則，1★～5★ 各一張。
- 搜尋在 Web Worker 裡跑，推演時畫面不會卡住。
- 牌組、對手牌組記憶、牌組槽、規則與對手設定會存在瀏覽器裡，重新整理後照舊。
- 「上一步」收回落子；「調換位置」修正填錯的格子或手牌順序。
- 卡片資料 475 張，可用編號、中英文名或四邊數值搜尋。

## 開發

需要 Node.js 22.18 以上。

```sh
npm install
npm run dev        # 本機開發
npx vitest run     # 單元測試
npm run build      # 型別檢查 + 建置
```

推送到 `main` 會由 GitHub Actions 跑測試、建置並部署到 GitHub Pages（`.github/workflows/deploy.yml`）。測試沒過就不會部署。

## 目錄

- `src/engine/`：規則與搜尋引擎（不依賴 Vue，可單獨測試）
  - `flip.ts` 翻面結算、`game.ts` 落子流程、`minimax.ts` 精確搜尋、`montecarlo.ts` 含未知牌的推估
  - `opponent-model.ts` 對手牌組模型、`npc-decks.ts` NPC 牌組資料
  - `cards-data.ts` 卡片資料（自動產生）、`cards-zh.ts` / `npc-zh.ts` 中文名對照（手動維護）
  - `suggest.worker.ts` 在 Web Worker 裡跑搜尋
- `src/storage.ts`：牌組與設定的保存
- `src/history.ts`：「上一步」
- `src/components/`：畫面元件

## 資料來源

卡片與 NPC 牌組資料來自 [FFXIV Collect](https://ffxivcollect.com)，僅供非商業個人使用。
