import csv
import io

HEADERS = ["Date", "Project", "Category", "Task", "Description", "Status", "Notes", "Blockers"]


def _rows(report: dict):
    for day in report["daily"]:
        for group in day["groups"]:
            for e in group["entries"]:
                yield [e["date"], e["project"] or "", e["category"] or "", e["task_title"], e["description"] or "",
                       e["status_label"], e["notes"] or "", e["blockers"] or ""]


def export_csv(report: dict) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(HEADERS)
    for row in _rows(report):
        w.writerow(row)
    # UTF-8 BOM so Excel opens non-ASCII text correctly.
    return ("﻿" + buf.getvalue()).encode("utf-8")
