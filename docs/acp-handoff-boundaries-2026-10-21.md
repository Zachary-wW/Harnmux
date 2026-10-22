# ACP 能力边界与跨 harness 交接（2026-10-21）

本篇是对本地固定提交的源码复核，不是对上游最新版本或真实运行效果的认证。未执行模型任务、未修改 harness 配置。ACP 官方协议与本机 DSH 能力需结合独立实测判断；下文不把竞品的注释当作 ACP 标准本身的限制。

## 结论

1. 跨 harness 产品通常调用各家的真实原生执行面：Codex app-server、DSH ACP 或 DSH Web Remote、Claude 非交互 CLI 等。不是所有产品统一走 ACP。
2. ACP 能力缺口应区分：协议可表达什么、目标 harness 的 ACP profile 实现什么、客户端适配器接住什么。某个版本的 DSH ACP 不支持一项功能，不证明标准禁止它，也不证明底层 harness 没有它。
3. 这些竞品的跨 harness 交接，是新建/恢复目标自己的 session，传任务、工作区、摘要或结果，再让原 Leader 继续。没有发现把 Codex 完整内部会话无损转换成 DSH 会话的主路径。
4. 同一 harness 的 native resume/fork 与跨 harness 的任务交接是两件事；传递 transcript 或 summary 也不等于复制内部上下文状态。

## 实际接入协议

| 产品 / 路径 | 已确认机制 | 边界 |
| --- | --- | --- |
| CodexHost / DSH modern | 启动 `dsh web --no-open --host 127.0.0.1 --port 0`；通过 WebSocket / RPC / 原生日志流执行 `session/create`、`session/prompt` 等 | 不是通用 ACP；适配器有 DSH 专用配置、事件、恢复和请求关联逻辑。[C1][C2][C3] |
| Harness Mix / Codex | 原生 Codex app-server，经 Codex 专用适配器投影事件 | 不需要先转成 ACP。[H1] |
| Harness Mix / DSH worker/direct | Web Remote，接收原生事件和审批/用户问题 waterfall；原生 `session/fork` | 顶部注释称 ACP 自动化面缺 fork/问题/plan，但不能据此断言 ACP 标准都缺这些。[H2] |
| Harness Mix / DSH Lead 或带 managed MCP 的会话 | **同一个适配器内部改走官方 ACP profile**，因为它接收 session-scoped MCP 声明 | 其 ACP 配置明确 `fork:false, compaction:false, permissionModes:false`；同一产品按用途选择不同执行面。[H3] |
| rbutera Harness Bridge / Codex | 常驻 app-server，使用 `thread/start` 或 `thread/resume`；兼容路径为 exec | 调用者保存真实 thread ID 并在下一次调用回传；同线程加锁串行。[R1][R2] |
| Harnmux / 当前 | Codex 用 app-server；DSH 用 acpx 调用 ACP profile | 当前已有受控验证，尚未证明 DSH ACP 与用户 Desktop 配置/插件完全等效。 |

**最有价值的竞品经验是混合适配，而不是执着于某一个统一协议。** Harness Mix 的 DSH 顶部注释与文件末尾路由需一起读；只读前者会误判“完全弃用 ACP”。

前篇 `competitor-mechanics-update-2026-10-21.md` 的 Harness Mix 第 4 项用通用 `adapters/acp.js` 说明 session new/load，只能说明那条适配路径，不能涵盖当前 DSH/Codex 全部会话。应补充上表的 DSH 混合路由与 Codex 原生 app-server，避免误读为所有 harness 都通过 ACP。

## 竞品如何交接

### CodexHost

- coordinator 创建独立 child Host thread，选择目标 harness、cwd、model 等，调用目标 `adapter.open({kind:"create"})`，保存 `nativeRef`；随后把 `input.task` 交给该 child 的原生回合。[C4]
- source/target harness 和 parent/child Host ID 作为控制服务元数据保存；目标 harness 的 nativeRef 属于目标自己的 session。这里没有把父会话的完整原生状态注入目标。[C4]
- watch 观察任务完成，通过公共 send 给订阅方开启新回合；watch 自身是内存态，重启会丢失。明确拒绝与投递结果未知分开处理，后者不盲目重发。[C5]

### Harness Mix

- 创建工作区，创建或恢复目标 harness child thread，再把任务或 team envelope 发送给它；已有 child 的 follow-up 继续同一目标 session。[H4]
- 隔离工作区通过私有 Git index 快照 tracked 和 non-ignored 文件，可携带未提交源状态；这是代码基线交接，和模型记忆迁移不同。[H5]
- 中断后的 handoff 是向原 worker 追加一个专用回合，请它总结已完成、进行中、阻塞与下一步；保存到 job、task 和 Leader mailbox。源码明确把它当 worker 自述，恢复提示要求对照实际工作区验证。[H6]
- Worker 完成后给空闲 Leader 发送包含结果摘录与验收指令的新回合；不是把 worker session 替换成 Leader session。[H7]

### rbutera Harness Bridge

- 调用者通过 MCP 工具发送 prompt、cwd、model 和可选 native threadId；得到目标执行结果。后续继续目标会话需要回传原生 thread ID。[R1][R2]
- Codex thread ID 和 Claude 的 caller key 映射不同：后者的 `threadKey → nativeSessionId` 仍在进程内存。[R3]
- 这里的 MCP 是调用入口；真正执行仍交给目标 native app-server/CLI，MCP 本身不负责无损会话迁移、代码快照或自动续行。

## 对 Harnmux 的建议

- 保持公共任务契约，但允许每个 harness 使用最合适的原生协议；不要要求所有能力都压进 ACP 的共同子集。
- 先给 ACP 与 DSH Web Remote 建实际能力对照，再决定是否新增 DSH 原生适配器。首要检查 native question、model/config、MCP/skills/plugin profile、resume/fork、compaction、原生子 agent 事件。逐项记录可用、不可用、未验证。
- 统一状态可以用于 UI；保留 native session/item/request 引用和原始诊断，避免统一过程中丢失审批与恢复语义。
- 交接契约应包含目标/决策/验收、明确的代码快照或交付引用、结果与待处理事项。可靠性取决于这些交接和恢复契约，不能只由“用了 ACP / 原生协议”判断。
- 不需要把内部私有状态通用化。先实现已拥有会话的 start/resume/prompt/cancel/interaction，再扩展有真实需求的原生能力。

## 固定源码依据

- [C1 CodexHost DSH web 启动](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/adapters/deepseek-harness/src/modern/remote-connection.ts#L828)
- [C2 CodexHost DSH session/create](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/adapters/deepseek-harness/src/modern/deepseek-harness-adapter.ts#L560)
- [C3 CodexHost DSH session/prompt 及未知投递结果](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/adapters/deepseek-harness/src/modern/session.ts#L1303)
- [C4 CodexHost 创建目标会话并发送任务](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/harness-delegation-coordinator.ts#L206)
- [C5 CodexHost watch](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/delegation-watch.ts#L87)
- [H1 Harness Mix Codex app-server](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/adapters/codex.js#L537)
- [H2 Harness Mix DSH Web Remote](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/adapters/dsh.js#L11)
- [H3 Harness Mix DSH ACP Lead 路由](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/adapters/dsh.js#L440)
- [H4 Harness Mix child 与任务发送](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L1285)
- [H5 Harness Mix 私有 index 快照](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration-worktree.js#L40)
- [H6 Harness Mix handoff 总结](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L1586)
- [H7 Harness Mix Leader 新回合](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L1903)
- [R1 Bridge MCP/native thread ID 契约](https://github.com/rbutera/harness-bridge/blob/31559c93be61fa6adec584b728f843e2f92330f3/src/codex-server.ts#L96)
- [R2 Bridge app-server start/resume](https://github.com/rbutera/harness-bridge/blob/31559c93be61fa6adec584b728f843e2f92330f3/src/lib/app-server.ts#L340)
- [R3 Bridge Claude 内存映射](https://github.com/rbutera/harness-bridge/blob/31559c93be61fa6adec584b728f843e2f92330f3/src/lib/session-registry.ts#L1)
