<script setup lang="ts">
// ============================================================
// TourGuide.vue — 一步一步的導覽（第一次開網頁時播放一次）
// 目標元素用 data-tour 屬性標記（見 App.vue）。
// 每一步：把目標捲進畫面 → 量位置 → 聚光框框住它，
// 說明卡放在目標上下兩側中比較寬的那一邊。
// 導覽期間整頁被遮罩擋住，只能按卡片上的按鈕。
// ============================================================
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const emit = defineEmits<{ (e: 'done'): void }>()

interface Step {
  target: string // 對應 data-tour 的值
  title: string
  text: string
}

// 內容與 HelpSheet 的「一局的流程」一致；改功能時兩邊一起改。
const steps: Step[] = [
  {
    target: 'setup',
    title: '開局設定',
    text: '先選你在遊戲裡是紅方還是藍方，以及這局誰先手。',
  },
  {
    target: 'rules',
    title: '規則',
    text: '點亮這局用到的規則。打 NPC 時可以跳過，選了 NPC 會自動套用。',
  },
  {
    target: 'my-hand',
    title: '我方牌組',
    text: '點每張卡右上角的 ✎，用卡名、編號或數值搜尋，填入你的五張牌。重置牌局後會保留。',
  },
  {
    target: 'opponent',
    title: '對手',
    text: '展開這裡。打 NPC 選「NPC」並搜尋名字，打錦標賽選「選拔」，其他對玩家選「一般」。',
  },
  {
    target: 'suggest',
    title: '建議最佳手',
    text: '輪到你時按這裡。建議的牌會被選起來，建議的格子會發出金光；在遊戲裡照著出，再點那一格記錄。',
  },
  {
    target: 'board',
    title: '記錄對手的出牌',
    text: '對手出牌後，先點對手的一張手牌，再點它落下的格子。問號卡會先跳出選卡面板讓你填。',
  },
  {
    target: 'help',
    title: '詳細說明',
    text: '建議結果怎麼看、特殊規則怎麼操作，都在這裡。這段導覽也可以從這裡重看。',
  },
]

const index = ref(0)
const step = computed(() => steps[index.value]!)
const isLast = computed(() => index.value === steps.length - 1)

// 目標在視窗中的位置（fixed 座標）。
const rect = ref<DOMRect | null>(null)
const viewH = ref(window.innerHeight)

function targetEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${step.value.target}"]`)
}

function measure() {
  viewH.value = window.innerHeight
  rect.value = targetEl()?.getBoundingClientRect() ?? null
}

// 換步驟：先把目標捲到畫面中央，再量位置。
async function focusStep() {
  await nextTick()
  targetEl()?.scrollIntoView({ block: 'center', inline: 'nearest' })
  measure()
}

const PAD = 6 // 聚光框比目標外擴的距離
const GAP = 12 // 說明卡與聚光框的間距

const spotStyle = computed(() => {
  const r = rect.value
  if (!r) return { display: 'none' }
  return {
    left: `${r.left - PAD}px`,
    top: `${r.top - PAD}px`,
    width: `${r.width + PAD * 2}px`,
    height: `${r.height + PAD * 2}px`,
  }
})

// 說明卡放在目標上方或下方空間較大的一側。
// 用 top / bottom 錨定而不是算卡片高度，卡片長高時不會跑位。
const cardStyle = computed(() => {
  const r = rect.value
  if (!r) return { bottom: '16px' }
  const above = r.top - PAD
  const below = viewH.value - (r.bottom + PAD)
  return below >= above
    ? { top: `${Math.min(r.bottom + PAD + GAP, viewH.value - 220)}px` }
    : { bottom: `${Math.min(viewH.value - r.top + PAD + GAP, viewH.value - 220)}px` }
})

function next() {
  if (isLast.value) emit('done')
  else index.value++
}
function prev() {
  if (index.value > 0) index.value--
}

watch(index, focusStep)
onMounted(() => {
  focusStep()
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('scroll', measure, true)
})
</script>

<template>
  <div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
    <!-- 擋住整頁的點擊；變暗效果由聚光框的外陰影負責 -->
    <div class="tour-block"></div>
    <div class="tour-spot" :style="spotStyle"></div>

    <div class="tour-card" :style="cardStyle">
      <div class="tour-count">{{ index + 1 }} / {{ steps.length }}</div>
      <h2 id="tour-title" class="tour-title">{{ step.title }}</h2>
      <p class="tour-text">{{ step.text }}</p>
      <div class="tour-actions">
        <button class="tour-btn skip" @click="emit('done')">略過</button>
        <button v-if="index > 0" class="tour-btn" @click="prev">上一步</button>
        <button class="tour-btn primary" @click="next">
          {{ isLast ? '開始使用' : '下一步' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tour {
  position: fixed;
  inset: 0;
  z-index: 200;
}
.tour-block {
  position: absolute;
  inset: 0;
}
.tour-spot {
  position: fixed;
  border: 2px solid var(--gold);
  border-radius: 10px;
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.68),
    0 0 24px rgba(217, 180, 73, 0.5);
  pointer-events: none;
  transition:
    left 0.25s ease,
    top 0.25s ease,
    width 0.25s ease,
    height 0.25s ease;
}

.tour-card {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  width: min(380px, calc(100vw - 24px));
  box-sizing: border-box;
  background: var(--panel);
  border: 1px solid var(--gold-dim);
  border-radius: 12px;
  padding: 16px 18px 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  color: var(--ivory);
}
.tour-count {
  font-family: 'Cinzel', serif;
  font-size: 12px;
  color: var(--gold-dim);
}
.tour-title {
  font-size: 17px;
  color: var(--gold);
  margin: 2px 0 6px;
  letter-spacing: 1px;
}
.tour-text {
  font-size: 14px;
  line-height: 1.7;
  margin: 0 0 14px;
}
.tour-actions {
  display: flex;
  gap: 8px;
}
.tour-btn {
  font-family: 'Noto Serif TC', serif;
  font-size: 14px;
  min-height: 36px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--gold-dim);
  background: transparent;
  color: var(--ivory);
  cursor: pointer;
}
.tour-btn.skip {
  border-color: transparent;
  opacity: 0.7;
  margin-right: auto;
}
.tour-btn.primary {
  background: linear-gradient(160deg, var(--gold), #a8841d);
  border-color: var(--gold);
  color: #1a1408;
  font-weight: 700;
}
@media (pointer: coarse) {
  .tour-btn {
    min-height: 44px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tour-spot {
    transition: none;
  }
}
</style>
