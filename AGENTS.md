# Working on Harness Bridge

When changing behavior, read `.specify/memory/constitution.md` and the affected requirements in
`specs/001-cross-harness-team/spec.md`. Consult `plan.md`, `data-model.md` and `contracts/api.md`
in that feature directory when changing service state, adapter lifecycle or the public API.
Track work in `tasks.md`; keep `verification.md` honest about controlled versus real checks.

Preserve independent Entry/Leader/Worker identities, committed-baseline worktrees and native
approval decisions. Retain work for review. Worker credentials cannot dispatch or approve.
Keep task secrets out of results and logs; role scoping is not an OS security boundary.

Use protocol fixtures and disposable repositories for routine validation. Real model tasks need
a deliberate verification step because they use native accounts and may consume quota. Existing
global harness/router/plugin settings remain user-owned. Plugin-specific work is deferred.

For UI changes, consult `design-system/harness-bridge/MASTER.md`; static rendering does not prove
native interaction or accessibility. Keep the service independent of UI lifetime. Build and
run the relevant checks from package.json, then record any environment-blocked real verification.

Keep managed Spec Kit templates and workflow skills unchanged. Favor one service, one task API
and small native adapters; justify additional infrastructure against a simpler alternative.
