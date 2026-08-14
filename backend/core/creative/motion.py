"""Motion inference: derive physical motion layers from the user's actual action.

The point is that motion must be SPECIFIC to what was asked. Applying "slow push-in" to
every clip is why generated video looks like an animated photograph — a rotating bottle
and a running woman need opposite camera work (orbit vs. tracking backward), and a generic
default gets both wrong.

Deterministic verb matching, not an LLM call. The analyzer already spends one model call
producing the CreativeSpec; if it fills the motion fields we keep them, and this module
only supplies what it left blank. Matching a verb to its physics is a lookup, not a
judgement, so it does not need a second round trip.
"""
from __future__ import annotations

import re
from typing import Optional

from .spec import CreativeSpec, VideoPlan

# action pattern -> (primary, camera, secondary, environment, intensity)
# Camera choice is physically motivated: a subject approaching needs the camera to retreat,
# a rotating object reads best on an orbit, a pour wants a push-in on the point of contact.
_MOTION_RULES: list[tuple[str, tuple[str, str, str, str, str]]] = [
    (r"\b(spin|spins|spinning|rotat\w*|turntable|360)\b", (
        "rotates continuously and evenly on its vertical axis",
        "orbits slowly around the subject, keeping it centred in frame",
        "highlights and reflections travel across the surface as it turns",
        "the backdrop stays fixed while shadows shift with the rotation",
        "medium")),
    (r"\b(run|runs|running|sprint\w*|jog\w*)\b", (
        "runs forward with a natural, continuous running gait",
        "tracks backward at matching speed, holding a constant distance",
        "hair and clothing lift and settle with each stride; arms swing naturally",
        "the background sweeps past continuously, giving a sense of real speed",
        "high")),
    (r"\b(walk|walks|walking|strid\w*|steps? toward)\b", (
        "walks forward taking natural, continuous steps",
        "tracks with the subject, holding steady framing",
        "clothing and hair sway gently with each step; arms move naturally",
        "the surroundings shift in perspective as the subject advances",
        "medium")),
    # pour\w* rather than pour|pours|pouring — the passive "being poured" is the most
    # common phrasing and the enumerated form missed it entirely.
    (r"\b(pour\w*|drip\w*|fill\w* the)\b", (
        "liquid pours in a continuous, unbroken stream into the vessel",
        "pushes in slowly toward the point where the liquid lands",
        "the surface level rises steadily; ripples and small splashes form",
        "steam or condensation drifts upward and disperses",
        "medium")),
    (r"\b(driv\w*|car\b|vehicle|motorbike|truck)\b", (
        "drives forward continuously along the road",
        "tracks alongside the vehicle, matching its speed",
        "the wheels rotate; the body settles slightly over the suspension",
        "roadside scenery streams past; reflections slide across the paintwork",
        "high")),
    (r"\b(open|opens|opening|unbox\w*|lid|door)\b", (
        "opens smoothly and completely, revealing what is inside",
        "pushes in gently toward the opening as it widens",
        "the moving part swings on a believable arc; light reaches inside",
        "shadows redraw as the opening grows",
        "medium")),
    (r"\b(pick\w* up|hold\w*|grab\w*|reach\w* for|hand\b)\b", (
        "a hand reaches in, grasps the product and lifts it",
        "follows the product upward, staying locked on it",
        "the fingers close naturally; the product tilts slightly in the grip",
        "the background falls further out of focus as the product nears the lens",
        "medium")),
    (r"\b(wave|waves|ocean|sea|water|river|splash\w*)\b", (
        "water moves continuously, swelling and breaking",
        "drifts slowly forward just above the surface",
        "foam travels along the crests; droplets scatter on impact",
        "light glitters and shifts across the moving surface",
        "high")),
    (r"\b(fly|flies|flying|drone|aerial|soar\w*)\b", (
        "moves continuously forward through open air",
        "flies forward, revealing more of the landscape as it advances",
        "nearer objects sweep past faster than distant ones, creating parallax",
        "clouds drift and light changes across the terrain",
        "high")),
    (r"\b(steam|smoke|sizzl\w*|hot\b|coffee|food|dish|burger|pizza)\b", (
        "steam rises continuously from the surface",
        "pushes in slowly toward the food",
        "wisps curl and dissipate; glaze and moisture catch the light",
        "the background stays soft while gentle air movement stirs the steam",
        "low")),
    (r"\b(model|wear\w*|clothing|dress|fashion|jacket|outfit)\b", (
        "moves naturally, shifting weight and turning slightly toward the camera",
        "tracks sideways around the subject",
        "fabric falls and swings with the body; hair moves with the turn",
        "the setting shifts in perspective as the camera travels",
        "medium")),
]

# Used only when nothing matches. Honest and minimal — it does NOT invent an action the
# user never asked for, it just asks for a live scene instead of a frozen one.
_FALLBACK = (
    "the subject holds its position while remaining visibly alive in frame",
    "drifts slowly forward toward the subject",
    "small natural movements keep the subject from appearing frozen",
    "ambient movement continues softly in the background",
    "low",
)

# Suffix-tolerant: users write "slowly" and "quickly" far more often than the bare
# adjective, and \bslow\b does not match "slowly".
_INTENSITY_WORDS = {
    "low": r"\b(subtle\w*|gentl\w*|slow\w*|calm\w*|minimal\w*|quiet\w*|still)\b",
    "high": r"\b(fast\w*|rapid\w*|energetic\w*|dynamic\w*|intense\w*|dramatic\w*|"
            r"action|quick\w*|explosive\w*)\b",
}


def infer_intensity(text: str, default: str) -> str:
    """Honour an explicit intensity cue in the user's own words."""
    blob = (text or "").lower()
    for level, pattern in _INTENSITY_WORDS.items():
        if re.search(pattern, blob):
            return level
    return default


def infer_motion(spec: CreativeSpec) -> VideoPlan:
    """Fill the motion layers from the action described in the spec.

    Anything the analyzer already decided is preserved — this only supplies blanks, so an
    LLM that understood the scene better than a regex always wins.
    """
    plan = spec.video or VideoPlan()
    source = " ".join(filter(None, [
        spec.original_prompt, spec.visual_concept, spec.subject, spec.product,
        plan.effective_primary(),
    ])).lower()

    primary, camera, secondary, environment, intensity = _FALLBACK
    for pattern, rule in _MOTION_RULES:
        if re.search(pattern, source):
            primary, camera, secondary, environment, intensity = rule
            break

    subject = (spec.subject or spec.product or "the subject").strip()
    plan.primary_motion = plan.effective_primary() or f"{subject} {primary}"
    plan.camera_motion = plan.camera_motion or f"the camera {camera}"
    plan.secondary_motion = plan.secondary_motion or secondary
    plan.environment_motion = plan.environment_motion or environment
    plan.motion_intensity = infer_intensity(spec.original_prompt, intensity)
    plan.subject_motion = plan.subject_motion or plan.primary_motion
    if not plan.timeline:
        plan.timeline = plan.build_timeline()
    return plan
