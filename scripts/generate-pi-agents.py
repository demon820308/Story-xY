#!/usr/bin/env python3
"""Generate Pi custom-agent markdown definitions from Claude/template agent sources.

The templates/agents/*.md files are the semantic source of truth for agent rules and prompts.
Pi expects markdown files with frontmatter containing name, description, slot, tools, and maxTurns.
This script performs a deterministic, clean UTF-8 conversion without hardcoding models or drive letters.
"""

from __future__ import annotations

import argparse
import difflib
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = REPO_ROOT / "skills" / "story-setup" / "references" / "templates" / "agents"
DEFAULT_TARGET_DIRS = [
    REPO_ROOT / "skills" / "story-setup" / "references" / "pi" / "agents",
    REPO_ROOT / ".pi" / "agents",
]

# Editorial roles mapping aligning with story-agents.ts EDITORIAL_ROLES
ROLE_CONFIG: dict[str, dict[str, object]] = {
    "story-architect": {
        "slot": "architect",
        "tools": ["read", "bash", "edit", "write"],
    },
    "narrative-writer": {
        "slot": "writer",
        "tools": ["read", "bash", "edit", "write"],
    },
    "character-designer": {
        "slot": "architect",
        "tools": ["read", "bash", "edit", "write"],
    },
    "consistency-checker": {
        "slot": "reviewer",
        "tools": ["read", "bash"],
    },
    "chapter-extractor": {
        "slot": "runner",
        "tools": ["read", "bash"],
    },
    "story-explorer": {
        "slot": "runner",
        "tools": ["read", "bash"],
    },
    "story-researcher": {
        "slot": "runner",
        "tools": ["read", "bash"],
    },
}


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        raise ValueError("missing frontmatter delimiter at start")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("unterminated frontmatter delimiter")
    raw = text[4:end]
    body = text[end + len("\n---\n") :].lstrip()
    data: dict[str, str] = {}
    lines = raw.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$", line)
        if not m:
            i += 1
            continue
        key, value = m.group(1), (m.group(2) or "").rstrip()
        if value == "|":
            block: list[str] = []
            i += 1
            while i < len(lines):
                nxt = lines[i]
                if nxt and not nxt.startswith((" ", "\t")):
                    break
                block.append(nxt[2:] if nxt.startswith("  ") else nxt.lstrip())
                i += 1
            data[key] = "\n".join(block).strip()
            continue
        normalized = value.strip().strip('"').strip("'")
        data[key] = normalized
        i += 1
    return data, body


def adapt_body_for_pi(body: str, name: str) -> str:
    adapted = body
    # Replace Claude references path with generic/pi references path
    adapted = adapted.replace(
        ".claude/skills/story-setup/references/agent-references/",
        "skills/story-setup/references/agent-references/",
    )
    adapted = adapted.replace("当前 Claude 部署的 canonical 路径", "当前 Pi 部署的 canonical 路径")
    adapted = adapted.replace(
        'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/story_hook_cli.js',
        'node "$PROJECT_DIR"/skills/story-setup/references/templates/hooks/story_hook_cli.js',
    )
    return adapted.rstrip() + "\n"


def render_pi_agent(src: Path) -> tuple[str, str]:
    text = src.read_text(encoding="utf-8")
    meta, body = parse_frontmatter(text)
    name = meta.get("name") or src.stem
    if name not in ROLE_CONFIG:
        raise ValueError(f"Unknown agent name '{name}' in {src}")

    cfg = ROLE_CONFIG[name]
    slot = str(cfg["slot"])
    tools = list(cfg["tools"])

    desc = meta.get("description", "").strip()
    # Format description lines
    desc_lines = desc.splitlines()
    desc_formatted = "\n".join(f"  {line}" for line in desc_lines)

    lines: list[str] = ["---", f"name: {name}"]
    if len(desc_lines) > 1:
        lines.append("description: |")
        lines.append(desc_formatted)
    elif desc_lines:
        lines.append(f"description: {desc_lines[0]}")

    lines.append(f"slot: {slot}")
    lines.append("tools:")
    for t in tools:
        lines.append(f"  - {t}")

    if "maxTurns" in meta:
        lines.append(f"maxTurns: {meta['maxTurns']}")

    lines.append("---")
    lines.append("")
    lines.append(adapt_body_for_pi(body, name))

    rendered = "\n".join(lines)
    return name, rendered


def check_or_write(rendered: dict[str, str], targets: list[Path], check_mode: bool) -> int:
    mismatches: list[str] = []
    for target_dir in targets:
        target_dir.mkdir(parents=True, exist_ok=True)
        for name, content in rendered.items():
            file_path = target_dir / f"{name}.md"
            if not file_path.exists():
                mismatches.append(f"Missing file: {file_path}")
                continue
            existing = file_path.read_text(encoding="utf-8", errors="replace")
            if existing != content:
                diff = list(difflib.unified_diff(
                    existing.splitlines(keepends=True),
                    content.splitlines(keepends=True),
                    fromfile=str(file_path),
                    tofile=f"generated:{name}.md",
                    n=2,
                ))
                mismatches.append(f"Diff in {file_path}:\n" + "".join(diff[:30]))

    if check_mode:
        if mismatches:
            print("FAILED: generate-pi-agents --check found mismatches:", file=sys.stderr)
            for m in mismatches:
                print(m, file=sys.stderr)
            return 1
        print("OK: all Pi agent definitions match canonical templates.")
        return 0

    # Write mode
    for target_dir in targets:
        target_dir.mkdir(parents=True, exist_ok=True)
        for name, content in rendered.items():
            file_path = target_dir / f"{name}.md"
            file_path.write_text(content, encoding="utf-8", newline="\n")
            print(f"Wrote {file_path}")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check targets against templates without modifying them",
    )
    parser.add_argument(
        "--templates-dir",
        type=Path,
        default=TEMPLATES_DIR,
        help="Path to template agents directory",
    )
    parser.add_argument(
        "--target-dir",
        type=Path,
        action="append",
        dest="target_dirs",
        help="Target directories (can be specified multiple times)",
    )
    args = parser.parse_args()

    templates_dir = args.templates_dir
    target_dirs = args.target_dirs or DEFAULT_TARGET_DIRS

    if not templates_dir.is_dir():
        print(f"Templates directory not found: {templates_dir}", file=sys.stderr)
        return 2

    rendered: dict[str, str] = {}
    for template_file in sorted(templates_dir.glob("*.md")):
        name, content = render_pi_agent(template_file)
        # Verify no replacement character U+FFFD exists
        if "\ufffd" in content:
            raise ValueError(f"Corrupt UTF-8 character detected while rendering {name}")
        rendered[name] = content

    return check_or_write(rendered, target_dirs, args.check)


if __name__ == "__main__":
    raise SystemExit(main())
