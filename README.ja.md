# AIRI

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

AIRI は、3D VRM アバター、ストリーミング対話、表情豊かなモーション、軽量な記憶機能を備えたブラウザ向けバーチャルコンパニオンです。

## 体験リンク

- フル体験版: [https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com](https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com)
- フロントエンドのみのデモ: [https://haowenGuo.github.io/AIGril/](https://haowenGuo.github.io/AIGril/)
- バックエンド API ドキュメント: [https://airi-backend.onrender.com/docs](https://airi-backend.onrender.com/docs)

## AIRI でできること

- ブラウザ上で 3D VRM アバターを表示
- FastAPI バックエンドからテキストをストリーミング返信
- モデル出力の制御タグでアクションと表情を切り替え
- 待機、ダンス、驚き、怒りなどのモーション再生
- リップシンク、まばたき、発話状態アニメーション
- 会話履歴を保存し、古い内容を定期的に要約圧縮

## 特徴

- ストリーミング返信により体感待ち時間を軽減
- テキストだけでなく、動きと表情で反応するキャラクター体験
- フロントエンドは GitHub Pages、バックエンドは Render で公開
- アバター制御、チャット制御、バックエンド処理を分離した構成

## 技術スタック

- フロントエンド: Vite、Three.js、`@pixiv/three-vrm`
- バックエンド: FastAPI、SQLAlchemy、SQLite
- LLM 接続: OpenAI 互換 API
- デプロイ: GitHub Pages + Render

## ローカル実行

### フロントエンド

```bash
pnpm install
pnpm dev
```

### バックエンド

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy backend\.env.example backend\.env
python -m uvicorn backend.main:app --reload
```

最低限必要な環境変数:

```env
LLM_API_KEY=your_llm_api_key
```

## 構成

```text
backend/   FastAPI API、記憶ロジック、デプロイ設定
src/       VRM アバター、チャット UI、アクション、表情、フロントエンド処理
Resources/ VRM モデルと VRMA アセット
scripts/   静的ビルド補助スクリプト
```

## デプロイ

- 公開フロントエンド: GitHub Pages
- 公開バックエンド: Render
- Render 設定: [`render.yaml`](render.yaml)

## 目標

Web 上で、応答性が高く表現力のあるバーチャルキャラクター体験を提供しつつ、今後の改善や拡張がしやすい構成を保つことを目指しています。
