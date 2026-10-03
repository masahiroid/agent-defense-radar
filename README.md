# Agent Defense Radar

[English](#english) | [日本語](#日本語)

**Live demo:** https://huggingface.co/spaces/masahiroid/agent-defense-radar

## English

A defensive visualization of **indirect prompt injection** against LLM agents (Japanese / English). It combines three things, and says clearly which parts are real:

| Panel | Source |
|---|---|
| **MODEL X-RAY** | **Recorded from a real model** (LLM-jp-4.1-8B-thinking, 4-bit MLX): attention from the final prompt position to every token (per layer), token surprisal, the model's actual output, and a rule-based *obeyed / resisted* verdict, with and without a guard prompt. 12 cases × 2. Data: [`public/data/model_trace.json`](public/data/model_trace.json) |
| **LIVE MODEL TEST** | Connect **your own** OpenAI-compatible endpoint (Ollama, LM Studio, llama.cpp, vLLM, hosted APIs) from the browser. Your text is sent twice (no guard / with guard prompt) using the same harness as the recording; the verdict is rule-based on the final answer. The API key stays in tab memory. |
| **Radar HUD / Gates / Thinking** | Live heuristics on the text you type (normalization, look-alike characters, spoofed tags). Embeddings are a char-bigram stand-in and the thinking log is a mock. |

**What the recording shows** (one run per case, so no statistics): most attacks are resisted by this model; an AgentDojo-style "important message" injection is followed (in English even with the guard prompt). Attention on the injected span is only a few percent: attention is a correlational clue, **not** a causal explanation.

### Run

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

### Regenerate the recording

Needs Apple Silicon and `mlx-lm` (about 10 minutes on a 16 GB Mac):

```bash
pip install mlx-lm
python tools/trace_model.py trace.json      # env RADAR_MODEL=<hf-id or local dir> to use another model
```

The script verifies at run time that its manual forward pass matches the library's output. Runs whose reasoning did not finish within the token limit are marked *inconclusive* (`obeyed: null`). Copy the result to `public/data/model_trace.json`.

### Notes

- A defensive, educational tool. The injection texts are short, known patterns in the spirit of public datasets (AgentDojo, BIPIA); nothing here is a new real-world exploit.
- Related: [japanese-llm-security](https://github.com/masahiroid/japanese-llm-security), [model-audit-lite](https://github.com/masahiroid/model-audit-lite), [agentdojo-ja](https://github.com/masahiroid/agentdojo-ja).
- License: Apache-2.0. Please cite via [`CITATION.cff`](CITATION.cff).

## 日本語

LLM エージェントに対する**間接プロンプトインジェクション**を可視化する、防御目的のツールです（日本語・英語）。3つの要素があり、どこが実測でどこが簡易かを、はっきり分けています。

| パネル | 出どころ |
|---|---|
| **MODEL X-RAY** | **実モデル（LLM-jp-4.1-8B-thinking、4bit MLX）から記録**: 返答開始位置から各トークンへの注意（層ごと）、トークンの驚き度、実際の出力、規則ベースの「従った／従わなかった」判定。ガード文あり・なしの比較。12ケース×2。データ: [`public/data/model_trace.json`](public/data/model_trace.json) |
| **LIVE MODEL TEST** | **自分の** OpenAI互換エンドポイント（Ollama、LM Studio、llama.cpp、vLLM、各社API）にブラウザから接続。記録と同じハーネスで、ガード無し／有りの2回を送信し、最終回答を規則で判定。APIキーはタブのメモリ内のみ。 |
| **Radar HUD / ゲート / 思考** | 入力文のライブなヒューリスティック（正規化、紛らわしい文字、偽タグ）。埋め込みは文字2-gramの代用、思考ログはモックです。 |

**記録から分かること**（各ケース1回なので統計ではありません）: このモデルは多くの攻撃に従いませんが、AgentDojo型の「重要なメッセージ」攻撃には従います（英語ではガード文があっても従う）。注入文への注意はわずか数%で、注意は相関の手がかりであり、**因果の説明ではありません**。

### 実行

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # dist/ に静的サイトを出力
```

### 記録の再生成

Apple Silicon と `mlx-lm` が必要です（16GBのMacで約10分）。

```bash
pip install mlx-lm
python tools/trace_model.py trace.json      # 別モデルは環境変数 RADAR_MODEL（HFのIDかローカルのディレクトリ）
```

実行時に、手動の forward の出力がライブラリの出力と一致するか検査します。トークン上限までに推論が終わらなかった回は「未確定」（`obeyed: null`）です。結果は `public/data/model_trace.json` に置いてください。

### 補足

- 防御目的・教育目的のツールです。インジェクション文は、公開データセット（AgentDojo、BIPIA）の精神にそった短い既知のパターンで、新しい実害のある手口は含みません。
- 関連: [japanese-llm-security](https://github.com/masahiroid/japanese-llm-security)、[model-audit-lite](https://github.com/masahiroid/model-audit-lite)、[agentdojo-ja](https://github.com/masahiroid/agentdojo-ja)。
- ライセンス: Apache-2.0。引用は [`CITATION.cff`](CITATION.cff) をご利用ください。
