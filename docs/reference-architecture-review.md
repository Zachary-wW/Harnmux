# 参考项目架构评审

调查日期：2026-10-21。依据官方仓库固定提交的 README、设计文档和关键源码。未运行真实模型任务、Desktop 注入或付费端到端测试。本文区分事实、架构取舍和待验证项；发现某种默认行为，不等于证明项目存在可利用漏洞。

## 先纠正名称与既有印象

- **Harness Mix** 是 `emo-xiaoyu/harness-mix`；**Codex Mixin** 是 `Edward-lyz/codex-mixin`。两者解决的问题不同，不能混称。
- 本次读到的 Harness Mix HEAD 提交日期为 **2026-10-14**，不能把“已经不更新”当作事实，也不能仅凭一次提交证明维护稳定。GitHub API 元数据查询遇到限流，未据此推断维护状态。
- Harness Mix 已有 CLI 协作入口，明确支持任意能够执行 shell 的 harness 担任 Lead，并有团队、任务依赖图和邮箱持久化。不能把它描述成“只有 Codex 能做 leader”。不过它提供的集成 UI 仍以 Codex Desktop 为中心。[H1][H2]
- Codex Mixin 当前是自定义 **Source Code Viewing License 1.0**，不是 MIT/Apache 许可的开源代码。它是模型网关，不是通用团队编排器。发现许可后已删除临时 checkout，未把其源码复制进项目。[X1][X2]

## 调查快照

| 项目 | 固定提交 | 提交日期 | 本次读到的许可 |
| --- | --- | --- | --- |
| CodexHost | `a8adb78b519a81795fc05b787811f20a9738d7f0` | 2026-10-17 | LGPL-3.0-only |
| Harness Mix | `b3e4b54d6a3a5043875b38cc39005bee7d2f1c85` | 2026-10-14 | Apache-2.0 OR MIT；第三方组件另有归属 |
| Codex Mixin | `194736fba65215b47678119726ef8dae026b09e3` | 2026-10-21 | Source Code Viewing License 1.0 |
| acpx | `afc076b501774c6139c9732f5487dc721d5bd757` | 2026-10-20 | MIT；package 版本 0.20.0 |
| Magpie | `ba319a7587923fc7a4ea3859658244d591261a59` | 2026-10-21 | MIT |

日期来自实际取得的 Git 提交，不代表发布版本或 Desktop 验收版本；后续实现必须固定依赖并单独记录真实验证。

## 总体判断

| 项目 | 核心职责 | 架构合理之处 | 对本项目最重要的缺口/取舍 |
| --- | --- | --- | --- |
| CodexHost | 把其他原生 harness 会话投影到 Codex Desktop，并提供委派控制面 | 原生执行与 Host 会话映射分开；Skill + CLI 可以作为轻入口 | Desktop 适配复杂；外部 worker 采用 unattended-full-access；默认沿用工作目录；watch 注册不耐重启 |
| Harness Mix | Codex Desktop 扩展 + 多 harness runtime + 团队协作 | 能力清单、CLI/MCP 双入口、团队邮箱和中断恢复比较完整 | UI 仍依赖 Codex 内部结构；团队明确要求免询问权限；默认共享目录；主题、账号、历史、团队、更新等功能扩大维护面 |
| Codex Mixin | 模型提供商与 API 协议网关 | 把不同模型接到已有 harness，职责可独立部署 | 不提供本项目的任务/worktree/审批闭环；当前许可不适合直接开源复用 |
| acpx | 通用 ACP client、会话和执行 runtime | 结构化事件、持久会话、取消和嵌入 API 可复用 | 不是现成 macOS 团队产品；CLI 与 shared/in-process runtime 的审批契约不同；ACP adapter 不等同原生 Desktop 会话 |
| Magpie | 多客户端模型配置与模型网关 | 模型路由独立于调用者，正适合组合 | 不自动获得跨 harness 团队状态、代码隔离、审批和结果验收；配置切换与会话模型选择不能混用 |

这些系统对其自身目标大多有合理结构。对本项目而言，应按必要能力借鉴，不能整体照搬后再删除大量功能。

## CodexHost：执行适配层值得借鉴，Desktop 投影不宜成为首版核心

**确认事实。** 委派 Skill 教 agent 调用 CLI；控制面是带 Bearer 认证的本地 HTTP；coordinator 创建子任务记录，调用原生 adapter `open`，保存 native session 引用，再启动任务。这不是把一个模型请求“转发成另一个模型”，而是启动另一套真实 harness 会话。[C1][C2][C3]

**确认事实。** coordinator 记录 `sourceHarnessId`、`targetHarnessId`，并非只能抽象 Codex→worker。但其官方 Codex 路径与外部 harness 路径不同；Desktop 会话链接和原生 UI 投影仍带 Codex 语义。不能据此承诺已实现所有独立 Desktop 的对称挂接。[C3][C5]

**与本项目约束直接冲突的默认值。** 外部 worker `open` 明确指定 `executionPolicy: "unattended-full-access"`；未指定 cwd 时沿用 parent cwd。独立会话不代表独立代码目录；不能把这套默认配置直接用来兑现“保留审批 + 默认 worktree”。[C3][C4]

**确认的可靠性缺口。** `DelegationWatchService` 注释与实现明确将 watch 保存在内存，Host Runtime 重启后不保留。与此同时，委派记录、nativeRef、turn history 存储是另一回事，不能说整个项目没有持久化。应该分别验证“任务能恢复查询”“结果通知能重新投递”“原生会话能继续执行”。[C3][C5][C6]

**合理的取舍。** 要把外部 harness 的工具、消息和权限卡片嵌进原生 Codex UI，CDP/Electron 适配与 app-server shim 有实际价值；代价是依赖上游 UI 和协议变化。源码确实调用 `Runtime.evaluate`，这不是官方跨厂商插件协议。[C7]

**建议。** 借鉴任务→native session 映射、薄 Skill/CLI、能力探测。首版不复制完整 Desktop renderer 投影。任务与通知均持久化；未知投递状态不能盲目重发会产生副作用的 prompt。LGPL 源码复用需按其许可设计，首版优先独立实现简短边界。[C8]

## Harness Mix：已经有可变 Lead，但审批和 UI 耦合需要重新设计

**确认事实。** README 明确写出任意可执行 shell 的 harness 可通过协作 CLI 管理团队；设计文档直接说明该 Skill 模式参考 CodexHost。NOTICE 描述部分原生 Desktop 组件的来源与后续重实现。这支持“参考过 CodexHost”，不支持“只是简单 fork”的笼统结论。[H1][H2][H3]

**确认事实。** 持久化的不止一条结果：`initialize()` 加载 jobs、team、messages；running job 变成 interrupted；成员和图任务状态同步更新；`saveTeams()` 保存团队结构。这是较清晰的恢复模型。它并不代表重启后自动无损继续原生回合或通知恰好投递一次。[H4]

**与本项目约束直接冲突。** `workerSessionOptions` 对 Claude 选择 `bypassPermissions`，对 Codex 选择 `approvalPolicy: never` 和 `dangerFullAccess`，对部分 ACP harness 要求原生 full-access 档位。团队 Lead 也由 `prepareTeamLeadAccess()` 进入免询问档位；若运行时仍出现审批，守卫停止成员回合。文档中“权限归原生 harness”说的是执行归属，不能据此解释为保留逐次用户审批。[H5]

**与本项目目录默认值不同。** 引导指令明确说 worker 默认共享 cwd，worktree 用于显式隔离。它已有 worktree/review/apply 能力，且显式隔离失败不应悄悄降级；但本项目需要把独立 worktree 变成默认。[H1][H6]

**确认的耦合与架构风险。** 它通过 CDP binding、`Runtime.evaluate` 与 Desktop 交互；官方自己的修复文档记载 composer 子树重建更换 request manager 后，旧请求客户端静默失效，并说明如何绕开旧注册表。当前版本有修复和监督重启，这些历史问题不能被说成仍必然复现；但它们是“私有 UI 耦合需要持续兼容投入”的直接证据。[H7][H8]

**复杂度取舍。** 原生团队工作台、主题市场、账号切换、历史导入、ChatGPT 侧栏、用量中心、更新器属于一个更完整的 Desktop 产品。若目标仅为在各家原生 Desktop 里委派任务并用状态栏观察，把这些全部放进 MVP 会增加状态同步、兼容与测试面。功能多本身不是代码质量缺陷。[H1]

**建议。** 借鉴 capability manifest、显式中断恢复、持久邮箱、CLI/MCP 共用服务。首版不引入主题、账号管理、团队 DAG 解释器或 Codex renderer 修改；审批通过公开协议转接到状态栏。任务关闭、UI 关闭、worker 取消必须分开建模。

## acpx：可作为协议执行组件，不应再笼统说它只有 CLI

当前版本不仅有 CLI，还导出 `acpx/runtime`、`acpx/flows`。持久会话使用磁盘记录和持有 ACP 连接的 queue owner；可通过 `createSharedAcpRuntime()` 让应用与 CLI 共用会话。[A1][A2]

**优点。** ACP 事件避免终端文本解析，提供会话/模型控制、取消、事件观察和 owner 生命周期。若本项目采用 TypeScript service，可先验证能否直接用其 in-process runtime；没有必要为“自主可控”完整重写 ACP 客户端。[A1][A2]

**明确限制。** 通用 ACP 只暴露适配器实际支持的能力。内置 Codex 入口是 `codex-acp` adapter，不等于接管已运行 Codex Desktop 的当前会话。shared runtime 不接受可序列化之外的逐回合权限回调；需要状态栏交互审批，应评估 `createAcpRuntime()` 的 `onPermissionRequest`，不能只在 CLI 外包一层然后声称实现审批等待。[A2][A3][A4]

**值得注意的默认值差异。** 常规配置默认是 `approve-reads`，非交互默认 deny；但本次源码 `config init` 写出的示例配置却是 `defaultPermissions: "approve-all"`。因此本项目必须明确指定自己的策略，不能依赖用户初始化后的默认配置。这里是静态源码行为，未运行 `config init` 验证。[A3][A5]

**可靠性语义。** 文档明确：requestId 不是幂等重试 API；连接丢失时可能不知道任务是否运行，不自动重试。shared 模式与普通 CLI 的恢复语义也不同，应按所选 API 测试，不能仅看到“persistent”就承诺任务无损续跑。[A2]

**建议。** 先做一个真实 ACP 审批与取消的技术验证；通过后复用单一 runtime，外围只补本项目的 task/worktree/通知/UI。若只有某个 harness 的专属能力需要原生协议，再增加一个薄 adapter。不要同时让 acpx 和自建进程管理器竞争持有同一连接。

## Magpie / Codex Mixin：独立模型路由层，避免重复造轮子

Magpie 的网关负责 OpenAI Chat/Responses、Anthropic Messages、Gemini 协议转换，并能为多个客户端写入模型配置；模型选择器、profiles 和 provider 路由是其产品核心。订阅 provider 中也有驱动原生 CLI/MCP 的特殊路径，因此不能绝对说它“从不启动 harness”；但这与管理一个项目的 worker、worktree 和待审批任务仍是不同职责。[M1][M2]

Codex Mixin 的 README 同样把自己定义为 Rust 本地模型网关，负责提供商与 API 协议转换。当前许可仅允许查看评估，不能据此作开源复用计划。[X1][X2]

**对本项目的限制。** 换了 API base URL，不会自动迁移原生会话、system prompt、工具 schema、审批状态或代码目录。转换协议并不保证所有模型语义等价；应把“可配置”“协议通过”“真实任务验证”分别标记。Magpie 全局配置/profiles 切换也不等于多个并行 worker 各自独立的模型设置。[M1]

**建议。** worker 通过原生 session/model 参数选择模型，保留已有 router base URL 与账号设置；不为每次任务重写共享全局配置。不把 provider/账户管理、余额和故障切换塞进 bridge。

## 第一性原理与奥卡姆剃刀给出的最小取舍

需求的不可约单元是：**明确任务 → 启动真实 harness → 独立代码目录 → 处理中间审批 → 保存执行结果 → 交回当前使用者审查。** 原生 Desktop 是入口和已有聊天界面；模型 router 是依赖；桥只需承担剩余的协作事实。

建议只保留：一个本地 task service、一套持久任务/事件存储、一个 worktree manager、一份 adapter capability 契约、一种 CLI/工具入口、一只可关闭的原生状态栏 UI。Codex/DSH 是 adapter；Lead 是任务调用者身份，不应是核心中的固定 Codex 类。

暂不需要：新聊天壳、Desktop DOM/CDP 注入、自己的模型网关、账号系统、通用插件市场、团队脚本语言、自动合并。未来确实需要完整 native 子会话树时，再为单个 Desktop 增加可选且独立的展示插件。

不能为了“简单”删掉：审批请求生命周期、取消后的迟到响应防护、工作目录隔离、未知状态、结果和通知持久化。这些保证最小闭环真实可靠。worktree 仅隔离代码目录，不是操作系统 sandbox。

本轮是事实评审和设计建议，不把此前待调整的产品范围冒充最终确认。真实 Desktop 接入、按任务模型选择、重启恢复和审批往返仍应成为后续分别记录的验收项。

## 固定来源

### CodexHost

- [C1：Skill/CLI 使用约定](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/delegation-skill.ts#L23-L80)
- [C2：本地 Bearer 控制面](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/delegation-control-server.ts#L107-L135)
- [C3：委派记录、原生会话、full-access 默认](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/harness-delegation-coordinator.ts#L266-L339)
- [C4：默认 cwd 与官方/外部路径](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/harness-delegation-coordinator.ts#L206-L220)
- [C5：watch 内存状态与重启限制](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/delegation-watch.ts#L87-L98)
- [C6：repository delegation 存储](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/external-thread-repository.ts#L160-L192)
- [C7：CDP Runtime.evaluate](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/desktop-control/src/cdp-client.ts#L312-L325)
- [C8：package 许可声明](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/package.json#L5)

### Harness Mix

- [H1：团队、任意 Lead、worktree](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/README.md#L175-L186)
- [H2：CLI Skill 参考 CodexHost](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/docs/cli-collaboration-design.md#L150-L185)
- [H3：来源与许可 NOTICE](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/NOTICE#L8-L19)
- [H4：初始化与持久化恢复](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L232-L289)
- [H5：worker 权限默认](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L134-L174)；[Lead 权限准备](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L359-L390)
- [H6：共享目录默认与显式 worktree](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L586-L608)
- [H7：CDP bridge 源码](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/native-ui/desktop-control/src/renderer-cdp-control-session.ts#L240-L265)
- [H8：Desktop manager 漂移和恢复修复记录](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/docs/renderer-channel-resilience.md#L25-L62)
- [H9：Desktop 版本验收与重启约束](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/docs/native-codex.md#L29-L46)

### acpx

- [A1：功能与导出 API](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/README.md#L64-L90)
- [A2：共享会话、非幂等、未知执行状态、回调边界](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/docs/shared-sessions.md#L46-L96)
- [A3：审批策略与回调生命周期](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/docs/permissions.md#L15-L90)
- [A4：原生 adapter registry](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/docs/agents.md#L10-L20)
- [A5：常规默认](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/src/cli/config.ts#L76-L77)；[config init 写入 approve-all](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/src/cli/config.ts#L573-L584)

### 模型网关

- [M1：Magpie 网关与模型配置](https://github.com/yetone/magpie/blob/ba319a7587923fc7a4ea3859658244d591261a59/README.md#L91-L105)
- [M2：Magpie 订阅 provider](https://github.com/yetone/magpie/blob/ba319a7587923fc7a4ea3859658244d591261a59/README.md#L137-L153)
- [M3：Magpie MIT 许可](https://github.com/yetone/magpie/blob/ba319a7587923fc7a4ea3859658244d591261a59/LICENSE)
- [X1：Codex Mixin 网关定位](https://github.com/Edward-lyz/codex-mixin/blob/194736fba65215b47678119726ef8dae026b09e3/README.md#L39-L41)
- [X2：Codex Mixin 自定义查看许可](https://github.com/Edward-lyz/codex-mixin/blob/194736fba65215b47678119726ef8dae026b09e3/LICENSE)
