from pathlib import Path
import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "client/public/downloads/afrolandx-qa-completion-checklist.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
doc = fitz.open()
GREEN = (0.09, 0.25, 0.18)
INK = (0.15, 0.19, 0.17)
MUTED = (0.36, 0.40, 0.38)
AMBER = (0.48, 0.29, 0.12)


def page(number, title):
    p = doc.new_page(width=595, height=842)
    p.draw_rect(fitz.Rect(0, 0, 595, 12), color=GREEN, fill=GREEN)
    p.insert_text((44, 46), "AFROLANDX", fontsize=11, fontname="hebo", color=GREEN)
    p.insert_text((44, 80), title, fontsize=22, fontname="hebo", color=INK)
    p.insert_text((44, 100), "QA report completion checklist | 9 October 2026", fontsize=10, color=MUTED)
    p.draw_line((44, 791), (551, 791), color=(0.8, 0.83, 0.81))
    p.insert_text((44, 812), "Current project implementation; production confirmation is separate.", fontsize=8, color=MUTED)
    p.insert_text((513, 812), f"{number} / 3", fontsize=8, color=MUTED)
    return p


def text(p, y, content, size=10, color=INK):
    # Use a generous bounding box, then advance by the actual occupied height.
    rect = fitz.Rect(44, y, 551, 780)
    unused = p.insert_textbox(rect, content, fontsize=size, fontname="helv", color=color, lineheight=1.35)
    if unused < 0:
        raise RuntimeError("Checklist content exceeds the page.")
    occupied = rect.height - unused
    return y + occupied + 7


def heading(p, y, title):
    p.insert_text((44, y + 14), title, fontsize=13, fontname="hebo", color=GREEN)
    return y + 24


def item(p, y, content, done=True):
    p.draw_rect(fitz.Rect(45, y + 2, 53, y + 10), color=GREEN if done else MUTED, width=0.8)
    if done:
        p.draw_polyline([(46.5, y + 6), (49, y + 8.5), (52, y + 3.5)], color=GREEN, width=1.1)
    rect = fitz.Rect(63, y - 1, 550, 780)
    unused = p.insert_textbox(rect, content, fontsize=9.5, fontname="helv", color=INK, lineheight=1.3)
    if unused < 0:
        raise RuntimeError("Checklist content exceeds the page.")
    return y + rect.height - unused + 6


p = page(1, "Completed work")
y = text(p, 119, "Source: Afrolandx QA Report Bundle. Checked items are implemented in the current project. This is not confirmation that every change is live on afrolandx.com, or that all numbered QA findings are closed.", color=MUTED)
y = heading(p, y, "Vendor onboarding")
for s in [
    "Dedicated /vendor/apply flow, application requirements and status tracking.",
    "Mandatory CAC numbers for new applications, with format validation.",
    "Duplicate registration flags requiring documented resolution.",
    "Private CAC certificate and proof-of-authority uploads.",
    "Documented manual CAC Public Search review before approval.",
    "Final approval by a different verified reviewer; no self approval.",
    "Earlier checks reset when pending application details or evidence change.",
    "Vendor monitoring, recorded review notes and 90-day review dates.",
]:
    y = item(p, y, s)
y = text(p, y + 3, "Partial: the complete five-step journey, bank/payout setup, automatic saving and emails at every transition. Format validation does not replace a registry check.", size=9, color=AMBER)
y = heading(p, y, "Security and account protection")
for s in [
    "Security headers: Content Security Policy, content-type protection and referrer policy.",
    "Removed X-Powered-By: Express; added Content Security Policy script nonces.",
    "Safe, consistent responses for missing and unauthorised customer orders.",
    "Rate limits for registration, login, email codes and public AI/chat.",
    "Increasing delays after failed sign-in attempts.",
    "Generic email-code request responses to reduce account discovery.",
    "Breached-password checks for new passwords.",
    "Email-verification requirements preserved during email-provider failures.",
    "Monetary-input validation rejects invalid values.",
    "Admin support permissions and Superadmin-only platform controls preserved.",
]:
    y = item(p, y, s)

p = page(2, "Completed work continued")
y = heading(p, 119, "SEO and performance")
for s in [
    "Page-specific titles, descriptions, sharing metadata and canonical links.",
    "Proper robots.txt and sitemap handling.",
    "Server-rendered public catalogue content.",
    "Appropriate HTTP status handling for missing pages.",
    "Locally hosted fonts.",
    "JavaScript size checks; the latest build passed for all 34 page modules.",
]:
    y = item(p, y, s)
y = text(p, y + 3, "Pending: complete search and sharing improvements for maker profiles and published collections.", size=9, color=AMBER)
y = heading(p, y + 4, "Payments, orders and checkout")
for s in [
    "Server-controlled pricing and payment-verification safeguards.",
    "Unpaid checkout expiry handling, with provider verification before expiry.",
    "Expired records retained; late payments held for financial review.",
    "Vendor settlement accounting: 8% of merchandise value only.",
    "Vendor sales visibility restricted to paid orders.",
    "Guest checkout support.",
]:
    y = item(p, y, s)
y = text(p, y + 3, "Pending or needing further verification: confirmed international shipping quote payment, interrupted fulfilment recovery, and full payout/refund regression testing.", size=9, color=AMBER)
y = heading(p, y + 4, "Privacy")
for s in [
    "Privacy disclosures updated.",
    "Optional tracking kept disabled rather than enabled without consent.",
    "Consent-banner implementation requirements documented.",
    "Vendor evidence restricted to authenticated, authorised access.",
]:
    y = item(p, y, s)
y = text(p, y + 3, "Not complete: the working Accept/Reject/Manage consent banner and the report's full privacy operations checklist.", size=9, color=AMBER)

p = page(3, "Remaining checks and verification")
y = heading(p, 119, "Not yet marked complete")
for s in [
    "Confirm reliable live product-image storage.",
    "Complete the accessibility and keyboard-navigation pass.",
    "Replace the admin tabs with the proposed grouped sidebar.",
    "Complete admin MFA and the other proposed session controls.",
    "Verify all transactional emails and outage recovery.",
    "Confirm live payment and shipping readiness.",
    "Complete signed-in desktop, tablet and phone testing.",
    "Re-run the production QA report before closing its findings.",
]:
    y = item(p, y, s, done=False)
y = heading(p, y + 13, "Latest vendor-onboarding verification")
for s in [
    "Type check passed.",
    "Production build passed.",
    "All 14 targeted tests passed, including database checks.",
    "Public application layout checked on desktop and phone.",
]:
    y = item(p, y, s)
y = text(p, y + 8, "Signed-in vendor and admin screens were not browser-tested. These development checks do not substitute for a fresh production QA run.", color=AMBER)
y = heading(p, y + 13, "How to read the checklist")
y = text(p, y, "Checked: implementation exists in the current project.\nUnchecked: still pending, incomplete or not sufficiently verified.\nPartial: part of the recommendation is implemented, but the complete scope is not finished.\n\nExisting approved vendors are not automatically suspended by the new onboarding requirements. Monitoring signals prompt staff review rather than automatic penalties.", color=MUTED)

doc.set_metadata({"title": "Afrolandx QA Report Completion Checklist", "author": "Afrolandx", "subject": "Completed and pending work against the QA report, 9 October 2026"})
doc.save(OUT, garbage=4, deflate=True)
for index in range(len(doc)):
    doc[index].get_pixmap(matrix=fitz.Matrix(1, 1)).save(f"/tmp/afrolandx-checklist-page-{index + 1}.png")
print(f"Created {OUT.relative_to(ROOT)} ({len(doc)} pages)")
