"""Target-aware SEO auto-apply.

The existing pipeline (core/seo_fix_schema.py -> core/seo_adapters.py) answers only
"what should the new value be". It carries no notion of WHERE that value belongs, so each
adapter re-derived the target itself: GitHub fell back to `pages[0]`, and apply_to_html
appended raw <meta> tags to the bottom of any file with no </head> — including JSX.

This package adds the missing half. A ChangePlan names the page, the resource, the
mechanism that actually controls the tag, the current value and the exact action, and is
resolved BEFORE anything is modified. Ambiguity stops the apply instead of picking a file.

    resolver.py    WHERE   — issue + platform -> TargetLocation (or AMBIGUOUS)
    change_plan.py WHAT    — the structured instruction + its state machine
    modifiers/     HOW     — deterministic, idempotent edits per mechanism
    validator.py   SAFE?   — pre-publish structural checks; failure blocks the write
    verification.py DONE?  — re-fetch + re-crawl + re-run the check that raised the issue

Division of labour is deliberate (Step 10): the LLM only writes SEO copy and helps rank
ambiguous targets. Locating resources, parsing HTML, splicing, validating and verifying are
all deterministic code. Nothing here ever hands a whole file to a model.
"""
