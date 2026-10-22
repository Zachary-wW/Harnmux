# 竞品衔接机制复核（2026-10-21）

只读复核 `/Users/weizhihao/Projects/Agents/harnmux-lab/sources/` 的固定 checkout；未调用模型、未启动 Desktop、未测试账号或写入用户配置。`harnmux-lab/notes/versions.json` 中三个 SHA **与此前研究一致**，所以本篇是补全和纠正旧结论，不代表上游刚发生了更新。

| 源码目录 | 固定提交 |
| --- | --- |
| `codex-host` | `a8adb78b519a81795fc05b787811f20a9738d7f0` |
| `harness-mix` | `b3e4b54d6a3a5043875b38cc39005bee7d2f1c85` |
| `rbutera-harness-bridge` | `31559c93be61fa6adec584b728f843e2f92330f3` |

## 共同原理与不同侧重点

三者都能启动另一套**真实 harness 会话**。它们并非只把 prompt 发给另一家模型 API，也不会自然共享 Leader 的完整内存。主要区别在宿主投影、会话和任务的所有权、权限策略、结果回传与代码交付。

| 项目 | 衔接主路径 | 会话连续性 | 主工作流 |
| --- | --- | --- | --- |
| CodexHost | Skill/CLI → Host control → native adapter → 会话/工具投影到 Codex | Host thread ↔ nativeRef，保存后可恢复；官方 Codex 另走专用路径 | 用统一 Host 呈现多家原生会话，Desktop 展示更深 |
| Harness Mix | CLI/MCP → collaboration service → 原生 adapter → Core/renderer 投影 | job → child thread → nativeSessionId；持久团队、邮箱、恢复和 handoff | 多 harness 团队、编排、通知和交付，功能面广 |
| rbutera Harness Bridge | 调用者的 MCP 工具 → 持续 Codex app-server，或 Claude 非交互 CLI | Codex 原生 threadId 由调用者回传；Claude threadKey 的映射在服务内存 | 明确的 query/review/implement RPC，接入薄，项目编排较少 |

Harnmux 同样采用原生协议/执行适配；差异应放在独立服务、默认 worktree、保留原生中间审批、明确交付/验收，而不是声称“别人只调模型、只有我们调 harness”。

## CodexHost：不能混淆 Host 展示能力与委派默认权限

1. `packages/host-runtime/src/harness-delegation-coordinator.ts:206–215`：默认 `cwd = input.cwd ?? parent.cwd`，官方 Codex 走 `#startOfficial`。`:288–328`：保存 source/target harness、父子 Host ID，调用 adapter.open(create)，提交原生 `nativeRef`。这已经有可变来源/目标与真实会话映射，不能说只能 Codex 作抽象 Leader。[C1]
2. 同文件 `:298–304`：**外部 worker 的委派路径**明确 `executionPolicy: "unattended-full-access"`。DSH adapter 并非忽略该参数：`packages/adapters/deepseek-harness/src/modern/deepseek-harness-adapter.ts:1008–1045` 选择 `danger-full-access`，核对 permission preset、sandbox 和 approvalPolicy `never`；未确认生效会拒绝。这个结论不能扩大为所有普通 Host 会话都没有审批。[C2]
3. 普通 DSH 会话本身有完整原生交互桥：`packages/adapters/deepseek-harness/src/modern/session.ts:965–978` 生成 Host approval；`:708–712` 将选择回复为 `allowed-once`/`rejected`。因此 Harnmux 的“有审批转接”不是新技术；有意义的区别是**把需要人工审批的运行作为委派默认工作流**。[C3]
4. `packages/host-runtime/src/delegation-watch.ts:87–91` 明确 watch 不耐 Host 重启；`:238–256` 完成通知通过通用 `send` 启动订阅方新回合，明确拒绝可重试，投递结果未知则不盲重试。它并非只有状态查询或只能通过 Desktop 注入唤醒；watch 基于公开 read/send，注明独立于 harness/Desktop。[C4]
5. Desktop 投影确实有私有 CDP 耦合（`packages/desktop-control/src/cdp-client.ts:312–325` 调用 `Runtime.evaluate`），但不能把 control API、watch 与 CDP 展示全混作同一实现层。[C5]
6. 本次委派 coordinator 主路径未见自动创建 worktree；可以传入外部预备的 cwd。不能凭这个文件推断整个产品完全没有 worktree 功能。任务/nativeRef 的持久化与内存 watch 必须分开评价。[C1][C4]

**对 Harnmux 的启发：** 保留原生 sessionRef 与 adapter 能力清单；若做自动续行，借鉴“拒绝”和“投递未知”分别处理。独立状态栏能避开 renderer 兼容维护，却不自动补足结果推送与会话唤醒。

## Harness Mix：旧文对隔离、通知和上下文交付需要补全

1. `src/main/host/collaboration.js:138–174` 按 harness 选免询问模式；`:1303–1339` 创建真实 worker thread 并应用权限。一般 adapter/Runtime 支持用户审批，例如 `src/main/host/runtime.js:611–620` 将原生回答路由回 adapter。**协作 worker** 出现意外 approval 时，`:1216–1225` 会停止回合并给出原因；不能说 adapter 完全不能审批。[H1][H2]
2. `src/main/host/collaboration.js:1226–1235`：通常 shared cwd，但发现**协作组外的其他活跃会话占用同目录**时，默认改成 `auto` 隔离；显式参数和继承工作区优先。在 Git 仓库中 auto 建 worktree，非 Git 可回退 shared。因此旧文“默认共享目录”成立但不完整，它已有风险触发的自动隔离。[H3]
3. `src/main/host/collaboration-worktree.js:42–49,91–109`：用私有 Git index 将 tracked 与 non-ignored 文件快照为 baseTree，建立可达引用并播种新 worktree，**包括源目录未提交状态**。Harnmux 若只从 HEAD/ref 创建干净 worktree，就可能看不到 Leader 刚写的设计/代码；这是实质功能缺口，不能把“我们默认隔离”写成全方面领先。[H4]
4. 各适配器保存原生会话标识；通用 ACP 路径的 `src/main/adapters/acp.js:115–126` 用 new/load 恢复原生 sessionId，但不能因此把所有 harness 路径都称为 ACP。DSH 的 `dsh.js` 实际混合使用 Web Remote 与 ACP：普通 worker/direct 走 Web Remote；需要 collaboration 或 managed MCP 的会话走 ACP profile，后者显式标记 fork/compaction/permissionModes 不可用。完整路由见补充复核《acp-handoff-boundaries-2026-10-21.md》。`collaboration.js:1314–1326` job 保存 childId。团队成员在 Leader 回合结束后可继续运行（`:1352–1359`）；`:1903–1927` 在 worker 落定后 `wakeLeadForTask`，若 Leader 空闲则发新回合，上一回合 cancelled/error 时不自动拉起。另有脚本完成汇总唤醒。**自动继续并非 Harnmux 可宣称的空白特性。**[H5][H6]
5. `collaboration.js:957–1007` 有邮箱直投、queued/delivering/native_session/mailbox 状态；`:1586–1592,1629–1644` 在中断后请求 worker 简短 handoff，保存到 job/task/Leader 邮箱。这是模型自述、有额外模型回合，不是完整 session 转换或自动证明。[H7][H8]
6. `collaboration-worktree.js:135–168` 用二进制 patch + SHA256 进行 review/apply，应用前重新计算；冲突时可生成三方合并候选，按用户真正看到的候选摘要授权。`collaboration.js:750–771` 叠加 completed、重复 apply 防护及 verification gates。[H9]
7. `verification-gates.js:30–42,55–74,111–124` 已有实际命令结果、thread/turn 绑定、SHA256 报告、旧回合失效、回合事件。Harnmux 的交付包/过期保护是在补齐自己的可靠性，不能宣称它们是竞品没有的独有机制。[H10]

**对 Harnmux 的启发：** 先补工作区上下文基线和可靠交付通知。保留人工审批是工作流选择；更小的功能面是维护取舍。不要为了差异化重写 DAG、模型网关或原生 session 系统。

## rbutera Harness Bridge：原生会话 + 同步 MCP 结果，不能简单说“无状态”

1. `src/codex-server.ts:138–158` 按真实 threadId 加锁，同一会话回合串行，独立调用并行；`:96–125` 的默认 app-server 路径返回原生会话 ID，包括可恢复错误的 ID。`src/lib/app-server.ts:345–356` start/resume 原生 thread。[R1][R2]
2. Codex 路径使用 danger-full-access，turn 使用 `unrestrictedSandboxPolicy()`；exec fallback 明确 `--dangerously-bypass-approvals-and-sandbox`（`src/lib/codex-args.ts:18`）。这是 Codex 目标路径，不应扩大成双向所有 harness 一律无审批：`src/lib/claude-args.ts:8–13` 使用非交互 CLI、`allowedTools`，未添加同名全访问参数；但本次未验证 Claude 缺权限时的真实行为，更不能声称它具备人工审批桥。[R2][R3]
3. `app-server.ts:370–429` 订阅原生通知，采集 file/command 等完成 item，向 MCP progress reporter 报告；`:432–462` 有超时 interrupt，`:453–480` 完成后 unsubscribe 卸载该 thread 的 MCP 栈，同时保留原生 thread 可恢复。它既有 progress，也有取消和持久原生会话，不能描述为只返回文本或每次丢上下文。[R2]
4. Claude 的 `threadKey → nativeSessionId` 映射确在内存（`src/lib/session-registry.ts:1–20`）；原生会话本身可能仍在。桥重启后 key 映射丢失与 Codex 调用者回传真实 ID 的契约不同。[R4]
5. 本次读取的工具主路径以 MCP call 等待/返回结果，未发现 durable 项目任务投递队列、自动 worker worktree 或独立人工审批 UI。它的 progress notification 不能等同于后台任务结束后新启动 Leader 回合；“没发现”限定在本次文件范围，不是穷尽源码的不存在证明。[R1][R2]

**对 Harnmux 的启发：** MCP 入口更容易让宿主可靠发现工具；任务外层可以保持通用，但会话 ID、线程串行、卸载/恢复需要按原生协议表达。长期运行本地服务还要防止 MCP 子进程栈泄漏。

## 应优先验证与改善的事项

1. **真实衔接契约。** 分别测 new/resume、保留配置/插件、模型选择、pending approval、取消迟到响应和退出；“CLI 能启动”不能代替“原生能力已保留”。Codex/DSH 协议版本固定，未知能力明确报告。
2. **上下文和代码基线。** 给任务传目标、决策、文件引用与验收项；派发前明确 worktree 基于提交还是源目录快照。若支持带入未提交修改，必须记录快照与 worker 新增变化的边界，不静默污染父工作区。
3. **通知与自动继续。** 分开“结果已保存”“用户已读”“已送达入口”“新回合已启动”；采用持久 outbox、目标能力探测、去重和投递未知状态。先支持服务掌握的 Leader session；不要承诺任意 Desktop 当前聊天都能被控制。CodexHost/Harness Mix 已有自动回报，是要达到的能力。
4. **交付与角色。** 保留每回合包和独立 Leader/用户回执，保留已读、执行成功、验收通过的区别；运行时观察与模型报告分开。摘要证明内容一致性，不证明代码正确；worker 分支被外部修改后要重新采集/审查。
5. **入口与运维。** CLI/Skill 加 MCP 是互补入口；状态栏只观察和处理任务，不复制聊天壳。适配器版本探测、认证范围、进程卸载、日志诊断与真实 smoke 用例的价值高于注册大量未验证 harness。

这些是目标工作流的完成度与可靠性改进，而非宣称全球唯一。Harnmux 可明确承诺一组可验证边界：不依赖 Desktop 注入、默认隔离、委派保留人工审批、交付与验收分开。代价是原生会话树整合和成熟团队编排目前较弱。

## 固定源码链接

所有路径/行号对应上表 SHA；多处行号用同一个链接定位该文件。

- [C1 coordinator](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/harness-delegation-coordinator.ts#L206)
- [C2 DSH permission configuration](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/adapters/deepseek-harness/src/modern/deepseek-harness-adapter.ts#L1008)
- [C3 DSH interaction mapping](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/adapters/deepseek-harness/src/modern/session.ts#L965)
- [C4 watch / delivery](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/delegation-watch.ts#L87)
- [C5 Desktop CDP](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/desktop-control/src/cdp-client.ts#L312)
- [H1 worker permissions](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L138)
- [H2 approval runtime](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/runtime.js#L1216)
- [H3 isolation default](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L1226)
- [H4 source snapshot](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration-worktree.js#L42)
- [H5 native ACP sessions](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/adapters/acp.js#L115)
- [H6 wake Lead](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L1903)
- [H7 mailbox delivery](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L957)
- [H8 interruption handoff](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L1586)
- [H9 review/apply](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration-worktree.js#L135)
- [H10 verification evidence](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/verification-gates.js#L30)
- [R1 MCP Codex execution](https://github.com/rbutera/harness-bridge/blob/31559c93be61fa6adec584b728f843e2f92330f3/src/codex-server.ts#L96)
- [R2 app-server lifecycle](https://github.com/rbutera/harness-bridge/blob/31559c93be61fa6adec584b728f843e2f92330f3/src/lib/app-server.ts#L340)
- [R3 Claude arguments](https://github.com/rbutera/harness-bridge/blob/31559c93be61fa6adec584b728f843e2f92330f3/src/lib/claude-args.ts#L8)
- [R4 Claude session mapping](https://github.com/rbutera/harness-bridge/blob/31559c93be61fa6adec584b728f843e2f92330f3/src/lib/session-registry.ts#L1)
