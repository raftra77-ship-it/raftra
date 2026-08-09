"""Deterministic modifiers. Each one owns exactly one Mechanism.

Every modifier obeys the same contract:

    inspect(source, target_type)  -> list[Occurrence]        what is there NOW
    apply(source, plan)           -> ModResult               the minimal edit

They splice at offsets computed against the source they were handed, rather than
re-serialising a parse tree, so everything outside the touched span survives byte-for-byte
(the rule core/wp_content_editor.py already established for post content). A modifier that
cannot locate its target returns ok=False — it never falls back to appending.
"""
from __future__ import annotations

from .base import ModResult, Occurrence

__all__ = ["ModResult", "Occurrence"]
