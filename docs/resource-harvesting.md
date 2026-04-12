# AIGL 资源爬取方案

这套脚本用于发现 AIGL 可用的动作和音乐文本资源。默认策略是先生成候选清单，不直接下载；只有资源许可证通过白名单，并且手动加上 `--download` 时，才会把文件或元数据保存到 `output/resource-harvest/`。

## 资源范围

动作资源：

- `.fbx`
- `.vrma`

音乐文本/结构化音乐资源：

- `.musicxml`
- `.mxl`
- `.mei`
- `.abc`
- `.krn`
- `.ly`
- `.mid`
- `.midi`
- MusicBrainz / Openverse 的音乐元数据 JSON

不抓取：

- 歌词站、商业曲库、登录后才能访问的资源
- Mixamo、Sketchfab 等需要遵循平台授权和下载流程的页面
- 没有明确授权或许可证不清楚的资源
- 默认不抓取 CC BY-NC、CC BY-ND 这类商业或改编受限资源

## 当前来源

- Internet Archive：通过 Advanced Search API 搜索，再用 metadata API 查文件列表。
- GitHub：通过 REST code search 搜索文件，需要 `GITHUB_TOKEN`，并检查仓库 license endpoint。
- MusicBrainz：只收集音乐元数据，不包含歌词和音频。
- Openverse：只收集开放许可音频的元数据和来源链接，默认不下载音频。
- Curated commercial motion：高质量动作包白名单，优先包含明确许可的 Thingiverse 动作包，以及可下载到待审目录的 Rokoko 免费动作包。

## 快速运行

只发现候选动作资源：

```powershell
python scripts\harvest_aigl_resources.py --kind motion --limit 5
```

只发现音乐文本/元数据资源：

```powershell
python scripts\harvest_aigl_resources.py --kind music-text --limit 5
```

指定查询词：

```powershell
python scripts\harvest_aigl_resources.py --kind motion --source internet-archive --query "fbx dance animation" --limit 10
```

下载通过白名单的资源或元数据：

```powershell
python scripts\harvest_aigl_resources.py --kind all --limit 5 --download
```

动作资源的许可证经常没有机器可读字段。可以只生成“人工复核候选”，不下载文件：

```powershell
python scripts\harvest_aigl_resources.py --kind motion --source internet-archive --query "mocap fbx" --include-review-candidates --limit 10
```

下载高质量商业免费动作包：

```powershell
python scripts\harvest_aigl_resources.py --kind motion --source curated-commercial --download --download-review-motion-packs --limit 50
```

其中：

- 明确许可的动作包会进入 `downloads/motion/verified/curated-commercial/`
- 需要人工复核条款的动作包会进入 `downloads/motion/review/rokoko-curated/`

使用 GitHub 搜索：

```powershell
$env:GITHUB_TOKEN = "your_github_token"
python scripts\harvest_aigl_resources.py --source github --kind motion --limit 10
```

建议设置联系信息，尤其是使用 MusicBrainz 时：

```powershell
$env:AIGRIL_HARVESTER_CONTACT = "your-email@example.com"
```

## 输出

每次运行都会创建一个时间戳目录：

```text
output/resource-harvest/YYYYMMDD-HHMMSS/
```

其中包含：

- `manifest.jsonl`：完整机器可读清单
- `manifest.csv`：方便人工筛选的表格
- `ATTRIBUTIONS.md`：署名草稿
- `downloads/`：只有加 `--download` 时才会出现下载文件或元数据 JSON

## 许可证审查

脚本只做第一层筛选，不能替代人工审查。尤其要注意：

- GitHub 的许可证是仓库级别，单个资产可能有额外授权说明。
- Internet Archive 的 `licenseurl` 来自条目元数据，需要打开条目页面复核。
- Openverse 聚合不同来源，发布前仍应打开原始页面复核。
- MusicBrainz 收集的是元数据，不是歌词或歌曲文件。

发布进 `Resources/` 前，建议把最终保留的资源与其来源、作者、许可证链接一起记录到项目文档。
