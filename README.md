# Harnmux

在当前 Codex / DSH 入口里，选择另一个原生 harness 当负责人，按需委派成员，一起聊天、研究、写作或编程。macOS 状态栏负责进展、审批和交付，无需另开聊天 GUI。

提供 **Codex + DSH 原生协议适配器**、本地服务、CLI/Skill 和 SwiftUI 状态栏。普通聊天无需 Git；代码任务保留独立 worktree。受控测试覆盖协议、上下文交接和持久回报；真实模型团队执行与原生 UI 交互仍待验证，见[当前验收记录](specs/003-general-collaboration/verification.md)。DSH 已在本机发现安装，尚未执行真实模型任务。

## 与现有工具的区别

Harnmux 的定位是：**从现有 harness 发起跨 harness 团队任务，显式交接上下文，按任务类型保留目录或隔离修改，可靠回报，并把 Leader 建议与用户验收分开记录。** 首版集中兑现这个流程。

| 项目 | 已有优势 | Harnmux 的选择与代价 |
| --- | --- | --- |
| CodexHost | 原生委派、会话投影与结果订阅回报 | 借鉴“回报不等于已接收”，将回报和接收回合持久化；不提供 Desktop 会话投影 |
| Harness Mix | 多 harness、持久团队/mailbox、Git 快照、digest review/apply 与验证门禁 | 借鉴私有 index 快照和忙闲调度，采用更小的任务 API；尚缺其广泛适配与验证门禁 |
| [0xSero/harness-bridge](https://github.com/0xSero/harness-bridge)（Local AI） | 模型连接、原生 harness 启动和薄 UI | 借鉴共享核心与原生状态栏；Harnmux 增加团队任务、交接、审批和回报，复用外部模型路由 |
| Codex Mixin | Codex 模型网关 | 属于不同层次，Harnmux 不承担模型协议转换 |

worktree、摘要、回合证据和状态栏都已有先例，不能宣称首创。新增的固定交付快照与双层审查补齐本项目自身缺口；这是可测试的产品契约，尚不能证明市场上独有。[本轮吸收与边界](docs/general-collaboration-2026-10-22.md)同时记录竞品的优势、默认配置取舍和我们的未验证项。

## 角色如何衔接

```text
DSH Desktop / CLI（交流入口）
  └─ Harnmux Skill / CLI → 本地任务服务
       └─ Codex app-server（Leader，原生 Codex 循环）
            └─ Harnmux dispatch → DSH ACP / acpx（Worker，原生 DSH 循环）

SwiftUI 状态栏 ← 同一个本地任务服务 → SQLite + 会话目录 / Git worktree
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

聊天、讨论与研究不需要仓库。例如，DSH 入口委派 Codex 汇总、DSH 参与研究：

```sh
node /absolute/path/to/harnmux/dist/cli.js run \
  --entry dsh --leader codex --workers dsh \
  --request-id discussion-001 --duty planner \
  --context '希望先比较取舍，再给出实际可行的建议。' \
  --task '比较两个旅行方案；需要时让 DSH 补充不同意见，然后给我建议。'
```

负责人按需组队，简单问题可以直接回答。`--duty planner|reviewer|researcher` 等是职责描述，权限仍取决于 Leader/Worker，不增加额外层级。CLI 和面板新任务默认启用成员回报；`--manual-results` 选择手动查询。

代码任务显式提供 `--repo`；仓库至少有一个提交。下列命令启动真实 harness，可能消耗模型额度：

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

Leader 只能对自己的 Worker 记录 `recommend_accept` / `request_changes`；用户单独决定 `accept`。续跑保留历史快照和意见，清除当前验收；旧 turn/digest、执行中、失败或不完整交付不能用于验收。聊天需要非空且未截断的回答，无需差异。父交付引用成员快照；未完成、未封存或已更新版本的成员阻止旧汇总验收。`ack` 仅表示已读。验收针对封存内容，不会合并代码，也不包含之后的工作区修改。旧任务若没有交付包，继续可查询而不会伪造证据。

原生面板可查看标准、分别显示 Leader/用户意见，复制交付包，并填写意见确认回答、验收代码或要求修改。

## 上下文、代码与回报如何交接

`--context` 是明确提供的共享背景，自动传给本任务的成员；不会读取入口的完整聊天历史。`--input TASK_ID:TURN:DIGEST` 可重复，用来选择精确版本的回答。交付内容、来源与截断情况写入下一任务的契约，之后的修改不会改变它。总输入报告上限 262,144 字符、最多 12 份，超限会明确失败。

Leader 在编码任务中可以指定代码来源：

```sh
harnmux packet MEMBER_A_ID
harnmux dispatch --profile dsh --duty reviewer --request-id review-001 \
  --input MEMBER_A_ID:1:SHA256_FROM_PACKET \
  --code-from MEMBER_A_ID:1:SHA256_FROM_PACKET \
  --task '审查这份代码并报告问题'
```

`codeFrom` 引用固定的 Git commit；差异也从同一树生成。私有 index 收集已跟踪及未忽略的新文件，不改动源 index、工作文件或当前分支。忽略文件、外部目录与子模块工作内容不会复制，Git 子模块仍是指针；快照不等于完整开发环境。Git 自身的 clean filters 仍按仓库配置执行。快照在 `refs/harnmux/deliveries/…` 保持可达，不自动清理。已有交付验收并不等于已合并。

成员封存和待回报记录写入同一 SQLite 事务。Leader 忙碌时先保存；它空闲且启用自动回报时，在**同一个 Harnmux 管理的原生会话**启动汇总回合。回报状态是待接收 → 发送中 → 原生已接收，或接收不确定。Leader 已主动读过成员 packet，则标记已查阅，不另起重复回合。

取消、失败或中断的 Leader 不会被自动复活；取消已结束的 Leader 也会停止仍运行的成员。崩溃时尚未确认原生接收的回报改为 unknown，不自动重发。检查会话后可显式选择交付引用来继续。这不意味着任意 Desktop 入口自动收到新消息；入口仍用状态栏或 `wait/status` 查询。面板同时提供简洁发起表单、当前阻塞原因和回报记录，不替代原生聊天界面。

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

- 聊天使用私有、保留的目录，不要求 Git。代码成员从明确提交创建独立分支和 worktree，默认基线 `HEAD`，可用 `--base REF` 更换。入口脏文件不会自动进入成员；选择 `--code-from` 可显式复用此前封存的代码。
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

Node 22 的 `node:sqlite` 有实验性提示。测试使用自有 JSON-RPC/ACP 子进程 fixture、无 Git 临时目录和临时 Git 仓库，不调用模型；一次性仓库保留在系统临时目录便于排错。

项目使用 [GitHub Spec Kit](https://github.com/github/spec-kit) 1.2.2 和 grilling 设计访谈：[项目原则](.specify/memory/constitution.md)、[功能规格](specs/001-cross-harness-team/spec.md)、[计划](specs/001-cross-harness-team/plan.md)、[任务](specs/001-cross-harness-team/tasks.md)、[验收记录](specs/001-cross-harness-team/verification.md)。新增[交付规格](specs/002-reviewable-delivery/spec.md)与[通用协作规格](specs/003-general-collaboration/spec.md)、[当前验证](specs/003-general-collaboration/verification.md)。托管模板保持原样。

架构依据见[参考源码评审](docs/reference-architecture-review.md)和[最小架构](docs/architecture-proposal.md)。UI 使用 ui-ux-pro-max 并适配 Apple 原生规范，见[设计系统](design-system/harnmux/MASTER.md)。[明暗预览](design-system/harnmux/previews/menu-bar-study.png)仅为静态示例，不是运行中应用截图。

原创实现使用 [MIT](LICENSE)，第三方保留原许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。尚未配置远程或发布。
