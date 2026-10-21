# Harnmux

在当前 AI 编程入口里，选择另一个原生 harness 当 Leader，再委派原生 Worker。macOS 状态栏负责进展、审批和交付，无需另开聊天 GUI。

首版提供 **Codex + DSH 原生协议适配器**、本地服务、CLI/Skill 和 SwiftUI 状态栏。19 项受控自动化测试、真实 Codex 初始化握手通过；**真实模型团队执行、DSH 环境和 Desktop 交互尚未验证**，详见[最新验收记录](specs/002-reviewable-delivery/verification.md)。

## 与现有工具的区别

Harnmux 的定位是：**从现有 harness 发起跨 harness 团队任务，默认隔离修改，保留原生审批，并把 Leader 建议与用户验收分开记录。** 首版集中兑现这个流程。

| 项目 | 已有优势 | Harnmux 的选择与代价 |
| --- | --- | --- |
| CodexHost | 原生委派和 Codex Desktop 会话投影 | 默认独立 worktree、转交原生审批、不注入 Desktop；失去原生会话树投影 |
| Harness Mix | 多 harness、持久团队、DAG、worktree、digest review/apply 和验证门禁 | 更小的两种 harness 范围，围绕审批和独立验收；目前覆盖与成熟度更低 |
| rbutera/harness-bridge | Claude↔Codex MCP 与原生会话连续性 | 增加任务服务、隔离和审批面板；暂缺 MCP 入口 |
| 0xSero/harness-bridge | 模型连接、启动环境、macOS 状态栏 | 专注团队执行与交付，复用 Magpie 等模型路由 |
| Codex Mixin | Codex 模型网关 | 属于不同层次，Harnmux 不承担模型协议转换 |

worktree、摘要、回合证据和状态栏都已有先例，不能宣称首创。新增的固定交付快照与双层审查补齐本项目自身缺口；这是可测试的产品契约，尚不能证明市场上独有。[源码对照与固定提交来源](docs/competitive-research-2026-10-21.md)同时记录竞品的优势、默认配置取舍和我们的未验证项。

## 角色如何衔接

```text
DSH Desktop / CLI（交流入口）
  └─ Harnmux Skill / CLI → 本地任务服务
       └─ Codex app-server（Leader，原生 Codex 循环）
            └─ Harnmux dispatch → DSH ACP / acpx（Worker，原生 DSH 循环）

SwiftUI 状态栏 ← 同一个本地任务服务 → SQLite + 独立 Git worktree
```

入口、Leader、Worker 分别选择。反向组合只需更换 profile。Magpie 等 router 继续负责目标 harness 内的模型；Harnmux 负责任务、权限回传、持久化和交付。Leader 通过临时凭据调用 Harnmux CLI 派发、等待并查询子任务；Worker 无法继续派发。模型是否正确规划、委派和验收，仍需真实模型联调。

## 源码运行

需要 macOS 14+、Node 22.13+、Git，以及构建 UI 所需的 Swift 6 工具链。分别安装和认证 Codex、DSH。`doctor` 只检查路径和配置，不验证账号、模型或插件。

```sh
cd /Users/weizhihao/Projects/Agents/harnmux
npm ci
npm run build
node dist/cli.js doctor
node dist/cli.js start
npm run ui:bundle
```

在 Finder 打开生成的 `dist/Harnmux.app`。它显示菜单栏图标，没有 Dock 聊天窗口。退出界面后任务继续；`node dist/cli.js stop` 显式停止服务并请求取消活动任务。`serve` 则以前台方式运行，方便诊断。

默认状态目录为 `~/.harnmux`，包含配置、数据库、worktree、会话引用和服务日志。`HARNMUX_HOME` 可选择其他目录，服务、CLI、UI 必须保持一致。Finder 启动 UI 使用默认目录；自定义目录可从终端设置环境后启动 app 内的 `Contents/MacOS/Harnmux`。不安装 LaunchAgent，重启电脑后手动 `start`。

改名前的 `~/.harness-bridge` 数据保持原样，不自动迁移或删除。需要沿用时可显式设置 `HARNMUX_HOME` 指向该目录；这是未发布 MVP 的改名，不保留旧命令和环境变量别名。

## 在当前 harness 里使用

将共享 Skill 安装到你要工作的项目：

```sh
node scripts/install-skill.mjs /absolute/path/to/your-project
```

脚本写入该项目 `.agents/skills/harnmux/SKILL.md`，填入本机 Node 与 Harnmux 的绝对路径，拒绝覆盖已有文件。Codex 可使用项目 Skill；其他 harness 按其文档加载同一文件，或在会话中提供该文件。DSH 的 Skill 自动发现未在本机验证。入口有 shell 工具时也可直接调用下面的 CLI，无需修改 Desktop 安装包。

目标 Git 仓库必须至少有一个提交。此命令启动真实 harness，可能消耗模型额度：

```sh
node /absolute/path/to/harnmux/dist/cli.js run \
  --entry dsh --leader codex --workers dsh \
  --repo /absolute/path/to/your-project \
  --request-id my-project-task-001 \
  --criterion '逐项报告修改、实际验证和未完成事项' \
  --task '先制定计划，再派发 DSH Worker 实现指定功能，检查其结果和测试；保留修改供我审查。'
```

反向组合用 `--entry codex --leader dsh --workers codex`。`--entry` 是交流来源标签，不代表附着或控制当前 Desktop 会话。Leader 和 Worker 参数使用 Harnmux profile 名称。提交 ID 应稳定：相同内容重试返回原任务；同 ID 改内容会被拒绝。

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

## 固定交付与明确验收

每回合尝试封存独立交付包，包含目标、验收项、提交基线、harness/model/session、二进制兼容差异和有界原生事件。模型报告与原生观察分别存放；原生事件也不等于服务独立执行了测试。SHA-256 标识导出快照内容，不证明代码正确或当前 worktree 未被修改。

```sh
node dist/cli.js packet TASK_ID --turn 1
# 阅读快照后，用户指定返回的摘要并填写意见
node dist/cli.js review TASK_ID --turn 1 --digest SHA256_FROM_PACKET \
  --decision accept --note '已审查此快照并核对验收标准'
# 或 --decision request_changes --note '请补齐缺失的错误处理'
```

Leader 只能对自己的 Worker 记录 `recommend_accept` / `request_changes`；用户单独决定 `accept`。续跑保留历史快照和意见，清除当前验收；旧 turn/digest、执行中、失败或不完整差异不能用于验收。父交付引用成员快照，未完成或未封存成员阻止验收。`ack` 仅表示已读。验收针对封存内容，不会合并代码，也不包含之后的工作区修改。旧任务若没有交付包，继续可查询而不会伪造证据。

原生面板可查看标准、分别显示 Leader/用户意见，复制交付包，并填写意见验收或要求修改。

## Harness 与模型配置

无配置文件时使用原生默认模型。Codex 命令为 `codex app-server --listen stdio://`，DSH 为 `dsh --profile acp`。命令必须在启动服务时的 PATH 中，或在配置中使用绝对路径。

可在 `~/.harnmux/config.json` 创建命名 profile；[examples/team.json](examples/team.json) 是最小模板：

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

Harnmux 不管理账号、provider、Magpie 安装或 DSH 插件。原生进程沿用自身配置解析；ACP profile 与 Desktop profile 的能力可能不同。具体插件兼容按用户要求暂不作为首版门槛。

## 交付与限制

- 每个 Leader/Worker 从明确提交创建独立分支和 worktree，默认基线 `HEAD`，可用 `--base REF` 更换。入口脏文件及 Leader 未提交改动不会自动进入 Worker，派发时需提供必要上下文。
- 本地保留报告、已跟踪/新文件差异、原生工具事件与工作目录。每回合保留固定交付包和审查记录；完成表示执行结束，仍待审查，不自动合并或清理。大量输出会明确截断，完整文件以 worktree 为准；交付捕获错误在事件中报告。
- Codex 默认 `workspace-write + on-request`；DSH/acpx 回调失败默认拒绝。部分 Codex 交互请求尚不支持，会明确拒绝。联网或读取其他 worktree 可能需要额外原生审批。
- 最多 4 个并发执行成员，每回合最长 30 分钟。取消 5 秒内未确认则请求停止原生进程并报告 `interrupted`，不假称取消已确认。
- 崩溃后活动任务标记中断，不自动重放。意外崩溃可能遗留原生进程；恢复记录不等于确认进程已终止，继续前需核查。原生续接取决于目标 harness 版本。
- 不注入 Desktop、不嵌入原生子 agent 树、不自动唤醒入口。使用状态栏未读计数和 `wait/status/result` 获取持久结果；没有系统通知弹窗。
- API 仅监听 `127.0.0.1`，有 Bearer 认证和任务角色作用域。**这是协作控制，不是针对同一系统用户恶意代码的安全沙箱**；该用户可读取管理凭据。worktree 也不是 OS 沙箱。
- 不承诺任意 harness/模型组合兼容。能力接口的 `supported` 表示协议操作已有实现，不表示本机环境或真实模型已验证。

## 开发与证据

```sh
npm run check
npm run build
npm test
npm run ui:build
npm run ui:bundle
```

Node 22 的 `node:sqlite` 有实验性提示。测试使用自有 JSON-RPC/ACP 子进程 fixture 和临时 Git 仓库，不调用模型；一次性仓库保留在系统临时目录便于排错。

项目使用 [GitHub Spec Kit](https://github.com/github/spec-kit) 1.2.2 和 grilling 设计访谈：[项目原则](.specify/memory/constitution.md)、[功能规格](specs/001-cross-harness-team/spec.md)、[计划](specs/001-cross-harness-team/plan.md)、[任务](specs/001-cross-harness-team/tasks.md)、[验收记录](specs/001-cross-harness-team/verification.md)。新增[交付规格](specs/002-reviewable-delivery/spec.md)与[验证](specs/002-reviewable-delivery/verification.md)。托管模板保持原样。

架构依据见[参考源码评审](docs/reference-architecture-review.md)和[最小架构](docs/architecture-proposal.md)。UI 使用 ui-ux-pro-max 并适配 Apple 原生规范，见[设计系统](design-system/harnmux/MASTER.md)。[明暗预览](design-system/harnmux/previews/menu-bar-study.png)仅为静态示例，不是运行中应用截图。

原创实现使用 [MIT](LICENSE)，第三方保留原许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。尚未配置远程或发布。
