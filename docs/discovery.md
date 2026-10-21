# 项目发现与设计访谈

日期：2026-10-21（Asia/Shanghai）

## 已由用户确认的目标

1. 开发开源 MVP，在现有 Desktop 应用中组织跨 harness 协作。
2. 首版范围为 macOS、Codex 与 DSH、双向委派、独立模型配置、状态栏监控。
3. Leader 是可变角色，各成员使用自己的原生 harness。
4. 与 Magpie 等模型 router 组合，模型与 harness 分别选择。
5. 使用 GitHub Spec Kit 和 grill-me/grilling 方法完善项目规范。
6. 在当前目录创建独立文件夹并初始化 Git。

## 设计树

- 原生 Desktop 中发起委派（已确认）
  - worker 在宿主中的呈现方式（第一轮 Q1）
    - 事件、摘要与任务入口的具体协议（等待 Q1）
- Codex 与 DSH 双向执行（已确认）
  - worktree 与执行权限策略（第一轮 Q2）
    - 审批转交、失败与清理规则（等待 Q2）
- 组合模型 router（已确认）
  - router 集成边界（第一轮 Q3）
    - 每任务配置与并发隔离方法（等待 Q3）
- 异步回报（已确认）
  - 原生会话接入与唤醒接口（需要环境和协议事实）
    - 不支持的能力如何报告（等待事实与后续决策）

## 第一轮：等待用户答案

### Q1：worker 呈现

- A（推荐）：工具进度与结果 + 状态栏；原生跳转按能力提供。
- B：必须融入各家 Desktop 的原生子 agent 会话树。

### Q2：代码修改与权限

- A（推荐）：独立 Git worktree，保留 harness 权限边界，审批时等待处理。
- B：独立 worktree，用户在配置中明确开启自动执行。

### Q3：模型 router 边界

- A（推荐）：复用已有 Magpie/harness 配置，按任务选择模型或使用默认值。
- B：同时安装和管理 router、模型提供商与账号。

## 已核实的本机事实

- 系统：macOS arm64。
- Node.js：v22.23.3。
- npm：10.9.9。
- Swift：6.3.3。
- Git：2.49.0。
- uv：0.7.3。
- Codex：`/Users/weizhihao/.local/bin/codex`，版本 0.142.5；`app-server --help` 已核实 stdio、Unix socket 和 WebSocket 传输入口，但尚未验证真实 Desktop 接入与唤醒。
- `dsh` 当前未在 PATH 中找到；不据此认定其他路径或应用中不存在 DSH。

未读取凭据，未修改全局 harness 配置，未运行消耗模型额度的验收任务。

## 规范流程

1. 使用官方 Spec Kit 初始化模板与工作流。
2. 按 grilling 逐轮记录设计树和答案。
3. 与用户确认最终范围，然后完成 constitution、spec、plan 与 tasks。
4. 按任务实施，以真实进程/协议测试验证关键边界。
5. 分别报告模拟测试、协议测试和真实 Desktop 端到端测试结果；未验证的能力不得写成已支持。

## Spec Kit 初始化证据

- 使用官方 PyPI 发行包 `specify-cli==1.2.2`，通过 uvx 运行，未全局安装 CLI。
- 官方在线文档中的 `none` 集成在此发行包初始化时触发下载地址解析错误；随后使用发行包自带的 Codex 集成成功初始化，未修改第三方包。
- 成功执行的命令：

  ```sh
  uvx --index-url https://pypi.org/simple --from specify-cli==1.2.2 specify init --here --force --non-interactive --integration codex --integration-options=--skills --script sh
  ```

- `specify integration status`：OK；默认和已安装集成均为 codex；托管文件无修改、缺失或非法路径。
- `.specify/memory/constitution.md` 当前是官方模板，尚未声称完成项目原则或产品规格。

## 参考资料

- Spec Kit：https://github.com/github/spec-kit
- CodexHost：https://github.com/BytePioneer-AI/codex-host
- Magpie：https://github.com/yetone/magpie
- agent-bridge：https://github.com/kununu/agent-bridge
- Agent HUD Open：https://github.com/jazzenchen/agent-hud-open
