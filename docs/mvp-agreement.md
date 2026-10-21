# MVP 实现基线

## 用户体验

在 Codex 或 DSH 原生应用内，通过工具把任务交给另一个 harness 的原生 worker。worker 在独立 Git worktree 中执行，当前会话能查询进度、读取结果、追加要求与取消任务。macOS 状态栏显示任务状态和待处理事项。

交流入口、Leader 与 Worker 可分别指定。用户明确举例：在 DSH 中交流，选择 Codex 原生 harness 做 Leader，DSH 原生 harness 做 Worker。成员自己的 harness 负责模型循环与工具执行；入口不自动成为 Leader，也不由模型路由冒充 harness 切换。

Q9 已确认：可以新建 DSH worker，会复用已安装且在该运行模式中可用的原生插件配置；不要求复用正在交流的 DSH 会话。Q10 随后明确暂不逐项调查插件，插件兼容不作为 MVP 门槛；不承诺 Desktop 专属功能可在后台自动继承。

## 五项已确认决策

| 决策 | 首版行为 |
| --- | --- |
| Q1：worker 呈现 | 工具进度/结果 + 状态栏；原生会话跳转按能力提供 |
| Q2：目录与权限 | 独立 Git worktree，保留目标 harness 的审批边界 |
| Q3：模型路由 | 复用现有 router/harness 配置；每任务选择模型或使用默认值 |
| Q4：代码交付 | 保留修改、分支与验证结果；用户决定合入时机 |
| Q5：异步回报 | 持久保存结果、状态栏提醒；原生自动唤醒按能力标注 |

## 首版验收

1. 两家入口可使用相同的任务操作：创建、查询、读取结果、继续、取消。
2. 执行使用真实 harness 接口；模型选择不改写其他并行会话的全局配置。
3. Git 仓库的独立 worktree 与任务关联，worker 完成不自动合并或删除修改。
4. 需要审批时显示等待处理，用户可以允许或拒绝；不通过默认全权限绕过审批。
5. 任务状态、事件与结果写入本地存储；服务重启不会把未知任务报告为成功，也不会自动重复执行。
6. 状态栏可查看活动任务、结果与待处理事项；关闭展示不等于取消 worker。
7. 原生推送、会话跳转和模型能力按实际验证结果展示；没有能力时使用明确的查询与提醒路径。
8. 自动化测试与真实 harness/原生应用验收分别记录。缺少安装或账号的真实测试标记未验证，模拟结果不冒充真实结果。
9. 项目提供可复现安装与启动说明、Spec Kit 文档、能力矩阵和已知限制。
10. 依据一手源码评审参考工具；用第一性原理推导必要职责，新增架构层必须说明收益和更简单方案为何不足。核心不以厂商 Desktop 注入或默认全权限作为前提。
11. 使用 ui-ux-pro-max 与 Apple 官方设计原则制定原生状态栏 UI；明暗、键盘、VoiceOver、等待/失败状态纳入验收。静态预览不能代替交互或协议验收。
12. 以“DSH 入口→Codex Leader→新建 DSH Worker”为独立验收场景：入口、Leader、Worker 分别记录原生会话与配置，Codex 负责实际规划和派发，DSH worker 执行并回报；插件配置由 DSH 继续管理，具体插件测试按 Q10 延后。

## 本轮范围调整

用户在 Q6 选择“需要调整范围”，随后明确要求先评审 Harness Mix、CodexHost 等参考工具的缺陷与架构，遵循第一性原理、奥卡姆剃刀，并使用 UI 技能保证视觉质量。本稿保留 Q1–Q5 的已选决策，补充上述质量约束，并根据后续关于独立角色的解释、Q9/Q10 回答及 continue 指令进入实现。

- 事实评审：`docs/reference-architecture-review.md`。
- 最小架构：`docs/architecture-proposal.md`。
- 设计规范：`design-system/harness-bridge/MASTER.md`。
- 明暗静态预览：`design-system/harness-bridge/previews/menu-bar-study.png`；由 SwiftUI 渲染，使用示例数据，不代表运行中的产品。

## 首版范围外

- 其他操作系统、跨机器协作与云托管。
- 原生 Desktop 子 agent 会话树的完整嵌入。
- 自动合并、自动清理包含修改的 worktree。
- Magpie 安装、账号管理、provider 配置与订阅路由实现。
- 所有 harness 与所有模型组合的兼容承诺。

## 实现选择

由实现阶段根据已核实接口选择适配协议、进程结构和存储方式。优先复用公开原生接口；与特定版本绑定的能力应隔离、探测并报告。实现选择不得扩大上述产品范围。

## 实现状态

已按上述用户决策实施本地服务、CLI、Codex app-server 与 DSH/acpx 适配器，以及 SwiftUI 状态栏。功能规格与任务清单位于 `specs/001-cross-harness-team/`；真实模型与 Desktop 验证限制见该目录下 `verification.md`，不能以模拟测试代替。
