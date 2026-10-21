# acpx 0.20.0 嵌入 runtime 技术验证

日期：2026-10-21。读取官方源码提交 `afc076b501774c6139c9732f5487dc721d5bd757`，并实际安装 npm `acpx@0.20.0` 到 `/tmp/hb-acpx-probe`，使用自写无模型 ACP fixture 实测。未读取用户配置/凭据，未调用付费模型或实际 DSH。这里证明 runtime 接口与 fake 协议往返，不证明 DSH Desktop 或插件兼容。

## 决策

优先复用 `createAcpRuntime()`，而非 shared runtime；每任务一个 runtime 可提供独立 child-only env 与审批回调。保持一个 native session 只有一个连接/进程所有者，外围服务负责本项目任务/worktree/UI。

- `agentProcessEnv` 为 runtime 级快照，传给所拥有的子进程，不写入 session store；同一 runtime 没有逐 session env resolver。因此若要每任务注入不同的 Bridge 作用域 token，使用独立 runtime，不改全局 `process.env`。
- 子进程继承原始 `process.env`，再叠加 `agentProcessEnv`；acpx 保护的认证变量不可被该 overlay 覆盖。Bridge 自定义变量不应伪装为 provider 认证变量。
- DSH 作为自定义 agent 注册 `['dsh', '--profile', 'acp']`，argv 数组避免 shell 拼接；DSH 并非内置 registry 项。

## 最小接口示例

```ts
import {
  createAcpRuntime,
  createAgentRegistry,
  createFileSessionStore,
} from 'acpx/runtime';

const runtime = createAcpRuntime({
  cwd: worktree,
  sessionStore: createFileSessionStore({ stateDir: taskStateDir }),
  agentRegistry: createAgentRegistry({
    overrides: { dsh: ['dsh', '--profile', 'acp'] },
  }),
  permissionMode: 'deny-all',
  nonInteractivePermissions: 'deny',
  agentProcessEnv: { BRIDGE_TASK_TOKEN: scopedToken },
  // Optional processLifecycle.onSpawned records pid for service-owned cleanup.
});
const handle = await runtime.ensureSession({
  sessionKey: taskId,
  agent: 'dsh',
  mode: 'persistent',
  cwd: worktree,
  // resumeSessionId: priorNativeSessionId, // explicit resume when required
});
const status = await runtime.getStatus({ handle });
// status.models: {currentModelId?, availableModelIds, availableModels?}
// Resolve user selection against actual advertised opaque IDs.
if (requestedModel) await runtime.setModel({ handle, model: requestedModel });
const turn = runtime.startTurn({
  handle,
  text: prompt,
  mode: 'prompt',
  requestId: turnId,
  timeoutMs: turnDeadlineMs,
  onPermissionRequest: async (request, { signal }) => {
    // request = {sessionId, raw:{sessionId,toolCall,options}, inferredKind}
    // Persist/display request.raw; await an explicit current-user decision.
    const optionId = await askUser(request.raw, signal);
    if (signal.aborted) return { outcome: 'cancel' };
    return { outcome: 'selected', optionId };
  },
});
for await (const event of turn.events) {
  // text_delta:{text,stream?}; status:{text,...}; tool_call:{rawInput,content,...}
  publish(event);
}
const result = await turn.result;
// completed | cancelled | failed; turn.events does not emit terminal done/error.
// result resolves after persistence and cleanup attempts settle.
```

Other controls:

```ts
await runtime.setConfigOption({ handle, key: nativeConfigKey, value: nativeValue });
await turn.cancel({ reason: 'user-request' }); // or runtime.cancel({handle})
await runtime.close({ handle, reason: 'service-stop' });
await runtime.shutdown();
```

`close()` also sets local fresh-session behavior on later ensure; do not use it as a synonym for “finish one turn but preserve current pooled connection”. `shutdown()` stops owned connections and leaves stored sessions resumable. The application must record the native session ID and distinguish intentional fresh versus resume.

## 审批的重要语义

- `AcpPermissionHandler` 返回 `Promise<AcpPermissionDecision | undefined>`；第二参数含 AbortSignal。
- 决策可为 `{outcome:'selected',optionId}`、allow_once、reject_once、cancel 等；建议采用请求中精确 ID，避免自造 DSH 选项。
- `raw.options` 的 `optionId`、`kind` 与名称必须一起展示和验证；用户一次授权不能被改为 allow_always。
- handler 抛错或返回 undefined 会落到配置的权限策略；显式 `permissionMode:'deny-all'` 可使这种情况拒绝，而不是放行。
- pending UI promise 必须监听 abort；回合取消后不得接受迟到授权。
- `fs:false` / `terminal:false` 只关闭 ACP client callbacks，不是对原生进程的 OS sandbox；按实际目标需求选择，不能冒充安全隔离。

## 实测结果

复现：`node /tmp/hb-acpx-probe/probe.mjs`。fixture 是独立 Node ACP server，仅返回合成文本，不执行 shell 或访问模型。

| 场景 | 结果 |
| --- | --- |
| ensureSession/new，返回 native session 与模型目录 | PASS |
| setModel mock-a → mock-b（config option 路径） | PASS |
| 回调允许原生 allow-once ID | PASS |
| 无回调 + deny-all → 原生 reject-once | PASS |
| 挂起 prompt 收到 cancel，turn.result 为 cancelled | PASS |
| 传入 child-only synthetic token，子进程可见 | PASS |
| session JSON 不含 synthetic token | PASS |

这些 `/tmp` 文件是调查探针，不是仓库自动化测试；产品实现需在仓库加入自有 fixture 与回归测试。真实 DSH 的安装、认证、模型和原生权限往返仍未验证。

## 固定源码证据

- [公开 contract：ensure、turn、events、options](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/src/runtime/public/contract.ts)
- [runtime 导出与 env 快照](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/src/runtime.ts#L119-L132)
- [自定义 registry](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/src/agent-registry.ts#L516-L538)
- [审批请求与返回类型](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/src/types.ts#L19-L36)
- [env 继承、保护与 overlay](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/src/acp/auth-env.ts#L95-L118)
- [resume 优先于 load，均不支持时报错](https://github.com/openclaw/acpx/blob/afc076b501774c6139c9732f5487dc721d5bd757/src/runtime/engine/manager.ts#L274-L300)
