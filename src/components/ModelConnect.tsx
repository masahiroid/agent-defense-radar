import { useState } from 'react'
import { ConnectError, ENDPOINT_PRESETS, testConnection, type ModelConfig } from '../engine/liveModel'
import type { Lang } from '../types/defense'

const S = {
  ja: {
    title: '自分のモデルに接続', desc: 'OpenAI互換の /chat/completions に、ブラウザから直接つなぎます。通信先はあなたが指定したURLだけです。',
    base: 'ベースURL', model: 'モデル名', key: 'APIキー (必要な場合のみ)', keyNote: 'キーはこのタブのメモリ内だけに保持し、保存しません。',
    test: '接続テスト', ok: '接続OK', save: '保存して閉じる', disconnect: '切断', cancel: '閉じる',
    cors: 'ブラウザから届きません。ローカルサーバーなら CORS の許可が必要です(例: Ollama は OLLAMA_ORIGINS="*"、LM Studio は設定の「CORSを有効にする」)。',
    http: 'サーバーがエラーを返しました: ',
  },
  en: {
    title: 'Connect your own model', desc: 'The browser talks directly to an OpenAI-compatible /chat/completions endpoint. Requests go only to the URL you enter.',
    base: 'Base URL', model: 'Model name', key: 'API key (only if required)', keyNote: 'The key lives in this tab’s memory only and is never stored.',
    test: 'Test connection', ok: 'Connected', save: 'Save & close', disconnect: 'Disconnect', cancel: 'Close',
    cors: 'The browser could not reach it. Local servers need CORS enabled (e.g. Ollama: OLLAMA_ORIGINS="*"; LM Studio: “Enable CORS” in server settings).',
    http: 'The server returned an error: ',
  },
}

interface Props { lang: Lang; value: ModelConfig | null; onSave: (c: ModelConfig | null) => void; onClose: () => void }

export function ModelConnect({ lang, value, onSave, onClose }: Props) {
  const t = S[lang]
  const [cfg, setCfg] = useState<ModelConfig>(value ?? { baseUrl: ENDPOINT_PRESETS[0].baseUrl, model: '', apiKey: '' })
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' })
  const set = (p: Partial<ModelConfig>) => { setCfg({ ...cfg, ...p }); setStatus({ kind: 'idle' }) }

  const test = async () => {
    setStatus({ kind: 'busy' })
    try { await testConnection(cfg); setStatus({ kind: 'ok' }) }
    catch (e) {
      const ce = e as ConnectError
      setStatus({ kind: 'err', msg: ce.kind === 'http' ? t.http + ce.message : t.cors })
    }
  }
  const input = 'w-full bg-black/40 border border-blue/30 rounded px-2 py-1 text-slate-100 outline-none focus:border-cyan'

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel p-4 w-full max-w-lg flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-cyan font-semibold tracking-wider">{t.title}</div>
        <p className="text-[12px] text-slate-400">{t.desc}</p>
        <div className="flex flex-wrap gap-2">
          {ENDPOINT_PRESETS.map((p) => (
            <button key={p.label} onClick={() => set({ baseUrl: p.baseUrl })} className={`px-2 py-0.5 rounded border text-[11px] ${cfg.baseUrl === p.baseUrl ? 'border-cyan text-cyan' : 'border-slate-600 text-slate-400'}`}>{p.label}</button>
          ))}
        </div>
        <label className="text-[11px] text-slate-400">{t.base}<input className={input} value={cfg.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} /></label>
        <label className="text-[11px] text-slate-400">{t.model}<input className={input} value={cfg.model} placeholder="llama3.1:8b / gpt-4o-mini / …" onChange={(e) => set({ model: e.target.value })} /></label>
        <label className="text-[11px] text-slate-400">{t.key}<input type="password" autoComplete="off" className={input} value={cfg.apiKey} onChange={(e) => set({ apiKey: e.target.value })} /><span className="text-slate-500">{t.keyNote}</span></label>
        {status.kind === 'ok' && <div className="text-cyan text-[12px]">✔ {t.ok}</div>}
        {status.kind === 'err' && <div className="text-danger text-[12px]">{status.msg}</div>}
        <div className="flex gap-2 justify-end">
          {value && <button onClick={() => { onSave(null); onClose() }} className="px-3 py-1 border border-danger/60 text-danger rounded text-[12px]">{t.disconnect}</button>}
          <button onClick={onClose} className="px-3 py-1 border border-slate-600 text-slate-300 rounded text-[12px]">{t.cancel}</button>
          <button onClick={test} disabled={!cfg.model || status.kind === 'busy'} className="px-3 py-1 border border-blue/60 text-blue rounded text-[12px] disabled:opacity-40">{status.kind === 'busy' ? '…' : t.test}</button>
          <button onClick={() => { onSave(cfg); onClose() }} disabled={!cfg.model} className="px-3 py-1 border border-cyan text-cyan bg-cyan/10 rounded text-[12px] disabled:opacity-40">{t.save}</button>
        </div>
      </div>
    </div>
  )
}
