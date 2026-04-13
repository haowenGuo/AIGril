# AIGril 角色包协议与 Runtime 接口

## 目标

Studio 负责创作和装配，Runtime 负责消费和运行。

这样拆开后：

- 角色编辑流和运行流不会互相污染
- 角色包可以版本化、回滚、切换
- Runtime 只拿最小必需数据，启动更轻

## 当前协议

协议定义在 [src/aigril-package-contract.js](/F:/AIGril/src/aigril-package-contract.js)。

V1 角色包包含：

1. `avatar`
2. `personality`
3. `voice`
4. `resources.slots`
5. `works`
6. `publishMeta`

### avatar

- `displayName`
- `archetype`
- `tagline`
- `silhouette`
- `runtimeFit`
- `visual`

### personality

- `summary`
- `greeting`
- `boundary`
- `catchphrase`
- `traits`

### voice

- `timbre`
- `pace`
- `singingStyle`

### resources.slots

- `songs`
- `accompaniments`
- `lyrics`
- `motions`
- `danceTemplates`
- `voicePresets`

每个槽位都有：

- `count`
- `status`

### works

作品模板是 Runtime 的演出入口，至少包含：

- `title`
- `summary`
- `resourceRefs`
- `timeline`
- `preferredMotionCategory`
- `defaultExpression`
- `stagePreset`
- `status`

说明：

- `resourceRefs` 是具体资源 ID 绑定，按 `songId / accompanimentId / lyricsId / scoreId / motionId` 存
- `timeline` 是歌词与动作段时间轴，包含 `sourceAssetId / sourceExt / motionLeadSeconds / segments`
- `resourceBindings` 旧的“数量绑定”还会兼容读取，但现在只作为遗留字段，不再是主编辑流

## 校验器

当前校验会检查：

- 角色显示名
- 人格摘要
- 版本号
- 至少一个作品模板
- 作品标题
- 动作类别合法性
- 歌曲或伴奏是否存在
- 歌词与动作缺失提醒
- 歌词时间轴是否和具体歌词资源对应
- 槽位容量是否小于作品引用需求

输出：

- `errors`
- `warnings`
- `score`
- `readyToPublish`

## Runtime manifest

Studio 发布时不把全量编辑态直接交给 Runtime，而是生成更轻的 manifest。

导出逻辑在 [src/aigril-package-contract.js](/F:/AIGril/src/aigril-package-contract.js) 的 `buildRuntimeManifest`。

当前会导出：

- `displayName`
- `greeting`
- `tagline`
- `archetype`
- `accentColor`
- `personalitySummary`
- `voice`
- `defaultMotionCategory`
- `spotlightWork`
- `works`
- `publishMeta`

其中 `works` 现在会带出：

- `resourceRefs`
- `timeline`
- `preferredMotionCategory`
- `defaultExpression`
- `stagePreset`

## Runtime 接入

注册表逻辑在 [src/runtime-package-registry.js](/F:/AIGril/src/runtime-package-registry.js)。

桌面端持久化入口：

- [electron/resource-platform.cjs](/F:/AIGril/electron/resource-platform.cjs)
- [electron/main.cjs](/F:/AIGril/electron/main.cjs)
- [electron/preload.cjs](/F:/AIGril/electron/preload.cjs)

Runtime 页面消费入口：

- [src/runtime-avatar-package.js](/F:/AIGril/src/runtime-avatar-package.js)
- [src/app.js](/F:/AIGril/src/app.js)
- [src/chat-service.js](/F:/AIGril/src/chat-service.js)
- [src/chat-tts-system.js](/F:/AIGril/src/chat-tts-system.js)

当前接入链路：

1. 启动时读取当前生效角色包
2. 把名字、颜色、版本号应用到页面
3. 把 runtime identity 传给聊天服务
4. 用默认动作类别驱动首个动作

## Studio 编辑流

当前 Studio 页面在 [src/studio-app.js](/F:/AIGril/src/studio-app.js)。

V1 流程：

1. 产品蓝图
2. 形象工坊
3. 性格与声音
4. 歌曲与动作
5. 发布接入

## 参考信号

这套结构不是照抄，而是抽它们最强的组织方式：

- [MetaHuman](https://www.metahuman.com/en-US)
- [Ready Player Me](https://docs.readyplayer.me/ready-player-me/customizing-guides/avatar-creator)
- [VRoid Studio](https://vroid.com/en/studio)
- [Character Creator](https://www.reallusion.com/character-creator/)
- [Tencent Cloud AI Digital Human](https://www.tencentcloud.com/products/ivh)
- [Canva Brand Kit](https://www.canva.com/pro/brand-kit/)
- [Figma Design Systems](https://www.figma.com/design-systems/)
