#!/usr/bin/env python3
import argparse
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


VERSION_RE = re.compile(r"^\s*//\s*@version\s+([^\s]+)\s*$", re.MULTILINE)


def decode_content(data: bytes, content_type: str) -> str:
    charset = "utf-8-sig"
    match = re.search(r"charset=([^;\s]+)", content_type or "", re.IGNORECASE)
    if match:
        charset = match.group(1)
    return data.decode(charset)


def download(url: str) -> tuple[bytes, str]:
    request = Request(
        url,
        headers={
            "User-Agent": "Tampermonkey-script-sync/1.0",
            "Accept": "text/javascript, application/javascript, text/plain, */*",
        },
    )
    with urlopen(request, timeout=60) as response:
        return response.read(), response.headers.get("Content-Type", "")


def validate_script(text: str) -> str:
    if "// ==UserScript==" not in text or "// ==/UserScript==" not in text:
        raise ValueError("downloaded file is not a valid userscript")

    match = VERSION_RE.search(text)
    if not match:
        raise ValueError("downloaded userscript does not contain @version")

    return match.group(1)


def write_github_output(version: str, changed: bool) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT")
    if not output_path:
        return

    with open(output_path, "a", encoding="utf-8") as output:
        output.write(f"version={version}\n")
        output.write(f"changed={str(changed).lower()}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync a ScriptCat userscript to a local file.")
    parser.add_argument("--url", required=True, help="ScriptCat userscript URL")
    parser.add_argument("--output", required=True, help="Output userscript path")
    args = parser.parse_args()

    try:
        data, content_type = download(args.url)
        text = decode_content(data, content_type)
        version = validate_script(text)
    except (HTTPError, URLError, TimeoutError, UnicodeDecodeError, ValueError) as exc:
        print(f"sync failed: {exc}", file=sys.stderr)
        return 1

    output_path = Path(args.output)
    previous = output_path.read_bytes() if output_path.exists() else None
    changed = previous != data

    if changed:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(data)

    write_github_output(version, changed)
    status = "updated" if changed else "already up to date"
    print(f"{status}: {output_path} @ {version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
