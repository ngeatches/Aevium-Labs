# Skills and workflow map

This file maps tools and skills to the work. It does not install skills or define a new custom skill.

## October 6 design resources

Reviewed October 12, 2026 at the user's request. The local bundle is [`SKILLS REPO 10.6`](</Users/zckrylogan/Desktop/SKILLS REPO 10.6>); four prepared skills also exist in `/Users/zckrylogan/.claude/skills/`. These resources were missing from this project's earlier workflow map. They are readable local resources; their presence in Claude's directory does not mean they are registered in Codex's skill catalog.

For visual revisions, begin with `DESIGN.md` and select the relevant resource below. Read the selected skill before applying it. Preserve the user's original-copy and approved-photo constraints even when a generic design skill suggests rewriting text or generating new images.

| Resource | Role and status |
| --- | --- |
| [Taste Skill: Minimalist UI](</Users/zckrylogan/Desktop/SKILLS REPO 10.6/taste-skill/skills/minimalist-skill/SKILL.md>) | Read and used for the current restrained palette, flat surfaces, spacing and motion review. The user's bold sans-serif preference overrides its serif/texture suggestions. |
| [Taste Skill: Redesign Existing Projects](</Users/zckrylogan/Desktop/SKILLS REPO 10.6/taste-skill/skills/redesign-skill/SKILL.md>) | Read and used for targeted refinements in the existing vanilla stack, consistent numeric typography and interaction review. |
| [Web Design Guidelines](/Users/zckrylogan/.claude/skills/web-design-guidelines/SKILL.md) | Read; current [upstream checklist](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) retrieved October 12. Use for focus, semantics, motion, overflow, image-loading and typography review. |
| [Design Taste Frontend](/Users/zckrylogan/.claude/skills/design-taste-frontend/SKILL.md) | Available for broader frontend direction; read the full applicable instructions before invoking. Not required for every small polish pass. |
| [Image to Code](/Users/zckrylogan/.claude/skills/image-to-code/SKILL.md) | Available for new image-led concepts when requested. Do not use it to replace the approved product photography. |
| [Awesome DESIGN.md](</Users/zckrylogan/Desktop/SKILLS REPO 10.6/awesome-design-md/README.md>) | Reference collection, not a skill. Reviewed [Apple](</Users/zckrylogan/Desktop/SKILLS REPO 10.6/awesome-design-md/design-md/apple/DESIGN.md>) and [Nike](</Users/zckrylogan/Desktop/SKILLS REPO 10.6/awesome-design-md/design-md/nike/DESIGN.md>) for spacing, typography hierarchy and product-image emphasis. Adapt principles; do not copy a brand system wholesale. |
| [Vercel Agent Skills](</Users/zckrylogan/Desktop/SKILLS REPO 10.6/vercel-agent-skills>) | Local reference snapshot; use framework-specific material only if that framework is actually part of the project. No React migration is planned. |
| [Playwright CLI skill](/Users/zckrylogan/.claude/skills/playwright-cli/SKILL.md) | Available resource, not used in this pass. Browser verification in this Codex session uses its provided CUA browser tools. |

Snapshot provenance from the bundle's `VERSIONS.txt`:

| Repository | Recorded commit |
| --- | --- |
| `Leonxlnx/taste-skill` | `e3c92037548e3e49bea8e6b906c99a8549654e71` |
| `vercel-labs/agent-skills` | `063bee94c3f4df8453406c830b0a7df0f2860278` |
| `VoltAgent/awesome-design-md` | `13be5c05c63be24b57581162364167028020f043` |
| `microsoft/playwright-cli` | `b85c7a736bb473bf55b584e54a09ffa698d6d871` |

Plugin Management was used to inspect relevant integrations on October 12. Canva is installed and is an option for a requested design board or editable client handoff. It is not needed to edit this local website, and no client assets were uploaded. Existing image-generation and research capabilities remain available when those tasks are in scope. Do not install plugins or move the website to a hosted builder merely to use a tool.

## Primary workflows

| Work | Skill or capability | Application |
| --- | --- | --- |
| Project instructions | `openai-docs` | Used to check the distinction between project guidance and reusable skills. Keep persistent rules in `AGENTS.md`. |
| New hero/product/support images | `imagegen` | Use the built-in image tool for actual image production; inspect local input images before editing. Save selected project assets into the workspace. Used to generate the completed 19-product image family. |
| Layout and implementation | Minimalist UI, Redesign Existing Projects, native HTML/CSS/JavaScript | Apply the resource map above and the current `DESIGN.md`; edit locally without adding a framework. |
| Interface review | Web Design Guidelines | Read its live checklist, then verify relevant typography, accessibility and interaction details against the actual page. |
| Visual review | Browser/computer-use tools | Inspect mobile/desktop layouts, navigation, focus, image crops, and password behavior. |

## Conditional workflows

| Skill | When it would help |
| --- | --- |
| `solo-brand-studio` | If the client expands the work into brand strategy or a new identity. A site refresh alone does not require the full branding process. |
| `app-6a314a73f8ac819195b0d55e36b9c609:firecrawl` | If reference research expands to multiple pages or structured content collection. The initial reference was inspected with web and browser tools. |
| `pdf:pdf` | If the client supplies actual COA PDFs that must be inspected or linked. It is not a reason to generate replacement certificates. |
| `vercel:verification` | When starting a development server or diagnosing a broken site flow, where its verification workflow applies. |
| `vercel:deployments-cicd`, `vercel:vercel-cli`, `vercel:env-vars` | If Vercel is chosen for hosting. Check current password-protection availability and plan requirements at that time. |
| `skill-creator` | If a repeatable workflow emerges that deserves a reusable skill. The current one-off plan belongs in project docs. |

The October 12 order-demo expansion used `vercel:create-a-backend` to review the smallest backend that fits the existing project, and `vercel:verification` for the browser → API → private data → admin → customer story. The implementation stays local on Node with built-in SQLite; no Vercel or Supabase services were created. The customer-phone/order/email expansion reused those backend and verification skills. It adds versioned policies and a transactional local email outbox without connecting live providers. Production SMS/email, React, video and hosted builders remain outside this demo.

## Relevant installed skill files

- [OpenAI Docs](/Users/zckrylogan/.codex/skills/.system/openai-docs/SKILL.md)
- [Image generation](/Users/zckrylogan/.codex/skills/.system/imagegen/SKILL.md)
- [Solo Brand Studio](/Users/zckrylogan/.codex/skills/solo-brand-studio/SKILL.md)
- [Skill Creator](/Users/zckrylogan/.codex/skills/.system/skill-creator/SKILL.md)

These are machine-local paths. Rediscover installed skills if working on another machine; do not copy entire skill packages into this project.

## Documentation roles

`README.md` is the human entry point. `AGENTS.md` contains short project-specific working rules. `PROJECT_PROMPT.md` captures the requested outcome. `DESIGN.md` records the current visual system and intentional adaptations of external guidance. The files in `docs/` hold detailed implementation decisions and verification history. A reusable skill has its own `SKILL.md`; an ordinary file named `SKILLS.md` is only this project's index. See the official [project instruction guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md) and [skills guide](https://learn.chatgpt.com/docs/build-skills).
