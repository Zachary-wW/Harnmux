# Harnmux 任务、代码与结果交接复核

日期：2026-10-22。只读复核运行源码；运行逻辑未改动。新增一次临时 Git 仓库与脚本 Runner 的受控实验，未调用原生 harness 或模型、未使用账号额度、未改用户全局配置；实验目录已清理。

竞品范围：CodexHost、Harness Mix、用户指定的 **0xSero/harness-bridge**。本篇没有调查其他同名 bridge 仓库，也不将其结论用于 0xSero 产品。

## 当前实现

### 任务

- CLI `run`/`dispatch` 将 instructions、验收项、profile、requestId 等作为 JSON 发送到带 Bearer 认证的 loopback HTTP API：`src/cli.ts:38–46`、`src/server.ts:27–38`。
- `TaskService.create` 保存 SQLite 任务；相同 requestId 和相同内容返回已有任务，内容冲突拒绝。Leader 只能选 allowlist 中的 worker profile；Worker 不能再派发：`src/service.ts:30–50`。
- 子任务继承父任务 repo/baseRef，不允许自己指定另一份代码基线。服务把职责、验收、CLI 协作指令及当前任务拼成 prompt，再交给目标适配器：`src/service.ts:68–91`。
- Codex 走 app-server；DSH 走 acpx/ACP。各自保留 nativeSessionId，后续明确 continue 时恢复目标会话。不会自动复制 Entry 或 Leader 的完整聊天/内部上下文。

### 代码

- `src/workspace.ts:9–14` 将 ref 解析成确切提交，执行 `git worktree add -b harnmux/<taskId> <path> <sha>`。
- 当前继承的是已解析提交；Entry 的未提交文件、Leader 的未提交设计/代码、兄弟 Worker 的修改，都不会自动进入另一任务目录。
- `capture` 在任务退出时采集相对 baseRef 的 tracked binary diff 与 nonignored untracked 文件，保留 worktree，未自动合入：`src/workspace.ts:16–28`。
- 仅采集分配的 worktree；额外原生 worktree、ignored 文件、依赖安装、端口、外部数据库不由这一机制交付或隔离。所有 worktree 仍共享 Git 仓库元数据。

### 结果

- 模型文本报告、状态、原生事件、审批记录保存 SQLite。完成后采集 diff，封存每回合 DeliveryPacket；其中包含契约、来源、修改、成员的回合/digest 引用：`src/service.ts:92–108,151–165`。
- 包使用 SHA256 标识确切存储 JSON；审查通过 taskId+turn+digest 指向该包，Leader 推荐与用户接受分开。失败/截断/包内未完成成员阻止接受：`src/service.ts:172–183`、`src/store.ts:43–69`。
- 包不可变，因此不会跟随磁盘文件变化；摘要不是代码正确性证明、签名或当前文件状态证明。native events 也没有被转换成独立测试认证。
- Leader 通过 `wait/status/result/packet` 拉取；状态栏轮询。没有持久自动回报队列、Leader 自动新回合或当前 Desktop 聊天自动唤醒：`src/cli.ts:55–64`、`src/service.ts:68–74`。
- 重启将活跃任务标记 interrupted、审批过期，不自动重放；没有先核对崩溃后仍存活的原生执行进程：`src/store.ts:72–76`。

## 受控实验与实际风险

实验直接导入当前 `TaskService`，使用两个脚本 Runner 替代 Codex/DSH；临时 Git 仓库先提交基线，再创建 Entry 未提交文件。Leader 写设计文件，派发 A；A 写 API 文件，封存后再派发 B。结果：

```json
{
  "workerBSeesEntryDirty": false,
  "workerBSeesLeaderPlan": false,
  "workerBSeesWorkerAApi": false,
  "oldPacketUnchangedAfterExternalEdit": true,
  "oldPacketAcceptanceAfterExternalEdit": "accept",
  "parentPacketStillPointsToChildTurn": 1,
  "currentChildTurn": 2,
  "parentOldSnapshotAcceptance": "accept"
}
```

1. **上下文与代码断层。** 独立 worktree 避免直接覆盖文件，但没有把协作成果送到下一个成员。传 prompt 或路径不等于已复制相应文件；可以导致重复实现或基于旧接口开发。
2. **快照与当前项目混淆。** 接受旧包是当前快照契约允许的行为；如果 UI 用一个不含版本的“已验收”概括当前目录或整个团队，就会误导。子任务进入第二回合不会自动使父任务第一回合包失效，父包仍能被按旧快照接受。后续集成应消费已审查快照，并在项目层区分“历史验收”与“当前有效”。
3. **完成与送达混淆。** 写入数据库不等于 Leader 已读或开始后续操作；Leader 可以结束，而 Worker 留有待处理结果。自动继续应先服务于 Harnmux 自己持有的 Leader 会话。
4. **异常结束与恢复。** 重启不盲重放是已有保护，但“interrupted”不证明外部进程已停止。应先核对执行归属与原生会话，再恢复。终态、diff、seal 为多个步骤，崩溃窗口可能留下无包的终态任务；当前审查拒绝无包，而不会自动修复封存。
5. **不完整交付。** 捕获上限 262144 个 JS 字符；底层 Git stdout buffer 为 1 MiB，超过可能直接采集失败。截断包拒绝接受，但代码仍在磁盘；大交付需要快照/文件引用，不能仅提高 prompt 长度。采集不是原子文件系统快照，尤其未确认退出时不能证明所有写入已停。
6. **工作区和权限边界。** API 的角色限制、loopback/Origin/Host 检查、私有目录、任务令牌与脱敏是已有措施；同一 OS 用户仍可能读到 admin token，worktree 不是 OS 安全沙箱。审批保证取决于原生执行面有效策略及实际接住的交互。当前脱敏不是通用密钥/DLP 扫描。

## 对照竞品

固定源码：CodexHost `a8adb78b519a81795fc05b787811f20a9738d7f0`；Harness Mix `b3e4b54d6a3a5043875b38cc39005bee7d2f1c85`；0xSero `d1cd1c77fe92367d4cd9e055fffaef8236a65930`。前两者沿用此前固定 checkout，未声称已追到上游最新版本。

| 产品 | 任务/会话 | 代码 | 结果/恢复 |
| --- | --- | --- | --- |
| CodexHost | 任务文本交给目标原生会话；Host thread 映射 nativeRef；requestId/digest 抑制重复 | 委派主路径默认继承 cwd，调用者可传预备目录；该路径未自动创建 worktree，不代表整个产品无 worktree | 保存原生状态/结果；watch 用 read/send 通知订阅方；watch 在内存。区分明确没启动和投递结果未知，后者不盲重试 |
| Harness Mix | 持久团队/job/成员会话/邮箱；任务信封与后续消息；中断可请求模型自述 handoff | shared 或隔离；有外部活跃会话占用同目录时默认 auto；私有 Git index 包含未提交内容，播种 worktree | 邮箱 queued/delivering/native_session/mailbox；空闲 Leader 可续行；review/apply 重算 patch digest，检查冲突，可提供三方候选；验证门禁按配置 off/advisory/required，不能说默认所有测试都强制通过 |
| 0xSero harness-bridge / Local AI | 模型端点/模型选择与 harness 启动；Session 是 terminal command/dir/name，不是编排任务 | 将原生 harness 启动到 cwd，由它自己操作；所查主路径未管理 worker worktree 交接 | 原生终端拥有输出与执行生命周期；配置/模型缓存持久化；没有在所查路径发现任务交付、验收与 Leader 回报闭环 |

### 启发与优先级

1. 借鉴 Harness Mix 的“源代码快照 + 只计算 worker 增量”，但支持 dirty snapshot 会改变当前 committed-baseline 约定，需同步 Spec Kit 规范，不能静默改变。
2. 保留 Harnmux 的每回合包/回执，增加上游包版本、集成输入和当前有效性；审查后如磁盘已变，应取审查快照而非任意当前分支。
3. 结果投递单独持久化，区分保存、待投递、送达、已开始处理、投递未知；借鉴 CodexHost 对未知启动不盲重试。首先支持工具拥有的 Leader 会话，不承诺任意 Desktop 当前聊天控制。
4. 恢复前核对原生执行状态；可修复缺失封存；显示交付截断与采集失败，不用“成功”覆盖证据缺口。
5. 借鉴 Local AI 的薄 Swift UI、共享快照、兼容性探测和缓存失效提示。它的启动参数重读全局模型选择适合手动启动，但编排任务要固定请求/有效模型，不能把打开终端当作任务已执行。

仅需要现有服务 + SQLite + 适配器 + Git 快照来补这些契约，暂不需要额外消息平台或通用编排语言。

## 主要源码链接

- [CodexHost 创建原生委派](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/harness-delegation-coordinator.ts#L206)
- [CodexHost watch 与投递未知](https://github.com/BytePioneer-AI/codex-host/blob/a8adb78b519a81795fc05b787811f20a9738d7f0/packages/host-runtime/src/delegation-watch.ts#L33)
- [Harness Mix 工作区快照与审查应用](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration-worktree.js#L38)
- [Harness Mix 邮箱](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L957)
- [Harness Mix 唤醒 Leader](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/collaboration.js#L1903)
- [Harness Mix 验证策略](https://github.com/emo-xiaoyu/harness-mix/blob/b3e4b54d6a3a5043875b38cc39005bee7d2f1c85/src/main/host/verification-gates.js#L16)
- [0xSero 产品定位](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/README.md)
- [0xSero 启动命令](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/packages/core/src/core.ts#L418)
- [0xSero 详细复核](0xsero-bridge-review-2026-10-22.md)
