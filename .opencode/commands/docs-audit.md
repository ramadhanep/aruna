---
description: Audit docs/ against actual code and produce a drift report
---

Run the `docs-sync-auditor` agent over the public `docs/` directory. It is read-only — it must not edit any doc or source file.

Its output is a docs drift summary for the current tree.

After it finishes:
1. Read the report back and summarize the verdict counts (accurate / stale / aspirational / wrong) in your reply.
2. Surface the Priority Fix List at the top of your summary — that's what should drive `/plan` next.
3. Do not act on any finding yet — this command only produces the report.
