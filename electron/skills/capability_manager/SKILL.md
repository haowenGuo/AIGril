---
id: capability_manager
label: 能力安装与自修复 Skill
description: Capability registry, installer, skill auto-authoring, rollback, and approved repair execution.
when: 用户要求安装新能力、接入 MCP/Skill、修复工具链、或让 AIGL 自我迭代能力时。
tools:
  - capability_manager
  - tool_doctor
  - mcp_bridge
triggers:
  - 安装某个功能
  - 接入 MCP
  - 新增 Skill
  - 修复工具
  - 自我迭代能力
---

# 能力安装与自修复 Skill

这个 Skill 负责让 AIGL 把“我缺少某个功能”变成可验证的能力生命周期，而不是直接靠提示词硬猜。

## 工作方式

1. 先用 `capability_manager.registry` 或 `refresh_registry` 查看已有能力。
2. 如果能力缺失，用 `plan_install` 生成安装计划，说明来源、风险、会写哪些文件、如何验证、如何回滚。
3. 用户确认或完全控制模式允许后，再用 `install_capability` 执行。
4. 安装 MCP 后必须健康检查、导入 tool schema，并自动生成对应 `SKILL.md`。
5. 修复补丁必须先 `execute_repair` dry-run/patch check，确认后应用，验证失败要回滚。

## 边界

- 不静默安装未知来源代码。
- 不跳过验证把能力标记为可用。
- 不把内部安装日志原样暴露给普通用户，要由 Persona Surface 做自然解释。
- 密钥类配置允许本地保存，但输出和报告必须脱敏。
