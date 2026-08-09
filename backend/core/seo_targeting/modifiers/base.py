"""Shared result types for modifiers."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class Occurrence(BaseModel):
    """One existing instance of a target property found in the source.

    More than one means the page has duplicates, which is a finding in its own right —
    inserting another would make it worse, so the planner turns that into CONSOLIDATE or
    sends it to review rather than writing.
    """

    start: int
    end: int
    value: Optional[str] = None   # the current content/attribute value
    raw: str = ""                 # the exact matched source text


class ModResult(BaseModel):
    ok: bool = False
    content: Optional[str] = None      # the modified source (None when nothing changed)
    changed: bool = False
    action: str = "noop"
    current_value: Optional[str] = None
    reason: str = ""                   # why it failed, or what was done
    occurrences: int = 0
    diff: Optional[str] = None
    candidates: list[str] = Field(default_factory=list)
