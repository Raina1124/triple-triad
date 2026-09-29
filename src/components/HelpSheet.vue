<script setup lang="ts">
// ============================================================
// HelpSheet.vue — 使用說明（展示型元件）
// 桌面是置中面板，手機是底部抽屜（與 CardPicker 同一套外觀）。
// 內容是靜態文字；改功能時記得同步改這裡。
// ============================================================
const emit = defineEmits<{ (e: 'close'): void; (e: 'tour'): void }>()
</script>

<template>
  <div class="help-backdrop" @click.self="emit('close')">
    <div class="help" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div class="help-head">
        <h2 id="help-title" class="help-title">使用說明</h2>
        <div class="help-head-actions">
          <button class="help-close" @click="emit('tour')">重看導覽</button>
          <button class="help-close" @click="emit('close')">關閉</button>
        </div>
      </div>

      <div class="help-body">
        <section>
          <h3>一局的流程</h3>
          <ol class="steps">
            <li>
              <b>開局設定</b
              >：選「我方座位」（你在遊戲裡是紅方還是藍方）和「開局先手」，再點亮這局的規則。連鎖由同數、加算自動觸發，不用另外開。這幾項一改就會重置牌局。
            </li>
            <li>
              <b>填入我方牌組</b>：點手牌右上角的
              ✎，用卡名、編號或數值搜尋。重置牌局後牌組會保留，重新整理網頁則回到預設。
            </li>
            <li>
              <b>設定對手</b>：展開「對手牌組・牌組槽」。打 NPC
              就選「NPC」並搜尋名字，規則會自動套用；打錦標賽選「選拔」；其他對玩家選「一般」。
            </li>
            <li>
              <b>對手亮出的牌</b>：有明牌規則時，點對手問號卡的
              ✎，把看到的牌填進去，填哪一張問號卡都可以。
            </li>
            <li>
              <b>輪到我方</b
              >：按「建議最佳手」。建議的牌會被選起來，建議的格子會發出金光。在遊戲裡照著出之後，點那一格記錄下來。
            </li>
            <li>
              <b>輪到對手</b
              >：點對手的一張手牌，再點它在遊戲裡落下的格子。如果點的是問號卡，會先跳出選卡面板，選好就自動落子。
            </li>
            <li><b>下一局</b>：按「重置牌局」。同一位 NPC 填過的牌會記住，下一局不用重填。</li>
          </ol>
        </section>

        <section>
          <h3>看懂建議</h3>
          <p class="example">
            （我方）建議出「某張卡」→ 中左格　預期終局 +1.33（我方優）（蒙地卡羅 N
            樣本平均，對手候選 7 張）
          </p>
          <dl class="terms">
            <dt>預期終局</dt>
            <dd>
              雙方都下出最好的一手時，終局我方比對手多幾張卡。+2 大約是 6 比 4，0
              是平手，負數代表對手佔優。
            </dd>
            <dt>沒有括號註記</dt>
            <dd>雙方的牌都已知，這是精確結果。</dd>
            <dt>蒙地卡羅 N 樣本平均</dt>
            <dd>
              還有未知的牌，而且棋盤剩 7
              格以下空格時，會抽對手可能的牌算很多次再平均，所以可能出現小數。
            </dd>
            <dt>估計</dt>
            <dd>
              棋盤還很空（8
              格以上）時，用一張代表性的強牌代替對手的未知牌來算。這時的分數常常偏高，看方向就好。
            </dd>
            <dt>對手候選 N 張</dt>
            <dd>
              對手未知的牌還有幾種可能，越少越準。選了 NPC 通常只剩個位數，選「一般」大約兩百張。
            </dd>
            <dt>開頭是「（對手）」</dt>
            <dd>輪到對手時按建議，是在預測對手最好的應對。</dd>
          </dl>
          <p class="note">
            同一個盤面再按一次，建議可能會換一個：抽樣有隨機性，而前幾名常常只差不到 0.1
            張，選哪個都差不多。
          </p>
        </section>

        <section>
          <h3>特殊規則</h3>
          <dl class="terms">
            <dt>秩序</dt>
            <dd>
              只能出剩下手牌中排最前面的那張。手牌順序要跟遊戲一致，排錯了用「調換位置」修正。
            </dd>
            <dt>混亂</dt>
            <dd>先點遊戲這一手指定的牌，再按「建議最佳手」，只會算那張牌該放哪裡。</dd>
            <dt>交換</dt>
            <dd>按「指定交換」，先點我方被換走的牌，再點對手換過來的牌。</dd>
            <dt>同類強化、同類弱化</dt>
            <dd>
              卡片左上角的字是種族（蠻神、拂曉、帝國、獸人），沒有字就是無種族。被加減過的數值會顯示成金色。手動輸入數值時，記得一併選種族。
            </dd>
          </dl>
        </section>

        <section>
          <h3>填錯了怎麼辦</h3>
          <dl class="terms">
            <dt>數值填錯</dt>
            <dd>點卡片的 ✎ 重填，棋盤上的卡也可以。</dd>
            <dt>格子放錯、手牌順序不對</dt>
            <dd>
              按「調換位置」，點兩個位置對調；棋盤上點空格則是搬過去。修正只改記錄，已經發生的翻面不會重算。
            </dd>
            <dt>換了對手</dt>
            <dd>按「洗掉對手牌」清掉記住的對手牌。換成另一位 NPC 時會自動清掉。</dd>
            <dt>牌組槽</dt>
            <dd>
              我方、對手各有 3
              槽。「存」把目前的牌組存進去，「取」取回並重發牌局。重新整理網頁後就會消失。
            </dd>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.help {
  background: var(--panel);
  border: 1px solid var(--gold-dim);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  width: 560px;
  max-width: 92vw;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}
.help-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--line);
}
.help-title {
  font-family: 'Cinzel', 'Noto Serif TC', serif;
  font-size: 18px;
  letter-spacing: 2px;
  color: var(--gold);
  margin: 0;
}
.help-head-actions {
  display: flex;
  gap: 8px;
}
.help-close {
  font-family: 'Noto Serif TC', serif;
  font-size: 14px;
  padding: 6px 16px;
  min-height: 36px;
  background: transparent;
  color: var(--ivory);
  border: 1px solid var(--gold-dim);
  border-radius: 8px;
  cursor: pointer;
}
.help-close:hover {
  border-color: var(--ivory);
}

.help-body {
  overflow-y: auto;
  padding: 6px 24px 24px;
  font-size: 14px;
  line-height: 1.75;
  color: var(--ivory);
}
section + section {
  border-top: 1px solid var(--line);
}
h3 {
  font-size: 15px;
  color: var(--gold);
  margin: 18px 0 8px;
  letter-spacing: 1px;
}
b {
  color: var(--gold);
  font-weight: 700;
}

/* 流程是真的有先後順序，才用編號 */
.steps {
  margin: 0;
  padding-left: 1.6em;
}
.steps li {
  margin-bottom: 6px;
}
.steps li::marker {
  color: var(--gold);
  font-weight: 700;
}

/* 範例：模仿棋盤下方建議文字的樣子，對照著看 */
.example {
  margin: 0 0 12px;
  padding: 10px 12px;
  background: var(--slot);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--gold);
  font-size: 13px;
}

.terms {
  margin: 0;
}
.terms dt {
  font-weight: 700;
  margin-top: 8px;
}
.terms dd {
  margin: 0;
  opacity: 0.85;
}
.note {
  margin: 12px 0 0;
  font-size: 13px;
  opacity: 0.7;
}

/* 手機：底部抽屜 */
@media (max-width: 720px) {
  .help-backdrop {
    align-items: flex-end;
  }
  .help {
    width: 100%;
    max-width: 100%;
    max-height: 92dvh;
    border-radius: 16px 16px 0 0;
    border-bottom: none;
  }
  .help-head {
    padding: 14px 16px 12px;
  }
  .help-body {
    padding: 4px 16px 24px;
  }
}
@media (pointer: coarse) {
  .help-close {
    min-height: 44px;
  }
}
</style>
