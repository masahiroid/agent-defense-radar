import { useEffect, useRef } from 'react'
import type { AtlasPoint } from '../types/defense'

interface Props {
  points: AtlasPoint[]
  target: [number, number]
  active: boolean
}

export function MiniAtlas({ points, target, active }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const st = useRef({ points, target, active, cur: [0, 0] as [number, number] })
  st.current.points = points
  st.current.target = target
  st.current.active = active

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    let raf = 0
    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1
      const w = cv.clientWidth, h = cv.clientHeight
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const s = st.current
      const px = (x: number) => ((x + 1) / 2) * w
      const py = (y: number) => ((1 - y) / 2) * h
      ctx.strokeStyle = 'rgba(79,172,254,0.15)'
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()
      for (const p of s.points) {
        const bob = Math.sin(t / 700 + p.x * 9) * 1.5
        ctx.fillStyle = p.label === 'attack' ? 'rgba(255,8,68,0.85)' : 'rgba(79,172,254,0.85)'
        ctx.shadowColor = ctx.fillStyle as string
        ctx.shadowBlur = 8
        ctx.beginPath(); ctx.arc(px(p.x), py(p.y) + bob, 3.5, 0, Math.PI * 2); ctx.fill()
      }
      ctx.shadowBlur = 0
      if (s.active) {
        s.cur[0] += (s.target[0] - s.cur[0]) * 0.15
        s.cur[1] += (s.target[1] - s.cur[1]) * 0.15
        const x = px(s.cur[0]), y = py(s.cur[1])
        const r = 9 + Math.sin(t / 200) * 2
        ctx.strokeStyle = '#ffd23f'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x - r - 5, y); ctx.lineTo(x + r + 5, y); ctx.moveTo(x, y - r - 5); ctx.lineTo(x, y + r + 5); ctx.stroke()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div>
      <canvas ref={ref} className="w-full h-40 lg:h-[40vh] block" />
      <div className="text-[10px] mt-1 opacity-80">
        <span className="text-blue">● safe</span> <span className="text-danger ml-3">● attack (agentdojo-ja / bipia-ja)</span>
        <span className="text-warn ml-3">◎ input</span>
      </div>
    </div>
  )
}
