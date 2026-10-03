import type { Lang } from '../types/defense'
import { T } from '../engine/i18n'

const S = {
  ja: { label: '外部データ(攻撃文)', run: '▶ モデルで実行', connect: 'モデル接続', connected: '接続中', hint: 'Ctrl/⌘+Enter で実行', busy: '実行中…' },
  en: { label: 'External data (attack text)', run: '▶ Run on model', connect: 'Connect model', connected: 'connected', hint: 'Ctrl/⌘+Enter to run', busy: 'running…' },
}

interface Props {
  lang: Lang
  value: string
  onChange: (v: string) => void
  modelName?: string
  busy: boolean
  onRun: () => void
  onConnect: () => void
}

export function PromptDock({ lang, value, onChange, modelName, busy, onRun, onConnect }: Props) {
  const t = S[lang]
  return (
    <div className="panel p-2 lg:p-3 sticky bottom-0 z-20 border-cyan/50 shadow-[0_-8px_30px_rgba(0,242,254,0.12)]">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="panel-title mr-1">{t.label}</span>
        {T[lang].presets.map((p) => (
          <button key={p.label} onClick={() => onChange(p.text)} className="px-2 py-0.5 border border-cyan/40 rounded text-cyan hover:bg-cyan/10 text-[11px]">{p.label}</button>
        ))}
        <button onClick={() => onChange('')} className="px-2 py-0.5 border border-slate-500/40 rounded text-slate-400 hover:bg-white/5 text-[11px]">{T[lang].clear}</button>
        <button onClick={onConnect} className={`ml-auto max-w-[40%] truncate px-2 py-0.5 rounded border text-[11px] ${modelName ? 'border-cyan text-cyan' : 'border-blue/50 text-blue'}`}>
          {modelName ? `● ${t.connected}: ${modelName.split('/').pop()}` : `⚙ ${t.connect}`}
        </button>
      </div>
      <div className="flex gap-2 items-stretch">
        <textarea
          value={value}
          rows={2}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && modelName && !busy) onRun() }}
          placeholder={T[lang].placeholder}
          className="flex-1 bg-black/50 border border-cyan/40 rounded px-3 py-2 text-slate-100 outline-none focus:border-cyan focus:shadow-[0_0_12px_rgba(0,242,254,0.3)] resize-none text-[14px]"
        />
        <button onClick={onRun} disabled={!modelName || busy || !value.trim()} title={modelName ? t.hint : t.connect}
          className="px-4 rounded border border-cyan text-cyan bg-cyan/10 hover:bg-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
          {busy ? t.busy : t.run}
        </button>
      </div>
    </div>
  )
}
