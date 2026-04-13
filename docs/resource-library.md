# 本地授权资源库

这套流程用于把你本地合法持有、允许在 AIGril 里使用的资源统一导入到资源库里。

目标不是“把文件丢进仓库”，而是同时解决三件事：

- 统一目录
- 统一元数据
- 统一检索索引

## 支持类型

- 歌曲 / 音频：`.mp3` `.wav` `.flac` `.ogg` `.m4a` `.aac` `.opus`
- 歌词：`.lrc` `.txt` `.vtt` `.srt` `.ass`
- 乐谱 / MIDI / 符号音乐：`.musicxml` `.mxl` `.mei` `.abc` `.krn` `.ly` `.mid` `.midi`
- 动作：`.vrma` `.fbx` `.glb` `.gltf` `.vmd`

## 放置位置

默认扫描：

```text
input/authorized-media/
```

你也可以在命令行里额外传多个 `--source-root`。

## 导入

```powershell
python scripts\import_authorized_assets.py
```

重建导入清单时可以用：

```powershell
python scripts\import_authorized_assets.py --rebuild
```

导入后会把资源复制到：

```text
Resources/library/authorized/
```

并生成：

- `Resources/library/import-manifest.jsonl`
- `Resources/library/import-manifest.csv`
- `Resources/library/import-summary.json`

## 构建统一索引

```powershell
python scripts\build_resource_library.py
```

会生成：

```text
Resources/resource-library.json
```

这个索引会把两部分合在一起：

- 本地授权导入的歌曲 / 伴奏 / 歌词 / 乐谱 / 动作
- 现有 `motion-catalog.json` 里的动作库

## 一键同步

```powershell
pnpm run resources:authorized:sync
```

## 同名元数据

如果你想指定标题、歌手、角色、动作类别，可以给资源旁边放一个同名的 `.meta.json`：

```text
MySong.mp3
MySong.meta.json
```

示例：

```json
{
  "work_title": "My Song",
  "artist": "AIGL",
  "role": "song",
  "tags": ["cute", "live"],
  "license": "local-authorized"
}
```

动作资源示例：

```json
{
  "work_title": "Stage Dance A",
  "motion_category": "dance",
  "tags": ["stage", "cute"]
}
```

## 打包到桌面版

桌面构建脚本会在设置 `AIGRIL_INCLUDE_AUTHORIZED_LIBRARY=1` 时，把：

- `Resources/resource-library.json`
- `Resources/library/`

一起带进 `dist/`。

当前的 `pnpm desktop:start / pack / dist` 已经默认带上这个环境变量。
