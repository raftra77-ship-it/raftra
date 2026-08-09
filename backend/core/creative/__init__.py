"""Creative Studio intelligence layer.

    analyzer.py    prompt (+reference image) -> CreativeSpec   [the only LLM call]
    spec.py        CreativeSpec — the structured source of truth
    platforms.py   platform -> aspect ratio / duration          [deterministic data]
    optimizer.py   CreativeSpec -> provider prompts             [deterministic assembly]
    service.py     orchestration + persistence

Generation itself stays in core/providers/, behind the existing ImageProvider and
VideoProvider ABCs, so swapping a provider never touches this package.
"""
