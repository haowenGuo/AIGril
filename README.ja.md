<div align="center">
  <h1>AIGril / AIGRIL</h1>
  <p><strong>AIGL を中心にした embodied AI companion プロジェクトです。3D バーチャルキャラクター、対話ランタイム、デスクトップペット、教育・記憶・音声・安全サービスをひとつの方向性として育てています。</strong></p>
  <p>
    <a href="https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com"><img alt="Try AIGril" src="https://img.shields.io/badge/Try%20AIGril-Live%20Experience-2563eb?style=for-the-badge"></a>
    <a href="https://haowenGuo.github.io/AIGril/"><img alt="Frontend Demo" src="https://img.shields.io/badge/GitHub%20Pages-Frontend%20Demo-0f172a?style=for-the-badge"></a>
    <a href="https://airi-backend.onrender.com/docs"><img alt="Backend API" src="https://img.shields.io/badge/Backend-FastAPI%20Docs-059669?style=for-the-badge"></a>
  </p>
  <p>
    <a href="README.md">English</a> ·
    <a href="README.zh-CN.md">简体中文</a> ·
    <a href="README.ja.md">日本語</a>
  </p>
</div>

---

<p align="center">
  <img width="743" height="491" alt="AIGril browser experience" src="https://github.com/user-attachments/assets/80361901-7adc-459b-bc9a-ed9aa4d0a5f1" />
  <img width="566" height="389" alt="AIGril desktop companion" src="https://github.com/user-attachments/assets/4fdc700c-ea8b-41da-a1ae-98c6f33ff626" />
</p>

## AIGRIL とは

AIGril はリポジトリとプロダクト面の名前です。AIGL はキャラクターとインタラクションの中心です。

このプロジェクトの問いはシンプルです。AI アシスタントがチャットボックスの中だけに存在しないなら、どのような体験になるのか。AIGRIL は、見える身体、音声、記憶、表情、モーション、デスクトップ上の常駐性、そして具体的な利用シーンを持つ AI インターフェースを探っています。

これはバーチャルコンパニオンであり、デスクトップペットであり、AI アプリケーションフレームワークでもあります。かわいいアバターが返事をするだけではなく、キャラクターそのものを AI の入口にすることが目標です。

## 目的

AIGRIL は次の 3 つの考え方を中心にしています。

- 身体性: アシスタントには 3D VRM アバター、表情、モーション、発話状態、音声による存在感が必要です。
- 継続性: 会話は一回限りの Q&A ではなく、記憶、要約圧縮、セッション文脈によって長く続く関係として扱います。
- 実用性: 同じキャラクターを Web、デスクトップ、模擬授業、バックエンドサービスの中で使い、陪伴だけでなく実用的なタスクにもつなげます。

## 中核モジュール

| 領域 | 役割 |
| --- | --- |
| キャラクターランタイム | AIGL の VRM モデルを読み込み、VRMA モーション、表情プリセット、待機動作、発話アニメーション、まばたき、fallback リップシンクを制御します。 |
| Web 体験 | Vite、Three.js、`@pixiv/three-vrm` によるブラウザ向け 3D チャット体験です。 |
| デスクトップペット | Electron により、透明で常時最前面のペットウィンドウ、独立チャットウィンドウ、トレイ操作、位置・拡大率の保存、ローカル ASR、音声モードを提供します。 |
| 対話バックエンド | FastAPI によるストリーミング対話、モデル接続、会話保存、RAG 文脈、返信マークアップ、定期的な記憶圧縮を担当します。 |
| 模擬授業 | `/edu` で学生/教師アカウント、診断、問題バンク、課題、授業セッション、黒板表示、AI 教師対話を提供します。 |
| コンテンツシステム | 中国語・英語のブログとプロジェクト執筆パイプラインを含み、開発ログや技術記事を公開します。 |
| 安全 API | コンテンツ安全チェックのエンドポイントを提供し、総合リスク判定とアルゴリズム別の詳細を返します。 |
| デプロイ層 | フロントエンドは GitHub Pages、バックエンドは Render、デスクトップ版は Electron Builder と GitHub Actions で配布します。 |

## プロジェクトの方向性

AIGRIL は単体のデモではなく、身体性を持つ AI アシスタント基盤へ向かっています。

- チャット UI から embodied interface へ: アバター、モーション、音声、感情表現をインタラクションの一部として扱います。
- 単発回答から長期陪伴へ: 記憶と要約圧縮をバックエンドの中心的な能力として扱います。
- ブラウザデモから日常のデスクトップへ: デスクトップペットにより、AIGL をユーザーの作業環境に近づけます。
- 汎用チャットからシナリオシステムへ: 模擬授業は、AIGL が教師、ガイド、役割を持つ Agent になれることを示します。
- フロントエンド実験からデプロイ可能なプロダクトへ: フロントエンド、バックエンド、パッケージング、デプロイ、ドキュメント、記事公開を同じエコシステムで扱います。

## 体験リンク

- フル Web 体験: [https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com](https://haowenGuo.github.io/AIGril/?backend=https://airi-backend.onrender.com)
- フロントエンドのみのデモ: [https://haowenGuo.github.io/AIGril/](https://haowenGuo.github.io/AIGril/)
- バックエンド API ドキュメント: [https://airi-backend.onrender.com/docs](https://airi-backend.onrender.com/docs)
- 模擬授業: [https://airi-backend.onrender.com/edu](https://airi-backend.onrender.com/edu)
- プロジェクト記事/ブログ: [https://airi-backend.onrender.com/blog](https://airi-backend.onrender.com/blog)

## アーキテクチャ

```text
Resources/   AIGL の VRM モデルと VRMA モーション素材
src/         ブラウザランタイム、VRM システム、チャットパネル、TTS/音声、デスクトップ描画入口
electron/    デスクトップペット shell、preload bridge、トレイ/メニュー、状態保存、ローカル ASR worker
backend/     FastAPI アプリ、chat、memory、RAG、TTS、safety、blog、education、Vivix routes
docs/        模擬授業の納品・反復記録
scripts/     静的ビルドと公開補助スクリプト
examples/    独立した開発サンプル
```

## 技術スタック

- フロントエンド: Vite、Three.js、`@pixiv/three-vrm`、`@pixiv/three-vrm-animation`
- デスクトップ: Electron、Electron Builder、ローカル Python ASR worker
- バックエンド: FastAPI、SQLAlchemy、SQLite
- AI 連携: OpenAI 互換チャット API、RAG service、memory compression、safety service
- デプロイ: GitHub Pages、Render、GitHub Actions

## ローカル実行

### Web

```bash
pnpm install
pnpm dev
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy backend\.env.example backend\.env
python -m uvicorn backend.main:app --reload
```

必要な環境変数:

```env
LLM_API_KEY=your_llm_api_key
```

### デスクトップペット

```bash
pnpm install
python -m pip install -r requirements-desktop-asr.txt
pnpm desktop:start
```

デスクトップ版メモ:

- ローカル音声認識は Electron 版だけで使う任意機能です。
- 現在の ASR はローカル Python worker と Whisper Small を使います。
- 初回 ASR 実行時に音声モデルをダウンロードしてキャッシュする場合があります。
- Linux では Electron の Wayland 上のウィンドウ制御制限を避けるため、デスクトップペットは X11 を既定にしています。

### デスクトップ開発

```bash
pnpm desktop:dev
```

## パッケージング

```bash
pnpm desktop:package:win
pnpm desktop:package:linux
pnpm desktop:package:mac:x64
pnpm desktop:package:mac:arm64
```

デスクトップ成果物は `release/` に出力されます。再現性のあるマルチプラットフォームビルドには [`.github/workflows/build-desktop-packages.yml`](.github/workflows/build-desktop-packages.yml) を使用できます。

## 長期ビジョン

AIGRIL は、やさしく、それでいて実用的な AI の存在を目指しています。陪伴し、教え、記憶し、話し、デスクトップに常駐し、さらに多くのツールやワークフローにつながっていく。その過程でも、一貫したキャラクター型インターフェースであり続けることを大切にしています。
