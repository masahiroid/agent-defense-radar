import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '../types/defense'

interface Run {
  id: string; lang: Lang; kind: 'attack' | 'benign'; guard: boolean; body: string
  tokens: string[]; ext: [number, number]
  attn: number[][]; surprisal: number[]; ext_mass_by_layer: number[]
  reply: string; obeyed: boolean | null
}
interface Trace { model: string; signal: string; runs: Run[] }

const S = {
  ja: {
    title: 'MODEL X-RAY', sub: '実モデル(LLM-jp-4.1-8B-thinking, 4bit)の内部を記録',
    noGuard: 'ガード無し', guard: 'ガード文あり', layer: '層', mean: '全層平均 (後半16-31)',
    wave: '最終位置が各トークンに向ける注意(波形)', surpr: '驚き度(予測しにくさ)', inj: '注入された文',
    heat: '層×トークン注意ヒートマップ', reply: 'モデルの実際の出力', obeyed: '攻撃に従った', resisted: '従わなかった', unknown: '未確定(推論が途中で終了)', benignOk: '正常に処理',
    mass: '注入文への注意量(層ごと)', massNote: '赤=ガード無し / 青=ガード文あり',
    what: '何が起きたか', hover: 'トークンにカーソルを合わせると値を表示',
    caveat: '注意は因果ではなく相関の手がかりです。各ケース1回の記録・4bit量子化モデル・ヘッド平均。判定は規則ベース。',
    loading: 'トレース読込中…', missing: 'トレースデータがありません (tools/trace_model.py で生成)',
    expl: (r: Run, pct: number, ctrl: number | null) =>
      r.kind === 'benign'
        ? `正常なメール。注入文に相当する区間への注意は ${pct.toFixed(1)}%。出力は${r.obeyed ? '想定外の行動を含む' : '要約のみ'}。`
        : r.obeyed
          ? `モデルは最終位置の注意の ${pct.toFixed(1)}% を注入文に向け、その指示どおりに行動しました${ctrl != null ? `（ガード文ありでは ${ctrl.toFixed(1)}%）` : ''}。ツールを呼ぶ/秘密を出す前に、外部データが“命令”として読まれています。`
          : `注入文への注意は ${pct.toFixed(1)}% ありましたが、モデルは従いませんでした。読まれても「命令として採用」されなかったケースです。`,
  },
  en: {
    title: 'MODEL X-RAY', sub: 'Recorded from a real model (LLM-jp-4.1-8B-thinking, 4-bit)',
    noGuard: 'No guard', guard: 'With guard prompt', layer: 'Layer', mean: 'mean of layers 16-31',
    wave: 'Attention from the final position to each token (waveform)', surpr: 'Surprisal', inj: 'Injected text',
    heat: 'Layer × token attention heatmap', reply: 'Actual model output', obeyed: 'OBEYED the attack', resisted: 'RESISTED', unknown: 'INCONCLUSIVE (reasoning cut off)', benignOk: 'Handled normally',
    mass: 'Attention on injected text, per layer', massNote: 'red = no guard / blue = with guard prompt',
    what: 'What happened', hover: 'Hover a token to read its value',
    caveat: 'Attention is a correlational clue, not causation. One recorded run per case, 4-bit model, head-averaged. Verdict is rule-based.',
    loading: 'Loading trace…', missing: 'No trace data (generate with tools/trace_model.py)',
    expl: (r: Run, pct: number, ctrl: number | null) =>
      r.kind === 'benign'
        ? `Benign email. Attention on the matching span is ${pct.toFixed(1)}%. Output ${r.obeyed ? 'contains an unexpected action' : 'is a plain summary'}.`
        : r.obeyed
          ? `The model put ${pct.toFixed(1)}% of its final-position attention on the injected text and then acted on it${ctrl != null ? ` (${ctrl.toFixed(1)}% with the guard prompt)` : ''}. External data was read as a command before any tool call or leak.`
          : `The injected text drew ${pct.toFixed(1)}% of attention, yet the model did not comply: read, but not adopted as an instruction.`,
  },
} as const

const L0 = 16
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const heat = (v: number) => { // 0..1 -> dark navy -> cyan -> yellow -> red
  const stops: [number, number[]][] = [[0, [8, 14, 28]], [0.35, [0, 140, 200]], [0.6, [0, 242, 254]], [0.8, [255, 210, 63]], [1, [255, 8, 68]]]
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a)
    return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(',')})`
  }
  return 'rgb(255,8,68)'
}

export function ModelXRay({ lang }: { lang: Lang }) {
  const t = S[lang]
  const [trace, setTrace] = useState<Trace | null | undefined>(undefined)
  const [id, setId] = useState<string>('')
  const [guard, setGuard] = useState(false)
  const [layer, setLayer] = useState<number>(-1) // -1 = mean
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/model_trace.json`).then((r) => (r.ok ? r.json() : null)).then(setTrace).catch(() => setTrace(null))
  }, [])

  const cases = useMemo(() => (trace ? [...new Set(trace.runs.filter((r) => r.lang === lang).map((r) => r.id))] : []), [trace, lang])
  useEffect(() => { if (cases.length && !cases.includes(id)) setId(cases[0]) }, [cases, id])
  const run = trace?.runs.find((r) => r.id === id && r.guard === guard)
  const other = trace?.runs.find((r) => r.id === id && r.guard === !guard)

  const series = useMemo(() => {
    if (!run) return []
    const rows = layer < 0 ? run.attn.slice(L0) : [run.attn[layer]]
    return run.tokens.map((_, i) => mean(rows.map((r) => r[i])))
  }, [run, layer])

  const waveRef = useRef<HTMLCanvasElement>(null)
  const heatRef = useRef<HTMLCanvasElement>(null)
  const progress = useRef(0)

  useEffect(() => { progress.current = 0 }, [id, guard, lang])

  useEffect(() => {
    if (!run) return
    const cv = waveRef.current!, ctx = cv.getContext('2d')!
    let raf = 0
    const draw = () => {
      const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      progress.current = Math.min(1, progress.current + 0.025)
      const n = series.length
      const mx = Math.max(...series.slice(1), 1e-6)
      const x = (i: number) => (i / (n - 1)) * (w - 8) + 4
      const y = (v: number) => h - 16 - Math.sqrt(Math.min(1, v / mx)) * (h - 36)
      ctx.fillStyle = '#070b14'; ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(79,172,254,0.1)'
      for (let g = 1; g < 5; g++) { ctx.beginPath(); ctx.moveTo(0, (h / 5) * g); ctx.lineTo(w, (h / 5) * g); ctx.stroke() }
      // injected span
      const [s, e] = run.ext
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, 'rgba(255,8,68,0.28)'); grad.addColorStop(1, 'rgba(255,8,68,0.04)')
      ctx.fillStyle = grad; ctx.fillRect(x(s), 0, x(e) - x(s), h)
      ctx.fillStyle = 'rgba(255,120,140,0.9)'; ctx.font = '10px monospace'; ctx.fillText(t.inj, x(s) + 4, 12)
      const upto = Math.floor(progress.current * (n - 1))
      // area + glow line
      ctx.globalCompositeOperation = 'lighter'
      const area = ctx.createLinearGradient(0, 0, 0, h)
      area.addColorStop(0, 'rgba(0,242,254,0.55)'); area.addColorStop(1, 'rgba(0,242,254,0)')
      ctx.beginPath(); ctx.moveTo(x(0), h - 16)
      for (let i = 0; i <= upto; i++) ctx.lineTo(x(i), y(series[i]))
      ctx.lineTo(x(upto), h - 16); ctx.closePath(); ctx.fillStyle = area; ctx.fill()
      for (const [w2, a, col] of [[6, 0.18, '0,242,254'], [2.5, 1, '160,255,255']] as const) {
        ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = w2; ctx.lineJoin = 'round'
        ctx.beginPath()
        for (let i = 0; i <= upto; i++) (i ? ctx.lineTo(x(i), y(series[i])) : ctx.moveTo(x(i), y(series[i])))
        ctx.stroke()
      }
      // surprisal dotted
      const sm = Math.max(...run.surprisal, 1)
      ctx.strokeStyle = 'rgba(255,210,63,0.7)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath()
      for (let i = 0; i <= upto; i++) { const yy = h - 16 - (run.surprisal[i] / sm) * (h - 36) * 0.8; i ? ctx.lineTo(x(i), yy) : ctx.moveTo(x(i), yy) }
      ctx.stroke(); ctx.setLineDash([])
      ctx.globalCompositeOperation = 'source-over'
      // scanning head
      if (progress.current < 1) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x(upto), 0, 1.5, h) }
      if (hover !== null && hover < n) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(x(hover), 0); ctx.lineTo(x(hover), h); ctx.stroke()
        ctx.beginPath(); ctx.arc(x(hover), y(series[hover]), 4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill()
      }
      ctx.fillStyle = 'rgba(180,210,240,0.7)'; ctx.font = '10px monospace'
      ctx.fillText(`${t.wave}  ·  ${layer < 0 ? t.mean : `${t.layer} ${layer}`}`, 6, h - 3)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [run, series, hover, layer, t])

  useEffect(() => {
    if (!run) return
    const cv = heatRef.current!, ctx = cv.getContext('2d')!
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const n = run.tokens.length, nl = run.attn.length
    const cw = w / n, ch = h / nl
    run.attn.forEach((row, li) => {
      const m = Math.max(...row.slice(1), 1e-6)
      row.forEach((v, i) => { ctx.fillStyle = heat(Math.sqrt(Math.min(1, v / m))); ctx.fillRect(i * cw, li * ch, cw + 0.5, ch + 0.5) })
    })
    ctx.strokeStyle = '#ff0844'; ctx.lineWidth = 2
    ctx.strokeRect(run.ext[0] * cw, 1, (run.ext[1] - run.ext[0]) * cw, h - 2)
    if (layer >= 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(0, layer * ch, w, ch) }
    else { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, L0 * ch, w, h - L0 * ch) }
  }, [run, layer])

  if (trace === undefined) return <div className="opacity-60">{t.loading}</div>
  if (trace === null || !run) return <div className="opacity-60">{t.missing}</div>

  const pct = (r: Run) => mean(r.ext_mass_by_layer.slice(L0)) * 100
  const mx2 = Math.max(...run.ext_mass_by_layer, ...(other?.ext_mass_by_layer ?? []), 0.01)
  const smax = Math.max(...series.slice(1), 1e-6)
  const unknown = run.obeyed === null
  const verdict = unknown ? t.unknown : run.kind === 'benign' ? (run.obeyed ? t.obeyed : t.benignOk) : run.obeyed ? t.obeyed : t.resisted
  const bad = run.obeyed === true

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {cases.map((c) => (
          <button key={c} onClick={() => setId(c)} className={`px-2 py-0.5 rounded border text-[12px] ${c === id ? 'border-cyan text-cyan bg-cyan/10' : 'border-slate-600 text-slate-400'}`}>{c}</button>
        ))}
        <span className="mx-1 opacity-30">|</span>
        {[false, true].map((g) => (
          <button key={String(g)} onClick={() => setGuard(g)} className={`px-2 py-0.5 rounded border text-[12px] ${g === guard ? 'border-blue text-blue bg-blue/10' : 'border-slate-600 text-slate-400'}`}>{g ? t.guard : t.noGuard}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[11px] opacity-80">
          {t.layer}: {layer < 0 ? t.mean : layer}
          <input type="range" min={-1} max={run.attn.length - 1} value={layer} onChange={(e) => setLayer(+e.target.value)} />
        </label>
      </div>

      <div onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(series.length - 1, Math.round(((e.clientX - r.left - 4) / (r.width - 8)) * (series.length - 1))))) }} onMouseLeave={() => setHover(null)}>
        <canvas ref={waveRef} className="w-full h-40 lg:h-[14vh] block rounded border border-cyan/20" />
      </div>
      <div className="text-[11px] h-4 opacity-80">
        {hover !== null ? <>#{hover} <b className="text-cyan">{JSON.stringify(run.tokens[hover])}</b> attn={((series[hover] / smax) * 100).toFixed(0)}% · surprisal={run.surprisal[hover]} bits</> : t.hover}
      </div>

      <div className="text-[11px] opacity-70">{t.heat}</div>
      <canvas ref={heatRef} className="w-full h-20 lg:h-[10vh] block rounded border border-cyan/20" />

      <div className="flex flex-wrap gap-0.5 text-[11px] leading-5 max-h-24 lg:max-h-[9vh] overflow-auto">
        {run.tokens.map((tk, i) => (
          <span key={i} onMouseEnter={() => setHover(i)} className={`px-0.5 rounded ${i >= run.ext[0] && i < run.ext[1] ? 'outline outline-1 outline-danger/60' : ''}`}
            style={{ background: heat(Math.sqrt(Math.min(1, series[i] / smax)) * 0.9), color: series[i] / smax > 0.25 ? '#000' : '#cfe8ff' }}>{tk.replace(/\n/g, '↵')}</span>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className={`border rounded p-2 ${bad ? 'border-danger' : unknown ? 'border-warn/60' : 'border-cyan/50'}`}>
          <div className="flex justify-between"><span className="panel-title">{t.reply}</span><b className={bad ? 'text-danger' : unknown ? 'text-warn' : 'text-cyan'}>{unknown ? '… ' : bad ? '⚠ ' : '✔ '}{verdict}</b></div>
          <pre className="whitespace-pre-wrap text-[11px] max-h-28 lg:max-h-[9vh] overflow-auto mt-1 text-slate-300">{run.reply.replace(/<\|[^|]*\|>/g, '·').slice(0, 700)}</pre>
        </div>
        <div className="border border-blue/30 rounded p-2">
          <div className="panel-title">{t.what}</div>
          <p className="text-[12px] mt-1">{unknown ? t.unknown : t.expl(run, pct(run), other && other.guard ? pct(other) : guard ? null : null)}</p>
          <div className="text-[11px] opacity-70 mt-2">{t.mass} — {t.massNote}</div>
          <svg viewBox="0 0 320 60" className="w-full h-14">
            {[run, other].filter(Boolean).map((r) => (
              <polyline key={String(r!.guard)} fill="none" strokeWidth="2" stroke={r!.guard ? '#4facfe' : '#ff0844'} opacity={r === run ? 1 : 0.5}
                points={r!.ext_mass_by_layer.map((v, i) => `${(i / (r!.ext_mass_by_layer.length - 1)) * 316 + 2},${56 - (v / mx2) * 52}`).join(' ')} />
            ))}
          </svg>
        </div>
      </div>
      <div className="text-[10px] text-slate-500">{trace.model} · {trace.signal}. {t.caveat}</div>
    </div>
  )
}
