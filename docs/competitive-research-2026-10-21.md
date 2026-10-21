# Harnmux 差异化评估

调查日期：2026-10-21。依据官方仓库固定提交、README 与关键源码；未运行竞争产品的真实模型任务。对 Harnmux 的“现有能力”以本轮新增验收流程之前的本地实现为基线；新增实现应另附测试证据。更完整的既有评审见 [reference-architecture-review.md](reference-architecture-review.md)。

## 结论

Harnmux 并非首个跨 harness 协作工具。任意入口、可变 Leader、原生 worker、持久会话、worktree、代码审查、差异摘要、甚至原生 macOS 状态栏，都已有产品分别实现。仅把这些拼在一起，不足以宣称独有功能。

可以形成明确定位的是：**在已有 harness 中，为任务选择另一套原生 harness；默认隔离修改，保留中间审批，把执行结果交给 Leader 和用户分别审查。** 它针对需要人工参与的研发协作，主动接受“不能把所有步骤都无人值守”的取舍。当前实现支持 Codex 和 DSH；不应写成已经支持市面所有 harness 或任意模型。

## 先消除名称歧义

- **Harness Mix**：`emo-xiaoyu/harness-mix`，多 harness 协作与 Codex Desktop 扩展。[H1]
- **Codex Mixin**：`Edward-lyz/codex-mixin`，模型网关，当前为 Source Code Viewing License；不是上面的协作产品。其源码未纳入本项目。[X1]
- **Harness Bridge** 至少有两个同名仓库：`rbutera/harness-bridge` 是直接跨 harness 的 MCP 工具；`0xSero/harness-bridge` 是模型端点与 harness 启动管理器，带 macOS 状态栏。此前调研还提及 `kununu/agent-bridge`，这是第三个不同项目。用户未给同名仓库链接，因此下文分别比较，不擅自选定一个。[R1][S1][K1]

## 固定快照

| 仓库 | 调查提交 | 提交日期 UTC |
| --- | --- | --- |
| BytePioneer-AI/codex-host | `a8adb78b519a81795fc05b787811f20a9738d7f0` | 2026-10-17 |
| emo-xiaoyu/harness-mix | `b3e4b54d6a3a5043875b38cc39005bee7d2f1c85` | 2026-10-14 |
| rbutera/harness-bridge | `31559c93be61fa6adec584b728f843e2f92330f3` | 2026-10-11 |
| 0xSero/harness-bridge | `d1cd1c77fe92367d4cd9e055fffaef8236a65930` | 2026-09-27 |
| kununu/agent-bridge | `580e0f5a3a7925bfbe1db525ea7fbe64f1d496d5` | 2026-10-14 |

这些是 API 返回的提交快照，不代表发布或真实 Desktop 验收版本，不能只据提交日期推断维护质量。

## 与各项目的具体区别

| 项目 | 已经解决什么 | 主要取舍或缺口 | Harnmux 的区别与代价 |
| --- | --- | --- | --- |
| CodexHost | 原生 harness 委派、会话映射、Skill/CLI、本地控制面，且能投影进 Codex Desktop | 外部 worker 默认 unattended-full-access；默认继承父 cwd；Desktop 依赖私有 CDP/renderer；watch 在内存，任务记录本身会持久化 | 默认 worktree、桥接原生审批、独立状态栏；减少 Desktop 内部依赖，同时失去它的原生会话树与丰富 UI 投影 |
| Harness Mix | 任意 shell 入口作为 Lead、CLI/MCP、18 个注册 harness、持久团队/邮箱/DAG、恢复、worktree、review/apply、验证门禁 | 团队路径明确选择免询问权限；通常共享 cwd；集成 UI 以 Codex Desktop 为中心，兼容维护面更大 | 两个 adapter 的小范围审批协作；默认隔离，服务与状态栏独立。覆盖、成熟度、团队功能目前明显更少 |
| rbutera/harness-bridge | Claude Code↔Codex 的任务型 MCP 工具，原生会话连续性，同会话串行、独立会话并行 | Claude→Codex 主路径明确禁用审批/sandbox；本次范围未见持久项目任务队列、默认 task worktree 与人工审批 UI | Harnmux 管理任务、worktree、待审批/未读结果和中断状态；目前缺 MCP 入口，互通部署反而不如它直接 |
| 0xSero/harness-bridge | 将多个 harness 接入模型端点；协议/模型目录/推理参数管理；CLI、Swift macOS 状态栏、Web UI | 主要管理模型连接与启动环境；默认跳过部分确认，但支持 `--safe` | Harnmux 管团队任务与交付，模型路由交给 Magpie 等工具；状态栏本身不构成独有卖点 |
| kununu/agent-bridge | 一个 Skill 从不同宿主委派原生 peer CLI，模型/effort 统一参数，持久 thread、锁与递归防护 | 更薄的 Skill/CLI peer 调用，Skill 已要求提供上下文和独立复核；本次未充分核验全部 adapter 的权限语义 | Harnmux 增加服务级任务角色、worktree、原生审批 UI 和可观察恢复；同时增加常驻服务与客户端维护成本 |

上表依据 [C1–C3][H1–H4][R1–R2][S1][K1–K2]。不同默认值是面向不同工作流的取舍；不能把免询问默认配置直接写成已证实漏洞。

### 特别重要：审查与摘要并非空白市场

Harness Mix 的 `review()` 调用 `reviewWorkspace()`，`apply(id, digest)` 要求任务完成、禁止重复 apply、调用验证门禁，再按 digest 应用；Lead 提示明确要求“review、返回的 digest、用户显式授权”。已有开发→审查→修复→复核流程和审查团队模板。[H2][H3]

进一步检查 `verification-gates.js`：它已有绑定 thread/turn 的版本化报告、命令执行结果、检查项、时间和 `contentDigest`；向回合事件流写入 `verification.updated`，新回合使旧报告失效。不能声称竞品没有运行时证据、回合绑定或历史事件。[H5]

因此 Harnmux 增加 SHA256、diff 审查、“成功后才合入”、回合报告或过期保护，都不能宣称独创。合理的建设目标是补齐 Harnmux 自身缺口：**每回合保留完整交付快照，区分模型自述与服务观察，把 Leader 建议和用户验收分别绑定到指定交付。** 是否已覆盖所有竞品无法靠本次抽样证明，应描述为 Harnmux 的明确产品契约；产品差异来自不注入 Desktop、保留原生审批、默认 worktree 和可查交付的组合与体验，避免“全球唯一”。

## 当前真正解决了什么

1. **修改互相踩踏**：默认 task worktree，减少共享工作目录冲突。它不是操作系统 sandbox；多个任务仍可读取相同系统资源。也不会自动继承 Leader 的未提交修改。
2. **无人值守与用户审批之间的冲突**：Codex 原生 app-server 与 DSH/acpx 审批转到统一待处理队列。协议 fixture 已验证生命周期，真实 DSH/模型/Desktop 行为仍需实测。
3. **Desktop 内部结构升级风险**：核心不修改或注入 Desktop，入口用 CLI/Skill，观察用 SwiftUI 状态栏。代价是原生会话树、自动唤醒和原生结果推送不能承诺。
4. **重复派发、重启误报成功**：请求去重、结果/事件/未读状态持久化；重启将未结束任务标为 interrupted，避免盲目重放。这不是断线后的无损续跑或恰好一次执行。
5. **入口与 Leader 被绑定**：显式区分 Entry、Leader、Worker；可以从 DSH 入口启动 Codex Leader，再派发 DSH Worker。此前产品中同类模式已经存在；本项目需以真实双向验收证明自己的实现。

原有测试证据是 14 个受控测试与 TypeScript/Swift 编译，不能替代账号、付费模型与真实应用集成验收。现阶段不可宣称已经解决“任意模型质量、所有插件继承、所有 Desktop 自动回报”。

## 应集中建设的差异

### 近端：可追溯的交付与验收

保留不可覆盖的每回合交付：任务目标、明确验收项、解析后的基线提交、原生 harness/model/session、模型报告、服务采集的状态和 diff、截断/采集失败标记，以及内容摘要。执行成功、结果完整、Leader 审查、用户接受需要分开表示；`ack` 只表示已读。

验收回执必须指定 task、turn 和交付摘要；过期或错配回执应拒绝。继续执行后保留历史包，但旧回执不能验收新修改。只记录“Leader 建议”和“用户接受/请求修改”，不自行合并、不把测试通过等同需求完成。这与 Harness Mix 已有的 digest apply、验证报告和回合事件有重叠；本项目重点应放在审批、交付和角色分离构成的完整用户流程，并通过测试兑现，而不是主张某个底层原语独有。

后续可增加实际命令 argv/cwd/退出码与输出引用，但只有 runtime 真正采集到的内容才能称为证据。模型说“测试通过”只能放在模型报告，不能自动生成服务证明。

### 次近端：可移交的上下文包

让当前 harness 无法继续时，另一个 harness 基于明确目标、决策、代码基线、剩余事项和能力要求接手。保留旧会话和证据，创建新原生会话；不假装把 Codex 原生 session 直接转换成 DSH session，不自动重放有副作用操作。先做可检查的 handoff 文件和 lineage，避免立即引入通用 DAG 语言或无限自主团队。

### 暂不扩展

不自建模型网关、账号管理、主题市场、新聊天壳或 Desktop 注入；不为了看起来覆盖广而注册未经真实验证的 adapter。第一性原理要求桥只负责任务、执行边界、审批、交付；奥卡姆剃刀要求每个新增状态都对应一个真实用户决策或故障。

## 一手来源

- [C1：CodexHost coordinator](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/harness-delegation-coordinator.ts)
- [C2：CodexHost watch](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/delegation-watch.ts)
- [C3：CodexHost CDP client](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/desktop-control/src/cdp-client.ts)
- [H1：Harness Mix README](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/README.md)
- [H2：Harness Mix collaboration](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js)
- [H3：Harness Mix worktree](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration-worktree.js)
- [H4：Harness Mix renderer 修复记录](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/docs/renderer-channel-resilience.md)
- [H5：Harness Mix 验证门禁与回合报告](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/verification-gates.js)
- [R1：rbutera/harness-bridge README](https://github.com/rbutera/harness-bridge/blob/31559c93be61fa6adec584b728f843e2f92330f3/README.md)
- [R2：rbutera app-server](https://github.com/rbutera/harness-bridge/blob/31559c93be61fa6adec584b728f843e2f92330f3/src/lib/app-server.ts)
- [S1：0xSero/harness-bridge README](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/README.md)
- [K1：kununu/agent-bridge README](https://github.com/kununu/agent-bridge/blob/580e0f5a3a7925bfbe1db525ea7fbe64f1d496d5/README.md)
- [K2：kununu/agent-bridge Skill](https://github.com/kununu/agent-bridge/blob/580e0f5a3a7925bfbe1db525ea7fbe64f1d496d5/skills/agent-bridge/SKILL.md)
- [X1：Codex Mixin 许可](https://github.com/Edward-lyz/codex-mixin/blob/194736fba65215b47678119726ef8dae026b09e3/LICENSE)
