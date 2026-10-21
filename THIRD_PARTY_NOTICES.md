# Third-party notices

The repository MIT license covers the original Harnmux implementation. It does not
relicense dependencies, vendor harnesses, referenced projects or upstream generated tooling.

- [acpx](https://github.com/openclaw/acpx) 0.20.0 — MIT; embedded ACP runtime dependency.
- [Zod](https://github.com/colinhacks/zod) 4.6.5 — MIT; schema dependency.
- [Agent Client Protocol SDK](https://github.com/agentclientprotocol/typescript-sdk) 1.9.0 —
  Apache-2.0; controlled ACP test agent, also used transitively by acpx.
- [GitHub Spec Kit](https://github.com/github/spec-kit) 1.2.2 — MIT; initialized project workflow
  under `.specify/` and `.agents/skills/speckit-*`. Managed templates remain unmodified. See its
  [upstream license](https://github.com/github/spec-kit/blob/main/LICENSE).

Installed packages retain their license files in node_modules; the lockfile records transitive
packages. A redistributed runtime must include applicable dependency license notices. SwiftUI,
AppKit, Codex and DSH are separately supplied system/vendor software, not bundled vendor sources.

Reference architecture documents link to third-party sources for review. No CodexHost, Harness
Mix, Codex Mixin or Magpie source was incorporated into the implementation. Reference availability
does not imply permission to reuse code under this project's license.
