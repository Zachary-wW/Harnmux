# Codex app-server 协议探针

日期：2026-10-21。本机 `/Users/weizhihao/.local/bin/codex`，`codex-cli 0.142.5`。
依据该二进制生成的官方 JSON Schema，辅以实际 stdio 初始化。没有创建 thread/turn、调用模型、读取凭据文件或修改全局配置。本文件是实现参考，不证明真实任务、审批往返或 Desktop 挂接已验证。

## 可复现证据

```sh
codex --version
codex app-server generate-json-schema --out /tmp/bridge-codex-probe-schema
codex app-server --listen stdio://
```

stdin/stdout 是每行一条 JSON 的双向 RPC，不使用 LSP Content-Length。发送：

```json
{"id":1,"method":"initialize","params":{"clientInfo":{"name":"harnmux_protocol_probe","version":"0.1.0"},"capabilities":{"experimentalApi":false}}}
```

实际返回 `result`，无 error；仅检查字段名：userAgent、codexHome、platformFamily、platformOs，未将实际目录值写入报告。随后发送 `{"method":"initialized"}`。关闭 stdin 并 SIGTERM 回收探针进程，未请求任务。稳定 schema 中没有通用 shutdown RPC，因此不能假设该方法存在。

## 最小会话调用

`thread/start` 不要求必填字段，建议明确约束：

```json
{"id":2,"method":"thread/start","params":{"cwd":"/absolute/worker-worktree","sandbox":"workspace-write","approvalPolicy":"on-request","approvalsReviewer":"user"}}
```

- 可选 `model`、`modelProvider`、`developerInstructions`、`config`；不传 model 时使用目标原生配置。
- sandbox 枚举：read-only、workspace-write、danger-full-access。本项目不能默认选择最后一项。
- approvalPolicy 可为 untrusted/on-failure/on-request/never 或 granular 对象；本项目不能默认 never。
- `thread/start` 与 `thread/resume` 的 response 均含实际 `thread.id`、cwd、model、modelProvider、approvalPolicy、approvalsReviewer、sandbox。必须保存/核查实际结果，不能仅记录请求。
- `thread/resume` 必须传 `threadId`，可覆盖 cwd/model/approvalPolicy/sandbox 等。优先 threadId，不依赖不稳定 rollout path。

执行：

```json
{"id":3,"method":"turn/start","params":{"threadId":"<native-thread-id>","input":[{"type":"text","text":"<task>"}]}}
```

response 为 `{turn:{id,items,status,...}}`。`turn/start` 可覆盖 model、effort、cwd、approvalPolicy、approvalsReviewer、sandboxPolicy；注意这里是 sandboxPolicy 对象，不是 thread/start 的 sandbox 字符串。

取消：

```json
{"id":4,"method":"turn/interrupt","params":{"threadId":"<native-thread-id>","turnId":"<native-turn-id>"}}
```

请求返回不等于已观察到终止；随后需要对应回合的终止状态。连接断开须标记未知/中断，不虚报取消成功。

## 审批是 server→client request

保留服务器 request `id` 的原始数字/字符串类型，响应同一 id：

```json
{"id":"<server-request-id>","result":{"decision":"accept"}}
```

| 方法 | 参数重点 | 本项目安全响应 |
| --- | --- | --- |
| item/commandExecution/requestApproval | threadId、turnId、itemId、startedAtMs；command/cwd/reason 可缺失；approvalId 可单独区分一个 item 下多个审批 | `{decision:"accept"}` 允许本次；`{decision:"decline"}` 拒绝并允许 agent 继续；`{decision:"cancel"}` 拒绝并中断回合 |
| item/fileChange/requestApproval | threadId、turnId、itemId、startedAtMs；reason/grantRoot 可缺失 | 同上；审批参数本身不含 diff，必须关联 item/started 等 fileChange item 获取 changes |
| item/permissions/requestApproval | threadId、turnId、itemId、startedAtMs、cwd、permissions | 允许返回明确选择的 `{permissions:<granted-profile>,scope:"turn"}`；拒绝 `{permissions:{},scope:"turn"}` |

command/fileChange 还支持 acceptForSession 以及部分持久规则变更，本项目的“允许一次”不能映射到这些值。permissions 的最短标准 scope 是 turn，不能用 UI 文案把它伪装成单条命令权限；session 扩权不是本项目默认行为。允许内容应限于用户实际审查的请求；未知权限类型不自动授予。

还有 `item/tool/requestUserInput`（response `{answers:{questionId:{answers:[...]}}}`）、MCP elicitation 与动态工具调用等 server request。若暂未支持，明确记录并回传协议错误或该请求契约定义的拒绝，不能留悬空 promise；不能把任意 server request 都按 command approval 回答。

## 事件与结果

- `thread/started`：`params.thread`。
- `turn/started`、`turn/completed`：`params.threadId` 与 `params.turn`。
- `item/agentMessage/delta`：threadId、turnId、itemId、delta。按 item 聚合，不把流式中间文本等同最终结果。
- `item/started` / `item/completed`：threadId、turnId、item；item 有 type。agentMessage 包含 text、可选 phase（commentary/final_answer）；fileChange 包含 changes（path/diff/kind）；commandExecution 包含 command、cwd、status、aggregatedOutput、exitCode 等。
- `item/commandExecution/outputDelta`、`item/fileChange/outputDelta`：按 threadId/turnId/itemId 关联增量输出。
- `turn/completed` 的 turn.status 枚举为 completed/interrupted/failed/inProgress，**方法名 completed 不等于任务成功**；失败时读取 turn.error。
- `error` notification 有 threadId、turnId、error、willRetry。willRetry=true 不应立刻终结任务；最终以回合结果或连接状态结算。

收到 item/completed 后应以完整 item 校正 delta 聚合，避免重复拼接；终结时完整 turn.items 也可作为补充，注意 itemsView 并非总是 full。

## Schema 固定指纹（SHA-256）

生成目录为 `/tmp/bridge-codex-probe-schema`，不把整套生成文件加入本项目。可通过上述固定版本重新生成比对：

| 相对文件 | SHA-256 |
| --- | --- |
| v1/InitializeParams.json | 4f576f99e285beb28f71f48a72b887c1f517dada86fee348fe2af0a35511de23 |
| v2/ThreadStartParams.json | e31452a630067eef70efc58e2c0b58f682e489c2ddb43c1244b0ade9fb8d845c |
| v2/ThreadResumeParams.json | 14284f5fa117bdea14393ac0b709da868bdee441f81b719a1fe11fc44a3a87d9 |
| v2/TurnStartParams.json | 4c3362a4d559ee6ae9d9edc2cc63b657f5703f74bf6e2de9155bc56c73c31086 |
| v2/TurnInterruptParams.json | 49132b57b09f09dc545ed1cd373c12eede6e880e9afb54ae50add78bb42490cd |
| CommandExecutionRequestApprovalResponse.json | 42010a48dd9ad989171728c30338e1ff8144c31bd33921cbfb5608fd6c85a3b5 |
| PermissionsRequestApprovalResponse.json | 60abc8a0d1c1f24be5be8fafbeb8a2bd0c327ba44088c74ba414b31acdfd4489 |

适配器仍需协议 fake 测试、真实模型任务审批/取消测试；本次初始化不证明附着到已运行 Desktop、原生 UI 投影或自动唤醒。
