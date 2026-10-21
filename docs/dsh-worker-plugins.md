# DSH worker 插件复用调查

日期：2026-10-21。公开源码快照 `687f282e8625c6b8d11ff58211a90524be2e4317`；不是已发布包或用户当前安装的验证结论。未读取用户配置/凭据，未运行模型任务。

结论：ACP worker 可以使用 DSH 原生插件机制、磁盘 skills 和 MCP，但不会自动继承 Desktop profile 的全部插件配置。本调查发生于 Q10 答复之前。用户随后要求暂不逐项调查插件，具体插件兼容不作为 MVP 门槛。Bridge 保持原生配置归 DSH 管理；不承诺自动保留全部 Desktop 插件。

| 项目 | 源码事实 | 对 worker 的含义 |
| --- | --- | --- |
| Profile | ACP 模板为 dsh-base + dsh-acp-app；Desktop/Web 为不同 profile；启动组合 bundles、profile patch 与 home patch | 需明确 worker profile，核查插件启用和版本 |
| Skills | base 挂载 registry、filesystem provider 和 skill tool；扫描项目 .dsh/skills、.agents/skills、用户目录与自定义目录 | 新 worktree 中需实际存在项目 skills；相同 home 下的用户 skills 仍应验证 |
| MCP | session/new 可附加 stdio/HTTP MCP；通用 MCP client 无默认 server | 不能把 Desktop 的 MCP 配置视为已自动继承 |
| UI 能力 | ACP 不暴露 Desktop 专属 plans、terminals、presentation、elicitation 等协议入口 | UI 依赖插件不能承诺在 ACP 中完整可用 |
| 权限 | base 默认 workspace-write + ask，可由配置覆盖 | 仍需验证启动后的实际权限，不能仅信默认模板 |

用户 Q9 已接受新建 DSH worker，要求保留可用插件。Q10 已明确专项验证延后，不继续索要插件名单，也不为适配而改写全局配置。

## 固定证据

- [ACP profile 模板](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/boot/app-boot/src/profile.ts#L180-L194)
- [启动组合与 home patch](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/apps/cli/src/profile-boot.ts#L67-L74)
- [默认 skill 挂载](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/bundle/base/cordis.patch.yml#L308-L315)
- [skills 扫描目录](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/skill/skill-filesystem/README.md#L44-L75)
- [ACP MCP 与不支持的入口](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/acp/acp/README.md#L64-L80)
- [CLI/profile 与 Desktop 边界](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/apps/cli/README.md#L6-L24)
- [base 权限默认](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/bundle/base/cordis.patch.yml#L239-L262)
