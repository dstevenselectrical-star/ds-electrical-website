#!/usr/bin/env python3
"""
Free Weekly SEO + Performance + Content Audit
Replaces the paid anthropics/claude-code-action audit with a stdlib-only Python equivalent.

Runs the same 6 checks the paid version did:
  1. Broken/inconsistent metadata
  2. Schema.org completeness
  3. Accessibility quick wins
  4. Performance red flags
  5. DS-specific content correctness
  6. Top fixes ranked by impact

Cost: $0. No Anthropic API. No OpenAI. No external paid services.
Deps: Python stdlib + lxml (preinstalled on GitHub Actions ubuntu-latest).
"""

import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from lxml import etree, html as lxml_html

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REPO_ROOT = Path(os.environ.get("GITHUB_WORKSPACE", Path(__file__).resolve().parents[2]))

SKIP_DIR_PARTS = {
    "_discarded",
    "_archive",
    ".archive",
    "node_modules",
    ".firecrawl",
    "blueprint",
    "blueprints",
    "sparky",
    ".git",
    ".github",
    "worker",
    "worker-oldsite",
    "scripts",
    "analytics",
}

SKIP_FILE_PATTERNS = [
    re.compile(r"^google[a-z0-9]+\.html$", re.IGNORECASE),  # Google Search Console verification
    re.compile(r"^quote/m/", re.IGNORECASE),
]

# DS-specific banned content (per memory rules)
BANNED_PHRASES_SOLAR = [
    re.compile(r"\bsolar\b(?!\s*lights?\b)", re.IGNORECASE),
    re.compile(r"\bbattery\s+storage\b", re.IGNORECASE),
]

OFFICE_NUMBER = re.compile(r"01458\s*833\s*844")
GLASTONBURY_TARGET = re.compile(
    r"(electrician|services?|coverage|covering)[^.<>]{0,80}\bglastonbury\b|"
    r"\bglastonbury\b[^.<>]{0,40}(electrician|service area)",
    re.IGNORECASE,
)
NETLIFY_REFERENCE = re.compile(r"netlify", re.IGNORECASE)
OZEV_GRANT_HANDLING = re.compile(
    r"we\s+(handle|manage|sort|deal\s+with|take\s+care\s+of)\s+the\s+(ozev|grant)",
    re.IGNORECASE,
)
WRONG_COMPANY_NAME = re.compile(r"\bDS\s+Electrical\s+Installation\s+SW\s+Ltd\b")  # missing 's' and parens

BANNED_BRANDS = [
    "Lutron", "Rako", "Casambi", "Loxone", "Helvar",
    "Lightwave", "Aqara", "Shelly", "Tado",
    "Dahua", "EZVIZ", "Swann",
]
# "Axis" is too common a word — only flag in installer/CCTV context
AXIS_CCTV = re.compile(r"\b(install|fit|supply)[^.<>]{0,60}\baxis\b[^.<>]{0,60}(camera|cctv)", re.IGNORECASE)

FLUKE_DSX = re.compile(r"\bFluke\s+DSX[\s-]?8000\b|\bMultiFiber\s+Pro\b", re.IGNORECASE)

NON_DESCRIPTIVE_LINKS = [
    "click here", "read more", "here", "more", "click", "this", "this link",
    "learn more",  # often allowed in context but flag for review
]

# ---------------------------------------------------------------------------
# Findings store
# ---------------------------------------------------------------------------

class Findings:
    def __init__(self):
        self.metadata = []        # missing canonical/og/twitter, dupes, length
        self.schema = []          # JSON-LD issues
        self.a11y = []            # alt, link text
        self.perf = []            # webp, preconnect, render-blocking
        self.content = []         # DS-specific banned content
        self.errors = []          # parse failures

    def add(self, category, file_rel, line, severity, message):
        record = {
            "file": file_rel,
            "line": line,
            "severity": severity,
            "msg": message,
        }
        getattr(self, category).append(record)

    def total(self):
        return sum(len(getattr(self, c)) for c in ("metadata", "schema", "a11y", "perf", "content"))


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------

def should_skip(path: Path) -> bool:
    rel = path.relative_to(REPO_ROOT).as_posix()
    parts = set(path.relative_to(REPO_ROOT).parts)
    if parts & SKIP_DIR_PARTS:
        return True
    for pat in SKIP_FILE_PATTERNS:
        if pat.search(rel) or pat.search(path.name):
            return True
    return False


def discover_html_files():
    files = []
    for path in REPO_ROOT.rglob("*.html"):
        if should_skip(path):
            continue
        files.append(path)
    return sorted(files)


# ---------------------------------------------------------------------------
# Image cache (for webp comparison)
# ---------------------------------------------------------------------------

def build_image_index():
    """Map basename (no ext) -> {ext: (size, abspath)} for files in photos/."""
    index = defaultdict(dict)
    photos_dir = REPO_ROOT / "photos"
    if not photos_dir.is_dir():
        return index
    for p in photos_dir.rglob("*"):
        if not p.is_file():
            continue
        ext = p.suffix.lower().lstrip(".")
        if ext in ("jpg", "jpeg", "png", "webp", "avif"):
            try:
                size = p.stat().st_size
            except OSError:
                continue
            stem = p.with_suffix("").as_posix()
            index[stem][ext] = (size, p)
    return index


# ---------------------------------------------------------------------------
# Per-file checks
# ---------------------------------------------------------------------------

def parse_html(path: Path):
    raw = path.read_text(encoding="utf-8", errors="replace")
    parser = lxml_html.HTMLParser(recover=True)
    tree = lxml_html.fromstring(raw, parser=parser) if raw.strip() else None
    return raw, tree


def find_line(raw: str, snippet: str, start: int = 0) -> int:
    idx = raw.find(snippet, start)
    if idx < 0:
        return 0
    return raw.count("\n", 0, idx) + 1


def check_metadata(path, raw, tree, findings, title_to_files, desc_to_files):
    rel = path.relative_to(REPO_ROOT).as_posix()
    if tree is None:
        return

    # Skip <head>-less fragments
    head = tree.find(".//head")
    if head is None:
        return

    # canonical
    canonical = head.xpath('.//link[@rel="canonical"]/@href')
    if not canonical:
        findings.add("metadata", rel, 0, "high", "Missing <link rel=\"canonical\">")

    # og:image
    og_img = head.xpath('.//meta[@property="og:image"]/@content')
    if not og_img:
        findings.add("metadata", rel, 0, "medium", "Missing og:image meta")

    # twitter:card
    tw_card = head.xpath('.//meta[@name="twitter:card"]/@content')
    if not tw_card:
        findings.add("metadata", rel, 0, "low", "Missing twitter:card meta")

    # Title
    titles = head.xpath('.//title/text()')
    if titles:
        title = titles[0].strip()
        if title:
            title_to_files[title].append(rel)
            n = len(title)
            if n > 70:
                findings.add("metadata", rel, find_line(raw, "<title"), "high",
                             f"Title length {n} chars (>70, truncated in SERP)")
            elif n > 60:
                findings.add("metadata", rel, find_line(raw, "<title"), "low",
                             f"Title length {n} chars (>60, may be truncated)")

    # Description
    descs = head.xpath('.//meta[@name="description"]/@content')
    if descs:
        desc = descs[0].strip()
        if desc:
            desc_to_files[desc].append(rel)
            n = len(desc)
            if n > 160:
                findings.add("metadata", rel, find_line(raw, "name=\"description\""), "medium",
                             f"Description length {n} chars (>160, truncated in SERP)")


def check_schema(path, raw, tree, findings):
    rel = path.relative_to(REPO_ROOT).as_posix()
    if tree is None:
        return

    scripts = tree.xpath('//script[@type="application/ld+json"]')
    types_present = set()

    for script in scripts:
        text = (script.text or "").strip()
        if not text:
            findings.add("schema", rel, 0, "medium", "Empty JSON-LD script")
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            findings.add("schema", rel, find_line(raw, "application/ld+json"), "high",
                         f"Malformed JSON-LD: {e.msg} at line {e.lineno}")
            continue

        # Walk @graph if present
        nodes = []
        if isinstance(data, list):
            nodes.extend(data)
        elif isinstance(data, dict):
            if "@graph" in data and isinstance(data["@graph"], list):
                nodes.extend(data["@graph"])
            else:
                nodes.append(data)

        for node in nodes:
            if not isinstance(node, dict):
                continue
            t = node.get("@type")
            if isinstance(t, list):
                for x in t:
                    types_present.add(x)
            elif isinstance(t, str):
                types_present.add(t)

            # Required-field checks per type
            if t == "BreadcrumbList":
                items = node.get("itemListElement")
                if not items or not isinstance(items, list) or len(items) < 2:
                    findings.add("schema", rel, 0, "medium",
                                 "BreadcrumbList missing or has <2 itemListElement entries")
            elif t in ("LocalBusiness", "Electrician"):
                missing = [k for k in ("name", "address", "telephone") if not node.get(k)]
                if missing:
                    findings.add("schema", rel, 0, "medium",
                                 f"{t} schema missing fields: {', '.join(missing)}")
            elif t == "Article" or t == "BlogPosting":
                missing = [k for k in ("headline", "datePublished", "author") if not node.get(k)]
                if missing:
                    findings.add("schema", rel, 0, "low",
                                 f"{t} missing fields: {', '.join(missing)}")
            elif t == "Service":
                missing = [k for k in ("name", "provider") if not node.get(k)]
                if missing:
                    findings.add("schema", rel, 0, "low",
                                 f"Service schema missing fields: {', '.join(missing)}")

    # Visible breadcrumb without BreadcrumbList?
    has_visible_breadcrumb = bool(
        tree.xpath('//*[contains(@class, "breadcrumb") or @aria-label="Breadcrumb" or @aria-label="breadcrumb"]')
    )
    if has_visible_breadcrumb and "BreadcrumbList" not in types_present:
        # Don't flag homepage
        if rel.lower() not in ("index.html", "home.html"):
            findings.add("schema", rel, 0, "medium",
                         "Visible breadcrumb on page but no BreadcrumbList JSON-LD")

    # Root-level pages without LocalBusiness/Electrician schema
    if "/" not in rel and rel.endswith(".html"):
        skip_root = {"404.html", "thank-you.html", "thanks.html", "sitemap.html"}
        if rel not in skip_root:
            if not (types_present & {"LocalBusiness", "Electrician", "Organization"}):
                findings.add("schema", rel, 0, "low",
                             "Root landing page missing LocalBusiness/Electrician/Organization schema")


def check_a11y(path, raw, tree, findings):
    rel = path.relative_to(REPO_ROOT).as_posix()
    if tree is None:
        return

    # <img> without alt (presentational role="presentation" or aria-hidden are excused)
    for img in tree.xpath('//img'):
        alt = img.get("alt")
        role = img.get("role", "")
        aria_hidden = img.get("aria-hidden", "")
        if alt is None and role != "presentation" and aria_hidden != "true":
            src = img.get("src", "")
            line = find_line(raw, f'src="{src}"') if src else find_line(raw, "<img")
            findings.add("a11y", rel, line, "high", f"<img> missing alt attribute (src={src[:60]})")
        elif alt == "" and role != "presentation" and aria_hidden != "true":
            src = img.get("src", "")
            # empty alt is OK only for decorative; flag only if not classed as decorative
            cls = img.get("class", "")
            if "decorative" not in cls and "icon" not in cls:
                line = find_line(raw, f'src="{src}"') if src else find_line(raw, "<img")
                findings.add("a11y", rel, line, "low",
                             f"<img> has empty alt but isn't marked decorative (src={src[:60]})")

    # Non-descriptive link text
    for a in tree.xpath('//a[@href]'):
        text = "".join(a.itertext()).strip().lower()
        if not text:
            # Check for aria-label or title or img child with alt
            if not (a.get("aria-label") or a.get("title") or a.xpath('.//img[@alt and string-length(@alt)>0]')):
                href = a.get("href", "")
                findings.add("a11y", rel, find_line(raw, f'href="{href}"'), "medium",
                             f"<a> with no descriptive text or aria-label (href={href[:60]})")
            continue
        if text in NON_DESCRIPTIVE_LINKS:
            href = a.get("href", "")
            findings.add("a11y", rel, find_line(raw, f'href="{href}"'), "low",
                         f"Non-descriptive link text: \"{text}\" (href={href[:60]})")
        # Bare URL as link text
        if re.match(r"^https?://", text):
            href = a.get("href", "")
            findings.add("a11y", rel, find_line(raw, f'href="{href}"'), "low",
                         f"Link text is a bare URL: \"{text[:50]}\"")


def check_performance(path, raw, tree, findings, image_index):
    rel = path.relative_to(REPO_ROOT).as_posix()
    if tree is None:
        return

    head = tree.find(".//head")
    if head is None:
        return

    # JPG with smaller WebP twin
    for img in tree.xpath('//img[@src]'):
        src = img.get("src", "")
        m = re.search(r"^(.*?\/[^?#]+)\.(jpe?g|png)(\?.*)?$", src, re.IGNORECASE)
        if not m:
            continue
        # Resolve relative to repo root if it starts with '/' or relative to the page
        path_part = m.group(1).lstrip("/")
        ext = m.group(2).lower()
        # Check photos/ index first
        photo_rel = path_part
        # Strip leading directories until photos/ or just take basename for photos lookup
        candidate_stems = []
        if path_part.startswith("photos/"):
            candidate_stems.append((REPO_ROOT / path_part).as_posix())
        else:
            candidate_stems.append((REPO_ROOT / path_part).as_posix())

        for stem in candidate_stems:
            entry = image_index.get(stem)
            if not entry:
                continue
            if "webp" in entry and ext in entry:
                webp_size = entry["webp"][0]
                jpg_size = entry[ext][0]
                if webp_size < jpg_size:
                    findings.add("perf", rel, find_line(raw, src), "medium",
                                 f"<img src=\"{src}\"> has smaller .webp twin "
                                 f"({jpg_size//1024}KB jpg vs {webp_size//1024}KB webp)")
            break

    # Font preconnect
    preconnects = head.xpath('.//link[@rel="preconnect"]/@href')
    has_googleapis = any("fonts.googleapis.com" in p for p in preconnects)
    has_gstatic = any("fonts.gstatic.com" in p for p in preconnects)
    # Only flag if page actually uses Google Fonts
    uses_gfonts = bool(head.xpath('.//link[contains(@href, "fonts.googleapis.com")]'))
    if uses_gfonts:
        if not has_googleapis:
            findings.add("perf", rel, 0, "medium",
                         "Page loads Google Fonts but lacks <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">")
        if not has_gstatic:
            findings.add("perf", rel, 0, "low",
                         "Page loads Google Fonts but lacks preconnect to fonts.gstatic.com")

    # Render-blocking <script src=...> in <head> without defer/async
    for script in head.xpath('.//script[@src]'):
        src = script.get("src", "")
        if script.get("defer") is None and script.get("async") is None and script.get("type") not in ("module",):
            # type=application/ld+json is fine but those don't have src
            findings.add("perf", rel, find_line(raw, f'src="{src}"'), "high",
                         f"Render-blocking <script src=\"{src}\"> in <head> without defer/async")


def check_ds_content(path, raw, tree, findings):
    rel = path.relative_to(REPO_ROOT).as_posix()

    # Strip script and style content for content checks (avoid false positives in JSON-LD)
    text_only = re.sub(r"<script[^>]*>.*?</script>", "", raw, flags=re.DOTALL | re.IGNORECASE)
    text_only = re.sub(r"<style[^>]*>.*?</style>", "", text_only, flags=re.DOTALL | re.IGNORECASE)
    # Strip HTML comments
    text_only = re.sub(r"<!--.*?-->", "", text_only, flags=re.DOTALL)

    # Solar / battery storage
    for pat in BANNED_PHRASES_SOLAR:
        for m in pat.finditer(text_only):
            line = find_line(text_only, m.group(0))
            findings.add("content", rel, line, "high",
                         f"Banned DS-service mention: \"{m.group(0)}\" — DS does not offer solar/battery storage")
            break  # one per pattern per file, avoid spam

    # Office number
    for m in OFFICE_NUMBER.finditer(text_only):
        line = find_line(text_only, m.group(0))
        findings.add("content", rel, line, "high",
                     "Office number 01458 833844 present (mobile-only: 07889 334849, 07983 106928)")
        break

    # Glastonbury as target service area
    for m in GLASTONBURY_TARGET.finditer(text_only):
        line = find_line(text_only, m.group(0))
        snippet = m.group(0)[:80]
        findings.add("content", rel, line, "medium",
                     f"Glastonbury promoted as target service area (base only): \"{snippet}\"")
        break

    # Netlify
    for m in NETLIFY_REFERENCE.finditer(text_only):
        line = find_line(text_only, m.group(0))
        findings.add("content", rel, line, "medium",
                     "Reference to \"Netlify\" — site is self-hosted via Caddy + Cloudflare tunnel")
        break

    # OZEV grant handling claim
    for m in OZEV_GRANT_HANDLING.finditer(text_only):
        line = find_line(text_only, m.group(0))
        findings.add("content", rel, line, "high",
                     f"Banned wording: \"{m.group(0)}\" — DS does NOT handle grant applications")
        break

    # Wrong company name
    for m in WRONG_COMPANY_NAME.finditer(text_only):
        line = find_line(text_only, m.group(0))
        findings.add("content", rel, line, "high",
                     "Wrong company name: \"DS Electrical Installation SW Ltd\" — should be "
                     "\"DS Electrical Installations (SW) Ltd\"")
        break

    # Banned brands
    for brand in BANNED_BRANDS:
        pat = re.compile(rf"\b{re.escape(brand)}\b", re.IGNORECASE)
        for m in pat.finditer(text_only):
            line = find_line(text_only, m.group(0))
            findings.add("content", rel, line, "medium",
                         f"Banned smart-home/CCTV brand mentioned: \"{brand}\" — DS does not install this brand")
            break

    # Axis CCTV (context-specific)
    for m in AXIS_CCTV.finditer(text_only):
        line = find_line(text_only, m.group(0))
        findings.add("content", rel, line, "medium",
                     "Axis cameras claimed as installed — DS only installs Hikvision CCTV")
        break

    # Fluke DSX-8000 / MultiFiber Pro
    for m in FLUKE_DSX.finditer(text_only):
        line = find_line(text_only, m.group(0))
        findings.add("content", rel, line, "high",
                     f"Fluke DSX/MultiFiber Pro claim: \"{m.group(0)}\" — DS does not own these certifiers")
        break


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def render_section(title, items, max_items=50):
    if not items:
        return f"### {title}\n\n_No issues found._\n"
    out = [f"### {title} ({len(items)})\n"]
    items_sorted = sorted(items, key=lambda x: (SEVERITY_ORDER.get(x["severity"], 9), x["file"], x["line"]))
    shown = items_sorted[:max_items]
    for it in shown:
        loc = f"{it['file']}" + (f":{it['line']}" if it["line"] else "")
        out.append(f"- [ ] **[{it['severity']}]** `{loc}` — {it['msg']}")
    if len(items_sorted) > max_items:
        out.append(f"\n_…and {len(items_sorted) - max_items} more._")
    return "\n".join(out) + "\n"


def render_top_fixes(findings):
    """Rank findings by impact and pick top 5."""
    pool = []
    for cat in ("metadata", "schema", "a11y", "perf", "content"):
        for it in getattr(findings, cat):
            score = 0
            if it["severity"] == "high":
                score += 30
            elif it["severity"] == "medium":
                score += 15
            else:
                score += 5
            # Content correctness is highest user/legal impact
            if cat == "content":
                score += 25
            elif cat == "metadata":
                score += 10
            elif cat == "perf":
                score += 8
            elif cat == "a11y":
                score += 6
            pool.append((score, cat, it))
    pool.sort(key=lambda x: -x[0])

    # Group by message-prefix to avoid 5 identical findings
    seen_msg = set()
    top = []
    for score, cat, it in pool:
        key = it["msg"][:60]
        if key in seen_msg:
            continue
        seen_msg.add(key)
        top.append((score, cat, it))
        if len(top) >= 5:
            break

    if not top:
        return "_No issues to prioritise — site is clean this week._\n"

    out = []
    for i, (score, cat, it) in enumerate(top, 1):
        loc = f"{it['file']}" + (f":{it['line']}" if it["line"] else "")
        out.append(f"{i}. **[{cat} / {it['severity']}]** `{loc}` — {it['msg']}")
    return "\n".join(out) + "\n"


def build_report(findings, files_scanned, title_to_files, desc_to_files, run_id):
    # Add duplicate findings now that we have full counts
    for title, paths in title_to_files.items():
        if len(paths) > 1:
            findings.metadata.append({
                "file": paths[0],
                "line": 0,
                "severity": "medium",
                "msg": f"Duplicate <title> across {len(paths)} pages: \"{title[:60]}…\" (also: {', '.join(paths[1:5])})",
            })
    for desc, paths in desc_to_files.items():
        if len(paths) > 1:
            findings.metadata.append({
                "file": paths[0],
                "line": 0,
                "severity": "medium",
                "msg": f"Duplicate meta description across {len(paths)} pages (also: {', '.join(paths[1:5])})",
            })

    counts = {
        "metadata": len(findings.metadata),
        "schema": len(findings.schema),
        "a11y": len(findings.a11y),
        "perf": len(findings.perf),
        "content": len(findings.content),
    }
    total = sum(counts.values())

    lines = []
    lines.append(f"# Weekly site audit: {run_id}\n")
    lines.append(f"**Scanned {files_scanned} HTML files. Total findings: {total}.**\n")
    lines.append(
        f"Counts: metadata {counts['metadata']} · schema {counts['schema']} · "
        f"a11y {counts['a11y']} · perf {counts['perf']} · content {counts['content']}\n"
    )
    lines.append("---\n")

    lines.append("## Top 5 fixes to prioritise\n")
    lines.append(render_top_fixes(findings))
    lines.append("---\n")

    lines.append("## 1. Broken / inconsistent metadata\n")
    lines.append(render_section("Metadata findings", findings.metadata))

    lines.append("## 2. Schema.org completeness\n")
    lines.append(render_section("Schema findings", findings.schema))

    lines.append("## 3. Accessibility quick wins\n")
    lines.append(render_section("Accessibility findings", findings.a11y))

    lines.append("## 4. Performance red flags\n")
    lines.append(render_section("Performance findings", findings.perf))

    lines.append("## 5. DS-specific content correctness\n")
    lines.append(render_section("Content correctness findings", findings.content))

    if findings.errors:
        lines.append("## Parser warnings\n")
        for e in findings.errors:
            lines.append(f"- `{e['file']}` — {e['msg']}")

    if total == 0:
        lines.append("\n## All green this week\n\nAll 6 categories passed. Nothing to action.\n")

    lines.append("\n---\n_Generated by `.github/scripts/free_audit.py` — $0 cost, no Anthropic API._\n")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    run_id = os.environ.get("GITHUB_RUN_ID", "local-test")

    files = discover_html_files()
    findings = Findings()
    image_index = build_image_index()
    title_to_files = defaultdict(list)
    desc_to_files = defaultdict(list)

    for path in files:
        try:
            raw, tree = parse_html(path)
        except Exception as e:
            findings.errors.append({
                "file": path.relative_to(REPO_ROOT).as_posix(),
                "msg": f"Parse error: {e}",
            })
            continue
        check_metadata(path, raw, tree, findings, title_to_files, desc_to_files)
        check_schema(path, raw, tree, findings)
        check_a11y(path, raw, tree, findings)
        check_performance(path, raw, tree, findings, image_index)
        check_ds_content(path, raw, tree, findings)

    report = build_report(findings, len(files), title_to_files, desc_to_files, run_id)
    print(report)


if __name__ == "__main__":
    main()
