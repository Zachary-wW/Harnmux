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
  - worker 呈现：工具进度/结果 + 状态栏（Q1=A）
    - 原生子 agent 会话树不属于首版验收；跳转按能力提供。
- Codex 与 DSH 双向执行（已确认）
  - worktree 与权限：独立 worktree + 保留审批（Q2=A）
    - 交付：保留修改和分支，审查后决定合入（Q4=A）。
- 组合模型 router（已确认）
  - router 边界：复用配置，按任务选择模型（Q3=A）
    - 账号管理、router 安装与 provider 配置不属于首版验收。
- 异步回报（已确认）
  - 回报：持久化结果、状态栏提醒，入口支持时自动唤醒（Q5=A）
    - 不支持或未验证的入口明确报告能力，保留手动查询结果路径。

## 第一轮：用户均选择 A

### Q1：worker 呈现

- A（推荐）：工具进度与结果 + 状态栏；原生跳转按能力提供。
- B：必须融入各家 Desktop 的原生子 agent 会话树。

### Q2：代码修改与权限

- A（推荐）：独立 Git worktree，保留 harness 权限边界，审批时等待处理。
- B：独立 worktree，用户在配置中明确开启自动执行。

### Q3：模型 router 边界

- A（推荐）：复用已有 Magpie/harness 配置，按任务选择模型或使用默认值。
- B：同时安装和管理 router、模型提供商与账号。

## 第二轮：用户均选择 A

### Q4：修改交付

保留独立分支/worktree，回报修改、测试和差异，由 Leader 根据用户指令决定合入；不自动合并。

### Q5：后台回报能力

结果持久保存并在状态栏提醒；支持原生唤醒时自动继续。不能唤醒或尚未验证时明确标注，并提供查询路径。

## 访谈收敛状态

Q1–Q5、Q9 与 Q10 已形成实现基线。Q6 的范围调整落实为源码评审、第一性原理与奥卡姆剃刀约束，以及原生 UI 设计；Q8 的疑问落实为入口、Leader、Worker 独立选择。用户随后要求 continue，继续推进实现，不再要求重复整体确认。详细功能与完成证据以 `specs/001-cross-harness-team/spec.md`、`tasks.md` 和 `verification.md` 为准。

## 本轮新增约束与事实纠正

- 用户要求入口与 Leader 独立：可从 DSH 入口指定 Codex harness 担任 Leader，再使用 DSH worker。不能把“当前入口可任意选择”误写成“Leader 已可独立选择”。
- Q9：允许新建 DSH worker，需保留可用插件配置；不要求当前交流会话直接充当执行 worker。Q10 随后明确暂不逐项调查插件，插件兼容不作为 MVP 门槛；工具保持原生配置归 DSH 管理。
- 因此允许入口→Leader→Worker 的有界交接；早期禁止递归的意图改为禁止 Worker 无限再派发，而不是禁止外部 Leader 负责调度。

- Harness Mix 与 Codex Mixin 为不同项目；前者已存在可变 Lead 与持久团队，不再沿用“只支持 Codex leader”或“已停更”的未经证实判断。
- CodexHost/Harness Mix 的部分委派默认权限与本项目“保留审批”冲突，默认共享 cwd 也不满足默认 worktree；不能整套照搬。
- acpx 已有嵌入 runtime，评估复用，避免重复编写 ACP client；审批契约需按 API 分别验证。
- 模型路由与任务协调分开，复用 Magpie/原生模型配置。
- UI 已采用 SwiftUI MenuBarExtra，原始技能建议经过平台适配，未机械使用营销页布局或字体。
- 证据、推导和提案见 `docs/reference-architecture-review.md`、`docs/architecture-proposal.md` 和 `design-system/harness-bridge/MASTER.md`。

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
- `.specify/memory/constitution.md` 已完成项目原则；功能规格、计划与任务位于 `specs/001-cross-harness-team/`。

## 参考资料

- Spec Kit：https://github.com/github/spec-kit
- CodexHost：https://github.com/BytePioneer-AI/codex-host
- Magpie：https://github.com/yetone/magpie
- agent-bridge：https://github.com/kununu/agent-bridge
- Agent HUD Open：https://github.com/jazzenchen/agent-hud-open
