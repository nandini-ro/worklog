"""Deterministic, offline fallbacks so AI features work without any API key."""
import re

ACRONYMS = {
    "api": "API", "apis": "APIs", "ui": "UI", "ux": "UX", "db": "database", "sql": "SQL", "mcp": "MCP",
    "llm": "LLM", "llms": "LLMs", "ai": "AI", "ci": "CI", "cd": "CD", "jwt": "JWT", "json": "JSON",
    "http": "HTTP", "https": "HTTPS", "url": "URL", "sdk": "SDK", "aws": "AWS", "gcp": "GCP", "pr": "PR",
    "prs": "PRs", "qa": "QA", "e2e": "end-to-end", "fe": "frontend", "be": "backend", "env": "environment",
    "config": "configuration", "configs": "configurations", "auth": "authentication", "repo": "repository",
    "docs": "documentation", "k8s": "Kubernetes", "css": "CSS", "html": "HTML", "rest": "REST",
}

VERB_UPGRADES = {
    "fixed": "Resolved", "fix": "Resolved", "did": "Completed", "made": "Implemented", "make": "Implemented",
    "added": "Added", "add": "Added", "tested": "Tested", "test": "Tested", "checked": "Reviewed",
    "check": "Reviewed", "looked": "Investigated", "worked": "Worked", "updated": "Updated", "update": "Updated",
    "wrote": "Wrote", "write": "Wrote", "setup": "Set up", "set": "Set", "changed": "Updated",
}


def local_improve(text: str) -> str:
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return text
    sentences = re.split(r"(?<=[.!?])\s+|\s*;\s*|\s*\n\s*", text)
    out = []
    for s in sentences:
        words = s.strip().rstrip(".!?").split(" ")
        if not words or not words[0]:
            continue
        fixed = []
        for i, w in enumerate(words):
            m = re.match(r"^([A-Za-z0-9]+)(\W*)$", w)
            core, tail = (m.group(1), m.group(2)) if m else (w, "")
            low = core.lower()
            if i == 0 and low in VERB_UPGRADES:
                core = VERB_UPGRADES[low]
            elif low in ACRONYMS:
                core = ACRONYMS[low]
            fixed.append(core + tail)
        sentence = " ".join(fixed)
        sentence = sentence[0].upper() + sentence[1:]
        sentence = re.sub(r"\bi\b", "I", sentence)
        out.append(sentence + ".")
    return " ".join(out)


def _join(items: list[str]) -> str:
    items = [i for i in items if i]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " and " + items[-1]


def local_report_summary(report: dict) -> str:
    totals = report["totals"]
    period = report["period"]["label"]
    if totals["entries"] == 0:
        return f"No work was recorded for {period}."

    projects = [p for p in report["project_summary"]]
    projects.sort(key=lambda p: p["total"], reverse=True)
    top_projects = [p["project"] for p in projects[:3]]
    cats = [c["category"].lower() for c in report["category_summary"][:2] if c["category"] != "Uncategorised"]

    parts = []
    focus = f"During {period}, work focused primarily on "
    focus += f"{_join(cats)} across " if cats else ""
    focus += _join(top_projects)
    if len(projects) > 3:
        focus += f", along with {len(projects) - 3} other project{'s' if len(projects) - 3 > 1 else ''}"
    parts.append(focus + ".")

    highlights = [e["task_title"] for e in report["completed"][:4]]
    if highlights:
        parts.append(f"Key completed work included {_join(highlights)}.")

    status_bits = [f"{totals['completed']} completed"]
    if totals["in_progress"]:
        status_bits.append(f"{totals['in_progress']} in progress")
    if totals["planned"]:
        status_bits.append(f"{totals['planned']} planned")
    if totals["blocked"]:
        status_bits.append(f"{totals['blocked']} blocked")
    parts.append(
        f"In total, {totals['entries']} work item{'s were' if totals['entries'] != 1 else ' was'} recorded "
        f"over {totals['active_days']} working day{'s' if totals['active_days'] != 1 else ''} ({_join(status_bits)})."
    )

    ongoing = [e["task_title"] for e in report["in_progress"][:3]]
    if ongoing:
        parts.append(f"Ongoing work includes {_join(ongoing)}.")
    if report["blockers"]:
        n = len(report["blockers"])
        parts.append(f"{n} item{'s' if n != 1 else ''} recorded blockers that may need attention.")
    return " ".join(parts)
