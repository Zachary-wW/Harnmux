# 0xSero/harness-bridge：交接与状态管理边界

复核日期：2026-10-22。仓库：https://github.com/0xSero/harness-bridge 。本地只读 checkout：`/Users/weizhihao/Projects/Agents/harnmux-lab/sources/0xsero-harness-bridge`，提交 `d1cd1c77fe92367d4cd9e055fffaef8236a65930`。本轮仅克隆和读取源码；未安装依赖、启动应用、访问模型端点、运行模型任务或改变用户配置。其他同名 Harness Bridge 仓库不在本篇范围内。

## 结论

该提交的产品自称 **Local AI**，核心是「选择推理端点和模型，再用对应环境和参数启动真实 coding harness」。它是启动与模型接入配置层；在下述核心、CLI、Web 和 Swift tray 路径中，未发现 Harnmux 式任务委派、原生 session ID 映射、worktree 交付、结果验收或自动唤醒负责人机制。这里的 session 是终端中的启动命令，不能与持久项目任务等同。[S1][S2][S3]

它也不是自建推理代理服务：主路径通过环境变量、CLI 覆盖或工具自有配置，让目标 harness 直接连接用户配置的兼容端点。与 Magpie 的共同点是关注 harness→model 接入；实现层次与是否承担请求转换仍应分别描述，不能直接称为同一种路由器。[S2]

## 任务、代码、结果各归谁管理

| 对象 | 读取到的实际机制 | 对 Harnmux 对比的含义 |
| --- | --- | --- |
| 启动请求 | `run` 构造 endpoint/model/env/argv，再让终端运行本工具的 `run --harness … --exec --dir …`；`--exec` 用继承 stdio 启动原生 harness。[S2][S3] | 负责启动，不负责从 Leader 分解任务给 Worker。用户可把附加参数传给 `--exec`，但没有共享任务契约。 |
| 代码 | `cwd` 取本次指定目录、配置目录或 shell 目录。[S2] | 目标 harness 直接在该目录工作。检查路径未见自动 worktree、代码快照、补丁交付/合入机制；若多个 harness 指同目录，其协作/冲突仍由用户和原生 harness 处理。 |
| 执行结果 | `--exec` 的原生 stdout/stderr 直接出现在终端；终端启动路径返回 opened/terminal/command/prepared。[S2][S3] | `opened=true` 证明终端打开命令成功，不证明模型认证、任务完成或代码正确。未发现任务结果库、Leader 回报、accept/reject 状态。 |
| 原生会话 | 由被启动的 harness 自身创建和管理；本工具 `Session` 类型只有 command/dir/name。[S4] | 不应承诺本工具跨 harness 迁移完整聊天上下文、保存原生会话映射或断点续行。 |
| 持久化 | 自己的 JSON 配置保存 provider/key、当前 model、目录、终端、pin 和参数覆盖；模型列表存磁盘缓存。[S2][S5] | 配置持久化与任务执行持久化不同。 |

## 它怎样降低交互成本

- **一个 core、三个薄入口。** CLI/Web 使用同一 core，Swift tray 通过 CLI mutation 与 `snapshot --json` 得到统一读模型；没有为每个 UI 重写一套配置逻辑。[S3][S6]
- **缓存与保留上次可用状态。** 模型列表磁盘 TTL 30 秒；网络错误和部分服务端错误可回退旧列表。Swift Store 失败时保留旧 snapshot 并显示状态。[S5][S7] 这是目录体验优化，不是执行任务恢复。
- **能力检查。** endpoint dialect 对应 chat/messages/responses；提供单次小请求探测，再根据实际 dialect 阻止不兼容 harness 启动。[S2] 这种探测证明接口基本可用，不证明 tool calling、长上下文和模型在该 harness 中的行为质量。
- **UI 命令串行。** Swift Store 用本地 DispatchQueue 排队配置修改。[S7] 该队列不持久化，也不是 Worker 任务调度器；launch 独立在全局队列执行。

## 对当前问题相关的限制与风险

1. **没有团队交接语义。** 它没有在被检查的路径中传递计划、验收标准、上游代码版本和后续行动；这些留给原生 harness 与用户。因此不能把它列为已解决跨 harness 团队交接的竞品。[S2][S3][S4]
2. **启动参数必须核对。** 默认 Codex 与 Claude flags 分别跳过 approvals/sandbox 和 permissions，可用 `safe` 选项在构造 launch plan 时省略。[S8] 但终端重入命令只保留 harness 与 cwd，不携带 safe/extraArgs/provider/model，后续 `--exec` 会重读全局选择与默认参数。[S2][S3] 静态路径说明这些请求级选择未固定到最终命令；未在本轮运行复现。对 Harnmux 的启发是：任务创建时冻结实际执行参数和权限，不能只依赖可变的全局「当前模型」。
3. **不同启动时间可能读取不同全局模型。** `sessionCommand` 故意运行时取当前选择；创建命令后到终端实际启动前，其他 UI/CLI 可改变全局选择。[S2] 对启动器这是简化契约，对可审查任务编排则应改为不可变每任务配置。
4. **密钥有明确存储位置。** 主配置权限为 0600；部分 harness 用环境注入，但 Pi/OMP/Crush 的工具自有模型配置也会写入 key，写文件函数使用 0600。[S2][S8] 不应照抄 README 中「只有主配置含 key／没有任何 key 写文件」的泛化宣传；应依据具体 harness 路径说明。它没有修改原有全局配置，不等于所有原配置/插件自动被完整继承（例如替换 PI_CODING_AGENT_DIR、XDG_CONFIG_HOME）。

## 建议吸收的经验

Harnmux 可以吸收统一 snapshot、明确的兼容性提示、命令预览、后台执行 UI 操作、保留上次可用视图等经验。Harnmux 应继续自行承担任务生命周期、原生会话关联、代码基线、结果与验收的职责，并为这些职责提供更强的每任务配置与恢复契约。无需把模型端点管理纳入当前 MVP。

## 固定源码

- [S1 README / 产品目标](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/README.md)
- [S2 core：配置、launch plan、session command、run/openSession](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/packages/core/src/core.ts#L228)
- [S3 CLI：run → exec / terminal launch](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/packages/cli/src/cli.ts#L145)
- [S4 Session 只是命令/目录/名称](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/packages/core/src/terminals.ts#L13)
- [S5 模型缓存](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/packages/core/src/models.ts#L17)
- [S6 统一 Snapshot](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/packages/core/src/snapshot.ts#L13)
- [S7 Swift CLI 队列与保留视图](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/packages/tray/App.swift#L7)
- [S8 默认权限参数与私有文件写入](https://github.com/0xSero/harness-bridge/blob/d1cd1c77fe92367d4cd9e055fffaef8236a65930/packages/core/src/harnesses.ts#L72)
