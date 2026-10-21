# Harness Bridge

在当前 AI 编程入口里，选择另一个原生 harness 当 Leader，再委派原生 Worker。macOS 状态栏负责进展、审批和交付，无需另开聊天 GUI。

首版提供 **Codex + DSH 原生协议适配器**、本地服务、CLI/Skill 和 SwiftUI 状态栏。14 项受控自动化测试、真实 Codex 初始化握手通过；**真实模型团队执行、DSH 环境和 Desktop 交互尚未验证**，详见[验收记录](specs/001-cross-harness-team/verification.md)。

## 角色如何衔接

```text
DSH Desktop / CLI（交流入口）
  └─ Bridge Skill / CLI → 本地任务服务
       └─ Codex app-server（Leader，原生 Codex 循环）
            └─ Bridge dispatch → DSH ACP / acpx（Worker，原生 DSH 循环）

SwiftUI 状态栏 ← 同一个本地任务服务 → SQLite + 独立 Git worktree
```

入口、Leader、Worker 分别选择。反向组合只需更换 profile。Magpie 等 router 继续负责目标 harness 内的模型；Bridge 负责任务、权限回传、持久化和交付。Leader 通过临时凭据调用 Bridge CLI 派发、等待并查询子任务；Worker 无法继续派发。模型是否正确规划、委派和验收，仍需真实模型联调。

## 源码运行

需要 macOS 14+、Node 22.13+、Git，以及构建 UI 所需的 Swift 6 工具链。分别安装和认证 Codex、DSH。`doctor` 只检查路径和配置，不验证账号、模型或插件。

```sh
cd /Users/weizhihao/Projects/Agents/harness-bridge
npm ci
npm run build
node dist/cli.js doctor
node dist/cli.js start
npm run ui:bundle
```

在 Finder 打开生成的 `dist/Harness Bridge.app`。它显示菜单栏图标，没有 Dock 聊天窗口。退出界面后任务继续；`node dist/cli.js stop` 显式停止服务并请求取消活动任务。`serve` 则以前台方式运行，方便诊断。

默认状态目录为 `~/.harness-bridge`，包含配置、数据库、worktree、会话引用和服务日志。`HBRIDGE_HOME` 可选择其他目录，服务、CLI、UI 必须保持一致。Finder 启动 UI 使用默认目录；自定义目录可从终端设置环境后启动 app 内的 `Contents/MacOS/HarnessBridge`。不安装 LaunchAgent，重启电脑后手动 `start`。

## 在当前 harness 里使用

将共享 Skill 安装到你要工作的项目：

```sh
node scripts/install-skill.mjs /absolute/path/to/your-project
```

脚本写入该项目 `.agents/skills/harness-bridge/SKILL.md`，填入本机 Node 与 Bridge 的绝对路径，拒绝覆盖已有文件。Codex 可使用项目 Skill；其他 harness 按其文档加载同一文件，或在会话中提供该文件。DSH 的 Skill 自动发现未在本机验证。入口有 shell 工具时也可直接调用下面的 CLI，无需修改 Desktop 安装包。

目标 Git 仓库必须至少有一个提交。此命令启动真实 harness，可能消耗模型额度：

```sh
node /absolute/path/to/harness-bridge/dist/cli.js run \
  --entry dsh --leader codex --workers dsh \
  --repo /absolute/path/to/your-project \
  --request-id my-project-task-001 \
  --task '先制定计划，再派发 DSH Worker 实现指定功能，检查其结果和测试；保留修改供我审查。'
```

反向组合用 `--entry codex --leader dsh --workers codex`。`--entry` 是交流来源标签，不代表附着或控制当前 Desktop 会话。Leader 和 Worker 参数使用 Bridge profile 名称。提交 ID 应稳定：相同内容重试返回原任务；同 ID 改内容会被拒绝。

```sh
node dist/cli.js list
node dist/cli.js wait TASK_ID --timeout 60
node dist/cli.js status TASK_ID
node dist/cli.js result TASK_ID
node dist/cli.js continue TASK_ID --task '检查结果后追加的要求'
node dist/cli.js cancel TASK_ID
node dist/cli.js ack TASK_ID
```

等待超时后查询同一个 ID。审批显示在状态栏详情和 `status` 中，用户也可用 `approve APPROVAL_ID --option NATIVE_OPTION_ID` 回应精确原生选项。Entry Skill 要求代理把审批交给用户；Leader/Worker 任务凭据不能调用审批接口。

## Harness 与模型配置

无配置文件时使用原生默认模型。Codex 命令为 `codex app-server --listen stdio://`，DSH 为 `dsh --profile acp`。命令必须在启动服务时的 PATH 中，或在配置中使用绝对路径。

可在 `~/.harness-bridge/config.json` 创建命名 profile；[examples/team.json](examples/team.json) 是最小模板：

```json
{
  "profiles": {
    "codex": { "harness": "codex" },
    "dsh": { "harness": "dsh" },
    "codex-custom": {
      "harness": "codex",
      "model": "YOUR_NATIVE_MODEL_ID",
      "command": ["/absolute/path/to/codex", "app-server", "--listen", "stdio://"]
    }
  }
}
```

仅填写原生支持的实际模型 ID。Codex 核对响应中的模型；DSH 从会话宣告的目录选择，不支持就失败，不静默换模型。省略 `model` 沿用原生配置，包括已有 router。更改配置后重启服务；续接时若 profile 已换成另一种 harness，将拒绝复用旧会话。

Bridge 不管理账号、provider、Magpie 安装或 DSH 插件。原生进程沿用自身配置解析；ACP profile 与 Desktop profile 的能力可能不同。具体插件兼容按用户要求暂不作为首版门槛。

## 交付与限制

- 每个 Leader/Worker 从明确提交创建独立分支和 worktree，默认基线 `HEAD`，可用 `--base REF` 更换。入口脏文件及 Leader 未提交改动不会自动进入 Worker，派发时需提供必要上下文。
- 本地保留报告、已跟踪/新文件差异、原生工具事件与工作目录。完成表示执行结束，仍待审查，不自动合并或清理。大量输出会明确截断，完整文件以 worktree 为准；交付捕获错误在事件中报告。
- Codex 默认 `workspace-write + on-request`；DSH/acpx 回调失败默认拒绝。部分 Codex 交互请求尚不支持，会明确拒绝。联网或读取其他 worktree 可能需要额外原生审批。
- 最多 4 个并发执行成员，每回合最长 30 分钟。取消 5 秒内未确认则请求停止原生进程并报告 `interrupted`，不假称取消已确认。
- 崩溃后活动任务标记中断，不自动重放。意外崩溃可能遗留原生进程；恢复记录不等于确认进程已终止，继续前需核查。原生续接取决于目标 harness 版本。
- 不注入 Desktop、不嵌入原生子 agent 树、不自动唤醒入口。使用状态栏未读计数和 `wait/status/result` 获取持久结果；没有系统通知弹窗。
- API 仅监听 `127.0.0.1`，有 Bearer 认证和任务角色作用域。**这是协作控制，不是针对同一系统用户恶意代码的安全沙箱**；该用户可读取管理凭据。worktree 也不是 OS 沙箱。
- 不承诺任意 harness/模型组合兼容。能力接口的 `supported` 表示协议操作已有实现，不表示本机环境或真实模型已验证。

## 开发与证据

```sh
npm run check
npm test
npm run ui:build
npm run ui:bundle
```

Node 22 的 `node:sqlite` 有实验性提示。测试使用自有 JSON-RPC/ACP 子进程 fixture 和临时 Git 仓库，不调用模型；一次性仓库保留在系统临时目录便于排错。

项目使用 [GitHub Spec Kit](https://github.com/github/spec-kit) 1.2.2 和 grilling 设计访谈：[项目原则](.specify/memory/constitution.md)、[功能规格](specs/001-cross-harness-team/spec.md)、[计划](specs/001-cross-harness-team/plan.md)、[任务](specs/001-cross-harness-team/tasks.md)、[验收记录](specs/001-cross-harness-team/verification.md)。托管模板保持原样。

架构依据见[参考源码评审](docs/reference-architecture-review.md)和[最小架构](docs/architecture-proposal.md)。UI 使用 ui-ux-pro-max 并适配 Apple 原生规范，见[设计系统](design-system/harness-bridge/MASTER.md)。[明暗预览](design-system/harness-bridge/previews/menu-bar-study.png)仅为静态示例，不是运行中应用截图。

原创实现使用 [MIT](LICENSE)，第三方保留原许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。尚未配置远程或发布。
