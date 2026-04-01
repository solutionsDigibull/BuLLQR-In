"""Generate a PDF changelog document for today's changes."""
from fpdf import FPDF
from datetime import datetime


class ChangelogPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(33, 37, 41)
        self.cell(0, 10, "BuLLMQR - Cable Assembly Production Tracker", new_x="LMARGIN", new_y="NEXT", align="C")
        self.set_font("Helvetica", "", 11)
        self.set_text_color(108, 117, 125)
        self.cell(0, 7, "Change Document - 16 March 2026", new_x="LMARGIN", new_y="NEXT", align="C")
        self.ln(2)
        self.set_draw_color(200, 200, 200)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, num, title):
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(33, 150, 243)
        self.cell(0, 9, f"{num}. {title}", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def sub_title(self, title):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(52, 58, 64)
        self.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(73, 80, 87)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bullet(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(73, 80, 87)
        x = self.get_x()
        self.cell(8, 5.5, "-")
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def file_badge(self, filepath):
        self.set_font("Courier", "", 9)
        self.set_fill_color(240, 240, 240)
        self.set_text_color(80, 80, 80)
        w = self.get_string_width(filepath) + 6
        self.cell(w, 6, filepath, fill=True)
        self.ln(7)

    def change_row(self, what, detail):
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(52, 58, 64)
        self.cell(40, 5.5, what)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(73, 80, 87)
        self.multi_cell(0, 5.5, detail)
        self.ln(1)


def main():
    pdf = ChangelogPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # --- Overview ---
    pdf.section_title("1", "Overview")
    pdf.body_text(
        "This document describes all modifications made to the BuLLMQR Cable Assembly "
        "Production Tracker (CATS) application on 16 March 2026. Changes span both the "
        "backend (Python/FastAPI) and frontend (React/TypeScript) codebases. All changes "
        "are backward-compatible and do not break existing functionality."
    )

    # --- Change 1 ---
    pdf.section_title("2", "Analytics Dashboard - Current Day Filtering")
    pdf.body_text("Modified the analytics dashboard to show only current-day data instead of all-time data.")
    pdf.sub_title("Files Changed:")
    pdf.file_badge("backend/src/routers/analytics.py")
    pdf.file_badge("frontend/src/pages/AnalyticsPage.tsx")
    pdf.ln(2)
    pdf.sub_title("Backend Changes:")
    pdf.bullet("_stage_progress() function: Added today_only parameter. When True, filters ScanRecord by scan_timestamp >= start of today (UTC).")
    pdf.bullet("/api/v1/analytics/progress endpoint: Now calls _stage_progress(db, product, today_only=True) so Production Progress bar chart shows only current-day scans.")
    pdf.bullet("/api/v1/analytics/dashboard endpoint: Stage progress filtered to today. total_scans, ok_count, and not_ok_count in quality_stats now query only today's scans.")
    pdf.ln(2)
    pdf.sub_title("Frontend Changes:")
    pdf.bullet("Removed the 'Unique Assemblies Today' summary card from the dashboard.")
    pdf.bullet("Removed the 'Quality Statistics' donut chart section (QualityStatsChart component).")
    pdf.bullet("Removed QualityStatsChart import.")
    pdf.bullet("Changed summary cards grid from 3-column to 2-column layout.")
    pdf.bullet("Renamed 'Total Scans' label to 'Total Scans Today'.")

    # --- Change 2 ---
    pdf.section_title("3", "Operator Performance Chart - Color & Layout Fix")
    pdf.body_text("Fixed label overlap and aligned chart colors with Production Progress chart.")
    pdf.sub_title("File Changed:")
    pdf.file_badge("frontend/src/components/analytics/OperatorPerformanceChart.tsx")
    pdf.ln(2)
    pdf.sub_title("Changes:")
    pdf.bullet("OK_COLOR changed from green (#4CAF50) to blue (#2196F3) to match the Production Progress bar chart color scheme.")
    pdf.bullet("Chart container height increased from 340px to 420px.")
    pdf.bullet("Bottom margin increased from 60px to 80px.")
    pdf.bullet("XAxis label area height increased from 100px to 140px, preventing angled text labels from overlapping with bars.")

    # --- Change 3 ---
    pdf.section_title("4", "Recent Scans - Last 30 with Real-Time Updates")
    pdf.body_text(
        "Modified the Recent Scans section on the Scan page to display the last 30 scans "
        "(previously 100) with continuous absolute numbering that reflects the true total "
        "scan count per stage."
    )
    pdf.sub_title("Files Changed:")
    pdf.file_badge("backend/src/routers/session.py")
    pdf.file_badge("frontend/src/pages/ScanPage.tsx")
    pdf.file_badge("frontend/src/components/scan/SessionDisplay.tsx")
    pdf.ln(2)
    pdf.sub_title("Backend Changes:")
    pdf.bullet("total_count in GET /api/v1/session/latest response now returns the count filtered by stage_id (previously counted the entire scan_records table). Uses func.count(ScanRecord.id) with stage filter.")
    pdf.ln(2)
    pdf.sub_title("Frontend Changes (ScanPage.tsx):")
    pdf.bullet("Initial fetch limit changed from 100 to 30: getLatestScans(30, selectedStageId).")
    pdf.bullet("WebSocket scan_created handler slice changed from .slice(0, 100) to .slice(0, 30).")
    pdf.bullet("Added stageTotalCount state variable, populated from API response data.total_count on initial load.")
    pdf.bullet("stageTotalCount incremented by 1 on each WebSocket scan_created event for the selected stage.")
    pdf.bullet("Passed totalCount={stageTotalCount} prop to SessionDisplay component.")
    pdf.ln(2)
    pdf.sub_title("Frontend Changes (SessionDisplay.tsx):")
    pdf.bullet("Added totalCount optional prop to SessionDisplayProps interface.")
    pdf.bullet("Row # column now uses absolute numbering: (totalCount - index) instead of (scans.length - index).")
    pdf.bullet("Example: If stage has 45 total scans, rows show 00045, 00044, ... 00016. When scan 46 arrives, rows update to 00046, 00045, ... 00017.")

    # --- Summary Table ---
    pdf.add_page()
    pdf.section_title("5", "Summary of All Changed Files")
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(33, 150, 243)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(15, 7, "#", fill=True, align="C")
    pdf.cell(95, 7, "File Path", fill=True)
    pdf.cell(80, 7, "Change Summary", fill=True)
    pdf.ln()

    rows = [
        ("1", "backend/src/routers/analytics.py", "Added today_only filter; dashboard shows current-day data"),
        ("2", "backend/src/routers/session.py", "total_count filtered by stage_id"),
        ("3", "frontend/src/pages/AnalyticsPage.tsx", "Removed Unique Assemblies & Quality Stats sections"),
        ("4", "frontend/src/components/analytics/\nOperatorPerformanceChart.tsx", "Color fix (blue), label overlap fix"),
        ("5", "frontend/src/pages/ScanPage.tsx", "Limit 30 scans, absolute numbering via stageTotalCount"),
        ("6", "frontend/src/components/scan/\nSessionDisplay.tsx", "totalCount prop for absolute row numbering"),
    ]

    pdf.set_font("Helvetica", "", 9)
    for i, (num, path, summary) in enumerate(rows):
        fill = i % 2 == 0
        if fill:
            pdf.set_fill_color(245, 248, 255)
        else:
            pdf.set_fill_color(255, 255, 255)
        pdf.set_text_color(52, 58, 64)

        h = 7 if "\n" not in path else 12
        y_before = pdf.get_y()
        pdf.cell(15, h, num, fill=True, align="C")
        pdf.set_font("Courier", "", 8)
        pdf.multi_cell(95, 6, path, fill=True)
        y_after = pdf.get_y()
        pdf.set_y(y_before)
        pdf.set_x(10 + 15 + 95)
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(80, 6, summary, fill=True)
        pdf.set_y(max(y_after, pdf.get_y()))
        pdf.ln(1)

    pdf.ln(5)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(108, 117, 125)
    pdf.cell(0, 6, "Document generated on: " + datetime.now().strftime("%d %B %Y, %I:%M %p"), align="R")

    output_path = r"C:\Users\Admin\CAT-Sp-u2\CATS_Change_Document_2026-03-16.pdf"
    pdf.output(output_path)
    print(f"PDF generated: {output_path}")


if __name__ == "__main__":
    main()
