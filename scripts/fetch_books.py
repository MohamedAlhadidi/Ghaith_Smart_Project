#!/usr/bin/env python3
"""Download the official MOE grade-2 books listed in docs/BOOK_SOURCES.json,
record SHA-256 / page counts in docs/BOOK_INVENTORY.csv, or verify local copies.

Book PDFs are copyrighted MOE material: they are stored under sources/books/
(git-ignored) and are never committed or redistributed. Only metadata is tracked.

PDF content is untrusted data: this script only hashes it and reads page metadata
via `pdfinfo`; it never executes or interprets instructions found inside a book.

Usage:
  python3 scripts/fetch_books.py                      # download all missing books, write inventory
  python3 scripts/fetch_books.py --only MATH-S1-STU   # download selected books only
  python3 scripts/fetch_books.py --verify   # check local files against the inventory (no network)
"""
import argparse
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "docs" / "BOOK_SOURCES.json"
INVENTORY = ROOT / "docs" / "BOOK_INVENTORY.csv"
BOOK_DIR = ROOT / "sources" / "books"
MAX_BYTES = 400 * 1024 * 1024
FIELDS = [
    "book_id", "subject", "semester", "kind", "in_child_scope", "listed_title",
    "source_page_url", "pdf_url", "local_file", "download_status", "bytes", "sha256",
    "pdf_pages", "pdf_creation_date", "pdf_producer", "edition_verified", "license_status",
    "content_status", "retrieved_at", "notes",
]


def sha256_file(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def pdf_info(path):
    """Return (pages, creation_date, producer) using poppler's pdfinfo, or blanks."""
    if not shutil.which("pdfinfo"):
        return "", "", ""
    proc = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True, timeout=120)
    info = {}
    for line in proc.stdout.splitlines():
        key, _, value = line.partition(":")
        info[key.strip()] = value.strip()
    return info.get("Pages", ""), info.get("CreationDate", ""), info.get("Producer", "")


def download(url, dest):
    """Download to <dest>.part, resuming a previous partial download when the server allows."""
    tmp = dest.with_suffix(".part")
    offset = tmp.stat().st_size if tmp.is_file() else 0
    headers = {"User-Agent": "ghaith-curriculum-inventory/1.0"}
    if offset:
        headers["Range"] = f"bytes={offset}-"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as resp:
        if offset and resp.status != 206:  # server ignored the range: restart
            offset = 0
        ctype = resp.headers.get("Content-Type", "")
        with tmp.open("ab" if offset else "wb") as out:
            total = offset
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_BYTES:
                    raise RuntimeError(f"file exceeds {MAX_BYTES} bytes")
                out.write(chunk)
    with tmp.open("rb") as f:
        if f.read(5) != b"%PDF-":
            tmp.unlink(missing_ok=True)
            raise RuntimeError(f"not a PDF (content-type {ctype!r})")
    tmp.replace(dest)


def load_inventory():
    if not INVENTORY.is_file():
        return {}
    with INVENTORY.open(encoding="utf-8", newline="") as f:
        return {row["book_id"]: row for row in csv.DictReader(f)}


def write_inventory(rows):
    INVENTORY.parent.mkdir(parents=True, exist_ok=True)
    tmp = INVENTORY.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    tmp.replace(INVENTORY)


def process_book(book, prev, selected):
    """Return the inventory row for one book; download it only if selected."""
    dest = BOOK_DIR / f"{book['book_id']}.pdf"
    row = {k: book.get(k, "") for k in FIELDS if k in book}
    row.update({
        "local_file": str(dest.relative_to(ROOT)),
        "edition_verified": prev.get("edition_verified", "false"),
        "license_status": prev.get("license_status", "moe_public_download_personal_use_unconfirmed"),
        "content_status": prev.get("content_status", "discovered"),
        "notes": prev.get("notes", ""),
    })
    for key in ("download_status", "bytes", "sha256", "pdf_pages", "pdf_creation_date", "pdf_producer", "retrieved_at"):
        row[key] = prev.get(key, "")
    if not selected and not dest.is_file():
        row["download_status"] = row["download_status"] or "not_downloaded"
        return row, None
    try:
        if not dest.is_file():
            download(book["pdf_url"], dest)
            row["retrieved_at"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        digest = sha256_file(dest)
        if prev.get("sha256") and prev["sha256"] != digest:
            row["notes"] = (row["notes"] + " | SHA-256 changed vs previous inventory: re-review required").strip(" |")
            row["content_status"] = "discovered"
            row["edition_verified"] = "false"
        pages, created, producer = pdf_info(dest)
        row.update({"download_status": "downloaded", "bytes": dest.stat().st_size, "sha256": digest,
                    "pdf_pages": pages, "pdf_creation_date": created, "pdf_producer": producer})
        return row, None
    except Exception as exc:  # record and continue; never invent data for a failed book
        row.update({"download_status": f"failed: {exc}"[:200], "bytes": "", "sha256": "", "pdf_pages": "",
                    "pdf_creation_date": "", "pdf_producer": "", "retrieved_at": ""})
        return row, exc


def fetch(only, jobs):
    from concurrent.futures import ThreadPoolExecutor

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    known = {b["book_id"] for b in catalog["books"]}
    unknown = set(only) - known
    if unknown:
        print(f"Unknown book ids: {sorted(unknown)}", file=sys.stderr)
        return 2
    previous = load_inventory()
    BOOK_DIR.mkdir(parents=True, exist_ok=True)
    books = catalog["books"]
    with ThreadPoolExecutor(max_workers=max(1, jobs)) as pool:
        futures = [pool.submit(process_book, b, previous.get(b["book_id"], {}), not only or b["book_id"] in only)
                   for b in books]
        results = [f.result() for f in futures]  # keeps catalog order
    failures = 0
    for book, (row, exc) in zip(books, results):
        if exc is not None:
            failures += 1
            print(f"FAIL {book['book_id']:<18} {exc}", file=sys.stderr)
        elif row["download_status"] == "downloaded":
            print(f"OK   {book['book_id']:<18} {row['pdf_pages']:>4} pages  {row['sha256'][:12]}")
    rows = [r for r, _ in results]
    write_inventory(rows)
    done = sum(r["download_status"] == "downloaded" for r in rows)
    print(f"{done}/{len(rows)} books downloaded; {failures} failed; inventory: {INVENTORY.relative_to(ROOT)}")
    return 1 if failures else 0


def verify():
    rows = load_inventory()
    if not rows:
        print("No inventory found", file=sys.stderr)
        return 1
    bad = 0
    for book_id, row in rows.items():
        path = ROOT / row["local_file"]
        if not path.is_file():
            print(f"MISSING {book_id}: {row['local_file']}")
            bad += 1
        elif sha256_file(path) != row["sha256"]:
            print(f"HASH MISMATCH {book_id}")
            bad += 1
    print(f"{len(rows) - bad}/{len(rows)} local books match inventory SHA-256")
    return 1 if bad else 0


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--verify", action="store_true", help="verify local files against inventory only")
    p.add_argument("--only", nargs="*", default=[], metavar="BOOK_ID", help="download only these book ids")
    p.add_argument("--jobs", type=int, default=4, help="parallel downloads (default 4)")
    args = p.parse_args()
    return verify() if args.verify else fetch(args.only, args.jobs)


if __name__ == "__main__":
    sys.exit(main())
