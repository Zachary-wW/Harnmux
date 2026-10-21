# Harness Bridge

在原生 AI 编程应用中，委派其他 harness 的原生 worker 协作完成项目。

项目目前处于需求澄清阶段。Git 和官方 Spec Kit 1.2.2 已初始化，尚未实现运行时。

## 首版目标

- macOS，支持 Codex 与 DeepSeek Harness 双向委派。
- 每个 worker 保留自己的 harness 执行循环。
- 支持任务创建、会话续接、取消、状态查询与异步回报。
- 状态栏显示任务运行、等待处理、完成与失败。
- 复用模型路由工具或 harness 原有配置，按会话隔离模型选择。

## 开发流程

使用 [GitHub Spec Kit](https://github.com/github/spec-kit) 管理项目原则、规格、计划、任务和验证记录。使用 grilling 访谈逐轮澄清设计决策，记录用户答案后再推进依赖这些答案的实现。

当前范围、待决策项与环境事实见 [项目发现记录](docs/discovery.md)。

Spec Kit 已安装 Codex 集成，命令技能位于 `.agents/skills/`，官方模板和工作流位于 `.specify/`。项目 constitution 目前仍为官方模板，将在设计访谈收敛后定稿。

本仓库尚未配置远程地址，也尚未发布。
