**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Writing Guidelines

**Be clear. Document intent, not the obvious.**

- Write all documentation, code comments, commits and docstrings in English.
- Add comments only when necessary to explain non-obvious logic, design decisions, or implementation details.
- Don't add comments that merely restate what the code already makes clear.
- Prefer self-explanatory code over excessive comments.

## 6. Meaningful Testing

**Test behavior, not implementation. Quality over quantity.**

- Derive tests from requirements, acceptance criteria, and expected behavior - not merely from existing implementation.
- Prioritize critical paths, business logic, edge cases, error handling, and regression scenarios.
- Every test must verify meaningful behavior and have a clear reason to exist. Avoid redundant tests and coverage padding.
- Test observable outcomes rather than internal implementation details. Prefer stable tests that survive refactoring.
- Ensure assertions actually detect incorrect behavior. A passing test alone doesn't prove correctness.
- Reuse existing fixtures, helpers, and testing conventions. Don't introduce unnecessary testing infrastructure.
- Don't add tests when existing coverage adequately protects the behavior.
- Never modify or weaken tests merely to make an incorrect implementation pass.

The goal is confidence in correctness, not maximum test count or coverage percentage.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
