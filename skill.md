# Skills: Tool Invocation & Token Discipline

This file defines strict rules for tool usage to minimize token consumption
while allowing intelligent escalation for complex or repeated issues.

These rules must be followed at all times unless explicitly overridden below.

---

## 1. Global Principles

- Tools are expensive. Do NOT use them unless they add real value.
- Never explain why a tool is chosen.
- Never justify tool invocation in natural language.
- Invoke tools silently and directly.
- Prefer reasoning without tools for simple or one-off problems.
- Do not restate tool descriptions or capabilities.
- Do not repeat large outputs unless explicitly requested.

---

## 2. Default Behavior (Token-Saving Mode)

By default, operate in **minimal tool usage mode**:

- Assume the user prefers reasoning and concise answers.
- Avoid exploratory or speculative tool usage.
- Avoid repeated tool calls for the same information.
- Avoid fetching large contexts "just in case".

Only escalate when clear signals are present (see Section 5).

---

## 3. Context7 MCP Rules

### When Context7 MAY be used
Use Context7 ONLY when:
- The issue depends on prior architectural decisions
- Project-specific conventions or patterns are unclear
- A past design choice may explain current behavior
- The user explicitly asks to recall prior context
- A problem persists across multiple attempts or files

### When Context7 MUST NOT be used
Do NOT use Context7 for:
- General programming knowledge
- First-time errors or simple bugs
- Explanations that do not require project memory
- Broad exploration without a clear goal

### Output Constraints (VERY IMPORTANT)
- Return only:
  - Identifiers
  - File names
  - High-level summaries
- Limit summaries to **3–5 concise lines**
- Never return full documents, large excerpts, or raw history
- Never dump stored context unless explicitly asked

---

## 4. Playwright MCP Rules (Default)

### When Playwright MAY be used
Use Playwright ONLY when:
- Browser behavior cannot be reasoned about statically
- UI behavior differs from expected logic
- The issue involves:
  - Rendering
  - Navigation
  - User interaction
  - State visible only in the browser
- The user explicitly asks for browser testing or automation

### When Playwright MUST NOT be used
Do NOT use Playwright for:
- Code review
- Logical flow analysis
- API or backend-only issues
- Hypothetical UI problems without evidence

### Execution Rules
- Do not describe browser actions.
- Do not narrate steps.
- Do not dump DOM trees or screenshots by default.

### Output Constraints
After execution:
- Summarize results in **≤ 5 short bullet points**
- Include only observations relevant to the issue
- Discard DOM, traces, and screenshots unless requested

---

## 4.1 UI-UX Reviewer Override (IMPORTANT)

When the **UI-UX Reviewer subagent** is explicitly invoked:

- All Playwright limitations defined in Section 4 are lifted
- Playwright may be used freely to:
  - Inspect UI layout and visual hierarchy
  - Validate component behavior and interactions
  - Check responsiveness, accessibility, and UX flows
  - Observe real user-facing behavior across states

### Override Rules
- Playwright may perform deeper inspection when required
- DOM, screenshots, or interaction traces may be used if they help UX analysis
- Outputs should still be summarized when possible
- Do not retain large artifacts longer than necessary

This override applies **only** while the UI-UX Reviewer subagent is active.
Once the review is complete, revert immediately to default Playwright rules.

---

## 5. Smart Escalation Mode (IMPORTANT)

If ANY of the following are true, escalation is allowed:

- The same or similar issue persists after multiple attempts
- The problem spans multiple files or subsystems
- The user explicitly says:
  - "I'm stuck"
  - "This keeps happening"
  - "Find the root cause"
  - "This is a complex issue"
- Symptoms contradict expected architecture or logic
- A surface fix failed or caused regressions

### In Escalation Mode:
- Tools may be used more freely
- Context7 may be used to trace historical decisions
- Playwright may be used to validate real behavior
- Multiple tool calls are allowed if they reduce uncertainty

Even in escalation mode:
- Avoid unnecessary repetition
- Keep outputs concise
- Stop once the root cause is identified

---

## 6. Failure & Safety Rules

- If unsure whether a tool is needed, ask the user first.
- If tool output is large, summarize instead of repeating it.
- Never enter infinite investigation loops.
- Prefer clarity and correctness over completeness.

---

## 7. Priority Order

When solving problems, prioritize in this order:
1. Reasoning without tools
2. Context7 (architectural understanding)
3. Playwright (runtime verification)

Do not skip steps unless explicitly overridden by the UI-UX Reviewer clause.
