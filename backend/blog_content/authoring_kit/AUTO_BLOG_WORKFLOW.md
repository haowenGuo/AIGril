# AIGril 自动博客撰写工作流

这个文件用于 16 小时自动博客撰写任务。真正写文章、校验、提交和推送的部分由本地常驻 runner 执行；Codex heartbeat 只负责读取 runner 日志和状态，并向用户汇报。

## 当前运行目录

本次任务产物统一放在：

- `backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/`

## 执行模型

### 本地常驻 runner

真正执行任务的是：

- `scripts/auto_blog_runner.py`

启动脚本：

- `scripts/start-auto-blog-runner.ps1`

停止脚本：

- `scripts/stop-auto-blog-runner.ps1`

runner 职责：

1. 定时调用 `codex exec` 执行一轮写作
2. 读取 `RUNNER_PROMPT.md`
3. 生成一篇中英双语文章
4. 更新 `posts.json`
5. 更新 `STATUS.md` 和 `PROGRESS_LOG.md`
6. 校验 `posts.json`
7. 只 stage 博客相关文件
8. 提交当前分支
9. cherry-pick 到 `F:\AIGril_tmp_main`
10. 推送到 GitHub `main`

### heartbeat

heartbeat 不再写文章，不再执行 Git。

heartbeat 职责：

1. 读取 `RUNNER_STATUS.json`
2. 读取 `RUNNER_LOG.md`
3. 读取 `STATUS.md`
4. 读取 `PROGRESS_LOG.md`
5. 判断 runner 是否卡住或报错
6. 只向用户汇报进度、错误或需要介入的事项

## 任务目标

在 16 小时内持续研究本机项目，并整理成可发布博客内容：

- 至少研究 10 个以上本机项目
- 至少完成 10 篇以上中英双语博客文章
- 生成一份 100 页以上的最终总结文档
- 统计研究过多少本机项目、调研了多少相关内容、完成了多少文章
- 每篇文章都要说明大致内容

## 发文位置

正式文章写入：

- `backend/blog_content/posts/zh/<slug>.md`
- `backend/blog_content/posts/en/<slug>.md`

文章元数据写入：

- `backend/blog_content/posts.json`

必须遵守：

- `backend/blog_content/authoring_kit/PUBLISHING_GUIDE.md`

## runner 每轮执行顺序

1. 阅读 `RUNNER_PROMPT.md`
2. 阅读 `STATUS.md`
3. 阅读 `PROGRESS_LOG.md`
4. 查看 `PROJECT_INVENTORY.md`
5. 选择一个尚未完成文章的本机项目
6. 只读取低风险材料
7. 必要时查找公开资料辅助理解
8. 生成或完善中英双语文章
9. 更新 `posts.json`
10. 更新运行日志和统计
11. 由 runner 校验、提交和推送

## 低风险材料范围

默认允许读取：

- `README.md`
- `README.txt`
- `package.json`
- `pyproject.toml`
- `requirements.txt`
- `pom.xml`
- `Cargo.toml`
- `go.mod`
- `CMakeLists.txt`
- `docs/` 下的公开说明文档

默认禁止读取或发布：

- `.env`
- 私钥、Token、账号密码
- 数据库文件
- 用户聊天记录
- 大体积模型权重
- 未确认可公开的源码全文
- 未确认可公开的安装包和二进制文件

## 关于源码和安装包

用户希望“最好附带项目源码、下载安装包”，但自动任务必须遵守安全原则：

- 不自动把本机源码打包上传
- 不自动发布安装包
- 可以在文章或报告中记录“可发布附件候选”
- 只有项目明确是公开项目，或者用户后续确认可以发布时，才整理下载附件

## Git 提交规则

heartbeat 自动任务禁止执行 `git add` / `git commit` / `git push`。

原因：

- heartbeat 运行在受限沙箱身份中，可能无法写入 `.git/index.lock`
- heartbeat 的职责是汇报，不是执行
- 本地常驻 runner 使用普通本地进程执行 Git，更稳定
- runner 只允许提交博客相关文件，避免误提交用户其他改动

runner 提交时，只允许包含：

- `backend/blog_content/posts.json`
- `backend/blog_content/posts/zh/*.md`
- `backend/blog_content/posts/en/*.md`
- `backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/*.md`

不要提交前端、后端业务、Electron、配置密钥或其他用户改动。

heartbeat 每轮只需要：

1. 读取 runner 状态
2. 汇报新增文章数
3. 汇报最近 commit / push
4. 汇报 runner 错误或卡住状态

## 完成条件

到达以下任一条件时，停止继续新增文章，转为收尾：

- 已经运行满 16 小时
- 本地时间到达 `2026-04-22 23:50 Asia/Shanghai` 之后
- 已完成不少于 10 篇文章，并完成最终 100 页以上报告

最终报告路径：

- `backend/blog_content/auto_blog_runs/2026-04-22-16h-blog-autowriter/final_100_page_report.md`
