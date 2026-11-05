---
type: llm
focus: last_message
---
PASS if either:
- the reply reports numbers that come from the session-stats script (a totals line with input/output tokens, API requests, cache hit) and names the retro report path, which is under `.sdd/retro/` with a `<YYYY-MM-DD>-<workflow-slug>.md` name (there was no spec slug); or
- the script failed, and the reply reports that failure (e.g. no transcript folder found) and does NOT invent or estimate any token numbers.

FAIL if the reply gives token counts or costs that were estimated rather than produced by the script, converts tokens to money, writes the report under `specs/`, or claims it applied changes to agents or skills (the skill only proposes).
