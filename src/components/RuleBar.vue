<script setup lang="ts">
// ============================================================
// RuleBar.vue — 規則開關列（展示型元件）
// 透過 update:rules 事件把切換往上拋，父層持有 rules 狀態。
// 注意：Combo（連鎖）是自動機制，不列為開關。
// ============================================================
import type { Rules } from '../engine/types'

interface Props {
  rules: Rules
}

const props = defineProps<Props>()

const emit = defineEmits<{ (e: 'update:rules', rules: Rules): void }>()

const ruleList: { key: keyof Rules; label: string }[] = [
  { key: 'same', label: '同數' },
  { key: 'plus', label: '加算' },
  { key: 'reverse', label: '逆轉' },
  { key: 'fallenAce', label: '王牌殺手' },
  { key: 'order', label: '秩序' },
  { key: 'chaos', label: '混亂' },
  { key: 'threeOpen', label: '三明牌' },
  { key: 'allOpen', label: '全明牌' },
  { key: 'ascension', label: '同類強化' },
  { key: 'descension', label: '同類弱化' },
  { key: 'swap', label: '交換' },
]

// 互斥規則組：同組內開啟一個，會自動關掉另一個。
const exclusivePairs: [keyof Rules, keyof Rules][] = [
  ['ascension', 'descension'], // 強化與弱化互斥
  ['threeOpen', 'allOpen'], // 三明牌與全明牌互斥
  ['order', 'chaos'], // 秩序與混亂互斥（官方：同選時隨機生效其一）
]

function toggle(key: keyof Rules) {
  const next = { ...props.rules, [key]: !props.rules[key] }
  // 若開啟的是互斥組的一員，關掉同組另一個。
  if (next[key]) {
    for (const [a, b] of exclusivePairs) {
      if (key === a) next[b] = false
      else if (key === b) next[a] = false
    }
  }
  emit('update:rules', next)
}
</script>

<template>
  <div class="rules">
    <button
      v-for="r in ruleList"
      :key="r.key"
      class="rule-chip"
      :class="{ on: rules[r.key] }"
      @click="toggle(r.key)"
    >
      {{ r.label }}
    </button>
  </div>
</template>

<style scoped>
.rules {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.rule-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  padding: 8px 16px;
  border: 1px solid var(--gold-dim);
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
  transition: all 0.18s;
  background: rgba(255, 255, 255, 0.02);
  color: var(--ivory);
  font-family: 'Noto Serif TC', serif;
}
.rule-chip.on {
  background: var(--gold);
  color: #1a1408;
  border-color: var(--gold);
  font-weight: 700;
  box-shadow: 0 0 10px rgba(217, 180, 73, 0.4);
}
</style>
