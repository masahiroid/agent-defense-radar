import type { AttackFeature } from '../types/defense'

const RE_HALF_KANA = /[･-ﾟ]/g
const RE_FULL_ALNUM = /[０-９Ａ-Ｚａ-ｚ]/g
const RE_ZERO_WIDTH = /[​-‏‪-‮⁠-⁤﻿]|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const RE_SYSTEM_TAG =
  /[【\[]\s*(システム|system|管理者|admin|重要|緊急|通知|運営|セキュリティ|important|urgent|notice)[^】\]]{0,20}[】\]]|<\/?(system|admin|instruction|important)>|\*\*\*\s*(system|admin)[^*]*\*\*\*|ignore (all |any )?(the )?(previous|prior|above) (instructions|messages)|disregard (the )?(user|previous)|<INFORMATION>/i
const RE_HOMOGLYPH = /[\u0400-\u04FF\u0370-\u03FF]/
const RE_ULTRA_KEIGO =
  /(kindly|would be (most )?grateful|humbly|respectfully (request|ask)|at your earliest convenience|if it would not be too much|恐れ入りますが|何卒|賜り|ご査収|お願い申し上げ|ご容赦|存じます|差し支えなければ|お手数ですが|ご教示)/gi
const RE_POLITE = /(です|ます|ください|でしょう|\bplease\b|\bthank you\b)/gi

const CLASSES: [string, RegExp][] = [
  ['hira', /[ぁ-ゟ]/],
  ['kata', /[゠-ヿ]/],
  ['half', /[･-ﾟ]/],
  ['kanji', /[一-鿿]/],
  ['latin', /[A-Za-z]/],
  ['fullalnum', /[０-９Ａ-Ｚａ-ｚ]/],
  ['digit', /[0-9]/],
  ['symbol', /[^\s\wぁ-ヿ一-鿿＀-￯]/],
]

export interface TextStats {
  halfWidthRatio: number
  fullWidthAlnumRatio: number
  riskScore: number // 0..1
}

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length

export function charClassEntropy(text: string): number {
  const chars = [...text.replace(/\s/g, '')]
  if (!chars.length) return 0
  const freq = new Array(CLASSES.length).fill(0)
  for (const c of chars) {
    const i = CLASSES.findIndex(([, re]) => re.test(c))
    if (i >= 0) freq[i]++
  }
  let h = 0
  for (const f of freq) {
    if (!f) continue
    const p = f / chars.length
    h -= p * Math.log2(p)
  }
  return Math.min(1, h / Math.log2(CLASSES.length))
}

/** NFKC + zero-width removal. Mirrors the Layer-1 normalizer. */
export function normalizeJa(text: string): string {
  return text.replace(RE_ZERO_WIDTH, '').normalize('NFKC')
}

export function analyzeText(text: string): { features: AttackFeature; stats: TextStats } {
  const len = Math.max(1, [...text].length)
  const keigo = count(text, RE_ULTRA_KEIGO)
  const polite = count(text, RE_POLITE)
  const features: AttackFeature = {
    hasHalfWidthKana: new RegExp(RE_HALF_KANA.source).test(text),
    hasSystemTagSpoofing: RE_SYSTEM_TAG.test(text),
    honorificLevel: keigo >= 2 ? 'ultra_keigo' : polite + keigo > 0 ? 'polite' : 'none',
    zeroWidthOrControlChars: new RegExp(RE_ZERO_WIDTH.source).test(text) || (RE_HOMOGLYPH.test(text) && /[A-Za-z]/.test(text)),
    entropyScore: charClassEntropy(text),
  }
  const halfWidthRatio = count(text, RE_HALF_KANA) / len
  const fullWidthAlnumRatio = count(text, RE_FULL_ALNUM) / len
  const riskScore = Math.min(
    1,
    (features.hasHalfWidthKana ? 0.25 : 0) +
      (features.hasSystemTagSpoofing ? 0.35 : 0) +
      (features.honorificLevel === 'ultra_keigo' ? 0.2 : 0) +
      (features.zeroWidthOrControlChars ? 0.3 : 0) +
      features.entropyScore * 0.2 +
      Math.min(0.15, fullWidthAlnumRatio * 2),
  )
  return { features, stats: { halfWidthRatio, fullWidthAlnumRatio, riskScore } }
}

/** Per-class share (for the spectrum display). Order matches CLASS_LABELS. */
export const CLASS_LABELS = ['ひら', 'カナ', '半角', '漢字', 'Latin', '全英', '数字', '記号']
export function classHistogram(text: string): number[] {
  const chars = [...text.replace(/\s/g, '')]
  const f = new Array(CLASSES.length).fill(0)
  for (const c of chars) {
    const i = CLASSES.findIndex(([, re]) => re.test(c))
    if (i >= 0) f[i]++
  }
  const n = Math.max(1, chars.length)
  return f.map((x) => x / n)
}
