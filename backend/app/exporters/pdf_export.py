import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (KeepTogether, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

INDIGO = colors.HexColor("#4F46E5")
SLATE = colors.HexColor("#334155")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#E2E8F0")
STATUS_COLORS = {
    "completed": "#059669",
    "in_progress": "#2563EB",
    "planned": "#64748B",
    "blocked": "#DC2626",
}


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=base["Title"], fontSize=22, textColor=colors.white, alignment=TA_LEFT,
                                spaceAfter=2, leading=26),
        "sub": ParagraphStyle("s", parent=base["Normal"], fontSize=10, textColor=colors.HexColor("#E0E7FF"), leading=14),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontSize=13, textColor=INDIGO, spaceBefore=14,
                             spaceAfter=6, leading=16, keepWithNext=True),
        "h3": ParagraphStyle("h3", parent=base["Heading3"], fontSize=11, textColor=SLATE, spaceBefore=8,
                             spaceAfter=3, leading=14, keepWithNext=True),
        "h4": ParagraphStyle("h4", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=10, textColor=SLATE,
                             spaceBefore=4, spaceAfter=2, leftIndent=6, keepWithNext=True),
        "body": ParagraphStyle("b", parent=base["Normal"], fontSize=10, leading=14.5, textColor=colors.HexColor("#1E293B")),
        "small": ParagraphStyle("sm", parent=base["Normal"], fontSize=8.5, leading=12, textColor=MUTED),
        "cell": ParagraphStyle("c", parent=base["Normal"], fontSize=9, leading=12),
    }


def _p(text: str | None, style) -> Paragraph:
    return Paragraph(escape(text or "").replace("\n", "<br/>"), style)


def _status(e: dict) -> str:
    return f'<font color="{STATUS_COLORS[e["status"]]}"><b>[{escape(e["status_label"])}]</b></font>'


def _bullets(items: list[Paragraph], indent: int = 14) -> ListFlowable:
    return ListFlowable(
        [ListItem(i, leftIndent=indent, value="•") for i in items],
        bulletType="bullet", start="•", leftIndent=indent, bulletFontSize=8, bulletColor=MUTED,
    )


def _entry_line(e: dict, st, with_project: bool = False, with_date: bool = False, show_status: bool = True) -> Paragraph:
    head = []
    if with_date:
        head.append(f'<font color="#64748B">{escape(e["date_label"])}</font>')
    if with_project:
        head.append(f"<b>{escape(e['project'] or 'General')}</b>")
    prefix = " · ".join(head)
    text = f"{prefix} — " if prefix else ""
    text += f"<b>{escape(e['task_title'])}</b>"
    if e["description"]:
        text += f": {escape(e['description'])}"
    if show_status:
        text += f"  {_status(e)}"
    if e.get("notes"):
        text += f'<br/><font color="#64748B" size="8.5">Notes: {escape(e["notes"])}</font>'
    return Paragraph(text, st["body"])


def export_pdf(report: dict) -> bytes:
    st = _styles()
    buf = io.BytesIO()

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 10 * mm, f"{report['user']['name']} · Work Report · {report['period']['label']}")
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                            bottomMargin=18 * mm, title=f"Work Report — {report['period']['label']}",
                            author=report["user"]["name"])
    story = []

    # Header band
    filt = [f"{k.title()}: {v}" for k, v in report["filters"].items() if v]
    header_rows = [
        [Paragraph("WORK REPORT", st["title"])],
        [Paragraph(f"<b>{escape(report['user']['name'])}</b>", st["sub"])],
        [Paragraph(f"Period: {escape(report['period']['label'])} &nbsp;&nbsp;|&nbsp;&nbsp; "
                   f"Generated: {escape(report['generated_label'])}", st["sub"])],
    ]
    if filt:
        header_rows.append([Paragraph("Filters: " + escape(", ".join(filt)), st["sub"])])
    band = Table(header_rows, colWidths=[doc.width])
    band.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INDIGO),
        ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, 0), 14), ("BOTTOMPADDING", (0, -1), (-1, -1), 14),
    ]))
    story += [band, Spacer(1, 10)]

    # Key figures (counts of work items — never time)
    t = report["totals"]
    figs = [("Work items", t["entries"]), ("Completed", t["completed"]), ("In progress", t["in_progress"]),
            ("Blocked", t["blocked"]), ("Projects", t["projects"])]
    cells = [[Paragraph(f'<font size="16"><b>{v}</b></font><br/><font color="#64748B" size="8">{k}</font>', st["body"])
              for k, v in figs]]
    kt = Table(cells, colWidths=[doc.width / len(figs)] * len(figs))
    kt.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(kt)

    story += [Paragraph("Summary", st["h2"]), _p(report["summary"], st["body"])]

    if not report["daily"]:
        story += [Spacer(1, 8), Paragraph("No work entries were recorded for this period.", st["body"])]
        doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
        return buf.getvalue()

    story.append(Paragraph("Daily Work", st["h2"]))
    for day in report["daily"]:
        block = [Paragraph(escape(day["date_label"]), st["h3"])]
        for g in day["groups"]:
            block.append(Paragraph(escape(g["project"]), st["h4"]))
            block.append(_bullets([_entry_line(e, st) for e in g["entries"]]))
        # Keep short days on one page; let long days flow across pages.
        if sum(len(g["entries"]) for g in day["groups"]) < 8:
            story.append(KeepTogether(block))
        else:
            story.extend(block)

    story.append(Paragraph("Project Breakdown", st["h2"]))
    rows = [[Paragraph(f"<b>{h}</b>", st["cell"]) for h in ("Project", "Items", "Done", "In Prog.", "Blocked", "Work")]]
    for p in report["project_summary"]:
        rows.append([
            Paragraph(f"<b>{escape(p['project'])}</b>", st["cell"]),
            str(p["total"]), str(p["completed"]), str(p["in_progress"]), str(p["blocked"]),
            Paragraph("<br/>".join(f"• {escape(x)}" for x in p["tasks"][:12]) +
                      (f"<br/>… and {len(p['tasks']) - 12} more" if len(p["tasks"]) > 12 else ""), st["cell"]),
        ])
    w = doc.width
    pt = Table(rows, colWidths=[w * 0.22, w * 0.08, w * 0.08, w * 0.1, w * 0.1, w * 0.42], repeatRows=1)
    pt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF2FF")),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 9), ("ALIGN", (1, 1), (4, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(pt)

    def section(title: str, items: list[dict], empty: str, show_status: bool = True):
        story.append(Paragraph(title, st["h2"]))
        if items:
            story.append(_bullets([_entry_line(e, st, with_project=True, with_date=True, show_status=show_status)
                                   for e in items], 10))
        else:
            story.append(Paragraph(empty, st["small"]))

    section("Completed Work", report["completed"], "No completed items in this period.", show_status=False)
    section("In Progress", report["in_progress"] + report["planned"], "Nothing currently in progress.")

    story.append(Paragraph("Blockers", st["h2"]))
    if report["blockers"]:
        items = []
        for e in report["blockers"]:
            txt = (f'<font color="#64748B">{escape(e["date_label"])}</font> · <b>{escape(e["project"] or "General")}</b>'
                   f" — {escape(e['task_title'])} {_status(e)}")
            if e["blockers"]:
                txt += f"<br/>{escape(e['blockers'])}"
            items.append(Paragraph(txt, st["body"]))
        story.append(_bullets(items, 10))
    else:
        story.append(Paragraph("No blockers were recorded in this period.", st["small"]))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buf.getvalue()
