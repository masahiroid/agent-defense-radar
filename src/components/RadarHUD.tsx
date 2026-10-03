import { useEffect, useRef } from 'react'

interface Props {
  risk: number // 0..1
  entropy: number
  halfWidthRatio: number
  hist: number[]
  labels: string[]
  pulseKey: number // bump to fire a shockwave
  halfLabel: string
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function riskRGB(r: number): [number, number, number] {
  return r < 0.5
    ? [lerp(0, 255, r * 2), lerp(242, 210, r * 2), lerp(254, 63, r * 2)]
    : [255, lerp(210, 8, (r - 0.5) * 2), lerp(63, 68, (r - 0.5) * 2)]
}
const rgba = (c: number[], a: number) => `rgba(${c.map(Math.round).join(',')},${a})`

interface Spark { x: number; y: number; vx: number; vy: number; life: number }

export function RadarHUD({ risk, entropy, halfWidthRatio, hist, labels, pulseKey, halfLabel }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const st = useRef({ risk, entropy, halfWidthRatio, hist, labels, shown: 0, bars: new Array(8).fill(0), sparks: [] as Spark[], pulseAt: -1e9, lastPulse: pulseKey })
  Object.assign(st.current, { risk, entropy, halfWidthRatio, hist, labels })
  if (st.current.lastPulse !== pulseKey) { st.current.lastPulse = pulseKey; st.current.pulseAt = performance.now() }

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    let raf = 0
    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1
      const w = cv.clientWidth, h = cv.clientHeight
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const s = st.current
      s.shown += (s.risk - s.shown) * 0.07
      const R = s.shown
      const col = riskRGB(R)

      // background + vignette glow
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#070b14'
      ctx.fillRect(0, 0, w, h)
      const bg = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, w * 0.6)
      bg.addColorStop(0, rgba(col, 0.10 + R * 0.12))
      bg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // perspective grid scrolling toward the viewer
      const waveH = h * 0.68
      ctx.strokeStyle = rgba(col, 0.14)
      ctx.lineWidth = 1
      const hor = waveH * 0.5
      for (let i = 0; i < 12; i++) {
        const k = ((i + (t / 900) % 1) / 12) ** 2
        const y = hor + k * (waveH - hor + 10)
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }
      for (let i = -10; i <= 10; i++) {
        ctx.beginPath(); ctx.moveTo(w / 2 + i * 6, hor); ctx.lineTo(w / 2 + i * w * 0.09, waveH + 10); ctx.stroke()
      }

      // layered waves, additive glow, chromatic split rises with risk
      const amp = waveH * (0.10 + 0.36 * R)
      const base = 0.012 + 0.03 * (s.entropy + s.halfWidthRatio * 3)
      ctx.globalCompositeOperation = 'lighter'
      const layers = [
        { c: [0, 242, 254], off: -2 - R * 6, a: 0.55, k: 1, ph: 0 },
        { c: [255, 8, 68], off: 2 + R * 6, a: 0.35 + R * 0.4, k: 1.07, ph: 0.4 },
        { c: col, off: 0, a: 1, k: 1.0, ph: 0.2 },
      ]
      const jag = R > 0.55 ? (R - 0.55) * 2.2 : 0
      for (const L of layers) {
        ctx.strokeStyle = rgba(L.c, L.a)
        ctx.shadowColor = rgba(L.c, 1)
        ctx.shadowBlur = 14 + R * 16
        ctx.lineWidth = L === layers[2] ? 2.5 : 1.5
        ctx.beginPath()
        for (let x = 0; x <= w; x += 2) {
          const env = Math.sin((x / w) * Math.PI) ** 0.6 // fade at edges
          const p = x * base * L.k + t / 170 + L.ph
          let y = waveH / 2 + Math.sin(p) * amp * 0.65 * env
          y += Math.sin(p * 2.9 + t / 330) * amp * 0.3 * (0.3 + s.entropy) * env
          y += Math.sin(p * 7.3 - t / 110) * amp * 0.18 * R * env
          // spiky glitch bursts
          y += (Math.sin(x * 12.9898 + Math.floor(t / 60) * 4.1) > 0.9 ? 1 : 0) * (Math.random() - 0.5) * amp * jag * 1.4
          y += L.off
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.shadowBlur = 0

      // sparks
      if (R > 0.35 && s.sparks.length < 90) {
        for (let i = 0; i < Math.ceil(R * 3); i++) {
          const x = Math.random() * w
          s.sparks.push({ x, y: waveH / 2 + Math.sin(x * base + t / 170) * amp * 0.5, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 2.2 - 0.4, life: 1 })
        }
      }
      s.sparks = s.sparks.filter((p) => (p.life -= 0.02) > 0)
      for (const p of s.sparks) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.03
        ctx.fillStyle = rgba(col, p.life)
        ctx.fillRect(p.x, p.y, 2, 2)
      }

      // shockwave on critical verdict
      const age = (performance.now() - s.pulseAt) / 900
      if (age >= 0 && age < 1) {
        for (let i = 0; i < 3; i++) {
          const a = Math.max(0, age - i * 0.12)
          ctx.strokeStyle = rgba([255, 8, 68], (1 - a) * 0.8)
          ctx.lineWidth = 3 - i
          ctx.beginPath(); ctx.ellipse(w / 2, waveH / 2, a * w * 0.6, a * waveH * 0.6, 0, 0, Math.PI * 2); ctx.stroke()
        }
      }

      // spectrum bars (character-class distribution)
      ctx.globalCompositeOperation = 'source-over'
      const n = s.hist.length
      const bw = w / n
      const baseY = h - 14
      const maxH = h - waveH - 20
      for (let i = 0; i < n; i++) {
        s.bars[i] += (s.hist[i] - s.bars[i]) * 0.15
        const bh = Math.max(2, s.bars[i] * maxH * 1.6)
        const g = ctx.createLinearGradient(0, baseY - bh, 0, baseY)
        const isHalf = i === 2
        g.addColorStop(0, isHalf && s.bars[i] > 0.02 ? 'rgba(255,8,68,0.95)' : rgba(col, 0.95))
        g.addColorStop(1, 'rgba(0,242,254,0.15)')
        ctx.fillStyle = g
        ctx.fillRect(i * bw + bw * 0.18, baseY - bh, bw * 0.64, bh)
        ctx.fillStyle = 'rgba(180,210,240,0.7)'
        ctx.font = '10px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(s.labels[i] ?? '', i * bw + bw / 2, h - 3)
      }

      // scanline + glitch slice
      ctx.fillStyle = 'rgba(0,242,254,0.05)'
      ctx.fillRect(0, ((t / 14) % (h + 40)) - 20, w, 14)
      if (R > 0.6 && Math.random() < R * 0.12) {
        const y = Math.random() * waveH, sh = 6 + Math.random() * 14, dx = (Math.random() - 0.5) * 30
        ctx.drawImage(cv, 0, y * dpr, w * dpr, sh * dpr, dx, y, w, sh)
      }

      // HUD text
      ctx.fillStyle = rgba(col, 0.95)
      ctx.font = '600 22px "JetBrains Mono", monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`${Math.round(R * 100)}%`, 10, 28)
      ctx.font = '10px "JetBrains Mono", monospace'
      ctx.fillStyle = 'rgba(180,210,240,0.8)'
      ctx.fillText(`RISK  ·  H=${s.entropy.toFixed(2)}  ·  ${halfLabel} ${(s.halfWidthRatio * 100).toFixed(0)}%`, 10, 42)

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [halfLabel])

  return <canvas ref={ref} className="w-full h-44 lg:h-[30vh] block rounded border border-cyan/20" />
}
