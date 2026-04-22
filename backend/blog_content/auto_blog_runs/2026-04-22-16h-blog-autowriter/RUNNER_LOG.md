# AIGril Auto Blog Runner Log

## 2026-04-22 10:10 Runner Configured

- 执行器：`scripts/auto_blog_runner.py`
- 单轮提示：`RUNNER_PROMPT.md`
- 状态文件：`RUNNER_STATUS.json`
- 运行策略：本地 runner 负责写作、校验、提交、推送；heartbeat 只读取日志并汇报
- Git 策略：runner 只允许提交博客内容层相关文件
