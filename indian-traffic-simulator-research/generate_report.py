#!/usr/bin/env python3
"""Convert the deep-research JSON results into one markdown report.

Run from anywhere:
    uv run --no-project --with pyyaml python indian-traffic-simulator-research/generate_report.py

Reads  outline.yaml, fields.yaml and results/*.json next to this script.
Writes report.md next to this script.

Rules (from the research-report skill):
- cover every field value of every JSON, grouped by field category
- skip values containing "[uncertain]", fields named in the `uncertain`
  array, empty values, and "N/A" (field does not apply to that item)
- list the skipped uncertain field names per item so gaps stay visible
- collect fields not defined in fields.yaml under "Other info"
"""
import json
import re
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
TOC_FIELDS = [("type", "Type"), ("licence", "Licence"), ("last_activity", "Last activity")]
TOC_MAX = 70
INTERNAL_KEYS = {"_source_file", "uncertain"}

# fields.yaml category names <-> possible JSON keys (nested-structure support)
CATEGORY_MAPPING = {
    "Basic Info": ["basic_info", "Basic Info"],
    "Technical Features": ["technical_features", "technical_characteristics", "Technical Features"],
    "Performance Metrics": ["performance_metrics", "performance", "Performance Metrics"],
    "Milestone Significance": ["milestone_significance", "milestones", "Milestone Significance"],
    "Business Info": ["business_info", "commercial_info", "Business Info"],
    "Competition & Ecosystem": ["competition_ecosystem", "competition", "Competition & Ecosystem"],
    "History": ["history", "History"],
    "Market Positioning": ["market_positioning", "market", "Market Positioning"],
}
GROUP_TITLES = {
    "A": "A. Open-source simulators",
    "B": "B. Behaviour models",
    "C": "C. Indian context and data",
    "D": "D. Architecture decisions",
    "E": "E. Lessons from prior work",
}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def anchor(s):
    return re.sub(r"[^a-z0-9 -]", "", str(s).lower()).strip().replace(" ", "-")


def title(s):
    return str(s).replace("_", " ").capitalize()


def lookup(data, field, category):
    """Top level -> category mapping key -> any nested dict."""
    if field in data and not (isinstance(data[field], dict) and field in CATEGORY_MAPPING_KEYS):
        return data[field], True
    for key in [category] + [k for ks in CATEGORY_MAPPING.values() for k in ks]:
        sub = data.get(key)
        if isinstance(sub, dict) and field in sub:
            return sub[field], True
    for sub in data.values():
        if isinstance(sub, dict) and field in sub:
            return sub[field], True
    return None, False


CATEGORY_MAPPING_KEYS = {k for ks in CATEGORY_MAPPING.values() for k in ks}


def is_skipped(value):
    if value is None:
        return True
    if isinstance(value, str):
        v = value.strip()
        return v == "" or v.upper() in {"N/A", "NA"} or v.upper().startswith("N/A") and len(v) < 40
    if isinstance(value, (list, dict)):
        return len(value) == 0
    return False


def has_uncertain(value):
    return "[uncertain]" in json.dumps(value, ensure_ascii=False)


def fmt_scalar(v):
    return str(v).replace("\n", " ").strip()


def fmt_dict_inline(d):
    return " | ".join(f"{k}: {fmt_inline(v)}" for k, v in d.items())


def fmt_inline(v):
    if isinstance(v, dict):
        return "; ".join(f"{k}: {fmt_inline(x)}" for k, x in v.items())
    if isinstance(v, list):
        return ", ".join(fmt_inline(x) for x in v)
    return fmt_scalar(v)


def fmt_value(v):
    """Return markdown lines for a field value."""
    if isinstance(v, list):
        if all(isinstance(x, dict) for x in v):
            return [f"- {fmt_dict_inline(x)}" for x in v]
        items = [fmt_inline(x) for x in v]
        if len(items) <= 4 and all(len(i) <= 40 for i in items):
            return [", ".join(items)]
        return [f"- {i}" for i in items]
    if isinstance(v, dict):
        return [f"- **{k}:** {fmt_inline(x)}" for k, x in v.items()]
    s = fmt_scalar(v)
    if len(s) > 100:
        return [f"> {s}"]
    return [s]


def main():
    outline = yaml.safe_load((HERE / "outline.yaml").read_text(encoding="utf-8"))
    fields = yaml.safe_load((HERE / "fields.yaml").read_text(encoding="utf-8"))["fields"]
    out_dir = (HERE / outline.get("execution", {}).get("output_dir", "./results")).resolve()

    results = {}
    for p in sorted(out_dir.glob("*.json")):
        results[p.stem] = json.loads(p.read_text(encoding="utf-8"))

    # match each result file to its outline item (for ordering and grouping)
    ordered, used = [], set()
    for item in outline["items"]:
        n = norm(item["name"])
        for stem in results:
            s = norm(stem)
            if stem not in used and (n.startswith(s) or s.startswith(n)):
                ordered.append((item, stem))
                used.add(stem)
                break
    for stem in results:
        if stem not in used:
            ordered.append(({"id": "Z99", "name": stem, "category": "", "priority": ""}, stem))

    defined = {f["name"]: cat for cat, fl in fields.items() for f in fl}
    lines = [
        "# Indian traffic simulator research report",
        "",
        f"Generated from {len(ordered)} deep-research result files by `generate_report.py`.",
        f"Outline has {len(outline['items'])} items; only those researched so far appear here.",
        "",
        "How to read this: every value was gathered by a web-research agent and carries its",
        "source links in the item's `links` field. Values the agent marked `[uncertain]` are",
        "left out of the body and listed by field name at the end of each item.",
        "",
        "## Contents",
        "",
    ]
    group = None
    for i, (item, stem) in enumerate(ordered, 1):
        g = item["id"][0]
        if g != group:
            group = g
            lines += ["", f"**{GROUP_TITLES.get(g, 'Other')}**", ""]
        data = results[stem]
        unc = set(data.get("uncertain") or [])
        bits = []
        for f, label in TOC_FIELDS:
            v, found = lookup(data, f, defined.get(f, ""))
            if found and f not in unc and not is_skipped(v) and not has_uncertain(v):
                s = fmt_inline(v)
                bits.append(f"{label}: {s[:TOC_MAX] + ('…' if len(s) > TOC_MAX else '')}")
        suffix = (" - " + " | ".join(bits)) if bits else ""
        lines.append(f"{i}. [{item['name']}](#{anchor(str(i) + ' ' + item['name'])}){suffix}")

    group = None
    for i, (item, stem) in enumerate(ordered, 1):
        g = item["id"][0]
        if g != group:
            group = g
            lines += ["", "---", "", f"# {GROUP_TITLES.get(g, 'Other')}"]
        data = results[stem]
        unc = [str(u) for u in (data.get("uncertain") or [])]
        lines += ["", f"## {i} {item['name']}", "",
                  f"*Outline id {item['id']} · category {item.get('category', '')} · priority {item.get('priority', '')} · source file `results/{stem}.json`*", ""]
        skipped_unc = []
        for cat, flist in fields.items():
            block = []
            for f in flist:
                name = f["name"]
                v, found = lookup(data, name, cat)
                if not found or is_skipped(v):
                    continue
                if name in unc or has_uncertain(v):
                    skipped_unc.append(name)
                    continue
                vl = fmt_value(v)
                if len(vl) == 1 and not vl[0].startswith(("> ", "- ")):
                    block.append(f"- **{title(name)}:** {vl[0]}")
                else:
                    block.append(f"- **{title(name)}:**")
                    block += [f"  {x}" for x in vl]
            if block:
                lines += [f"### {title(cat)}", ""] + block + [""]
        extra = [k for k in data if k not in defined and k not in INTERNAL_KEYS and k not in CATEGORY_MAPPING_KEYS]
        block = []
        for k in extra:
            v = data[k]
            if is_skipped(v) or has_uncertain(v):
                continue
            vl = fmt_value(v)
            block.append(f"- **{title(k)}:**")
            block += [f"  {x}" for x in vl]
        if block:
            lines += ["### Other info", ""] + block + [""]
        names = sorted(set(skipped_unc) | set(unc))
        if names:
            lines += ["### Uncertain fields (left out above)", ""] + [f"- {n}" for n in names] + [""]

    (HERE / "report.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"items={len(ordered)} matched_to_outline={len(used)} lines={len(lines)} -> {HERE / 'report.md'}")


if __name__ == "__main__":
    main()
