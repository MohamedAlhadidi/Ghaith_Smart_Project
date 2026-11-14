#!/usr/bin/env python3
"""Resumable, bounded Claude Code project-manager launcher (stdlib only).

Run from the cloned/extracted project; it is not started automatically by this package.
Requires Claude Code >= 2.1.314 and a functioning Linux Bash sandbox for unattended execution.
"""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import re
import subprocess
import sys
import time

DEFAULTS = {
    "max_turns_per_cycle": 28,
    "max_budget_usd_per_cycle": 2.0,
    "cycle_timeout_minutes": 55,
    "idle_seconds_between_cycles": 15,
    "retry_delay_seconds": 90,
    "max_consecutive_failures": 5,
    "max_no_progress_cycles": 3,
    "max_cycles_per_calendar_day": 8,
    "pause_poll_seconds": 60,
    "tools": "Read,Edit,Write,Glob,Grep,Bash,Agent",
    "require_sandbox": True,
    "min_claude_version": "2.1.314",
    "max_estimated_usd_per_day": 12.0,
}

PROMPT = """أنت الوكيل مدير المشروع الذكي. اقرأ CLAUDE.md وagents/SMART_PROJECT_MANAGER.md وسياسة الألعاب والبرومبتات وملفات الحالة.
مهمتك في هذه الدورة: اختر أعلى مهمة جاهزة في tasks/queue.json ونفذ جزءًا قابلًا للاختبار عمليًا. قدّم أولوية للرياضيات والإنجليزية وألعابها المكثفة الموثقة بالمنهج. لا تتوقف عند التخطيط ولا تختلق دروسًا أو ملفات كتب غير متاحة.
عند نهاية الدورة وثق أوامر الاختبارات التي نُفذت ونتائجها الحقيقية، وحدث docs/PROJECT_LEDGER.md وdocs/RESUME.md وtasks/queue.json وسجل العوائق، ثم اكتب ملخصًا قصيرًا. لا تعلن اكتمال المشروع إلا بعد اجتياز بوابات القبول.
"""


def atomic_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def load_config(root):
    data = dict(DEFAULTS)
    path = root / "config" / "runner.json"
    if path.is_file():
        local = json.loads(path.read_text(encoding="utf-8"))
        unknown = set(local) - set(data)
        if unknown:
            raise ValueError(f"Unknown runner config entries: {sorted(unknown)}")
        data.update(local)
    if not 1 <= int(data["max_turns_per_cycle"]) <= 150:
        raise ValueError("max_turns_per_cycle outside 1..150")
    if not 0 < float(data["max_budget_usd_per_cycle"]) <= 100:
        raise ValueError("max_budget_usd_per_cycle outside 0..100")
    for field in ("max_consecutive_failures", "max_no_progress_cycles", "max_cycles_per_calendar_day"):
        if not 1 <= int(data[field]) <= 1000:
            raise ValueError(f"{field} must be in 1..1000")
    if not 1 <= int(data["cycle_timeout_minutes"]) <= 240:
        raise ValueError("cycle_timeout_minutes must be in 1..240")
    if not 0 < float(data["max_estimated_usd_per_day"]) <= 1000:
        raise ValueError("max_estimated_usd_per_day must be 0..1000")
    if not isinstance(data["require_sandbox"], bool):
        raise ValueError("require_sandbox must be bool")
    if not re.fullmatch(r"\d+\.\d+\.\d+", str(data["min_claude_version"])):
        raise ValueError("Invalid min_claude_version")
    return data


def flag_in_help(flag, help_text):
    """True if `flag` is documented in `claude --help`.

    Claude Code 2.1.325 documents the file variant of a flag only in combined
    form, e.g. `--append-system-prompt[-file]`, so a literal search fails.
    """
    if re.search(re.escape(flag) + r"(?![\w-])", help_text):
        return True
    if flag.endswith("-file"):
        return (flag[: -len("-file")] + "[-file]") in help_text
    return False


def preflight_cli(exe, cfg):
    """Do not spend tokens if CLI/version/required flags/sandbox tools are unavailable."""
    result = subprocess.run([exe, "--version"], text=True, capture_output=True, timeout=20)
    if result.returncode != 0:
        raise RuntimeError("Claude CLI --version failed: " + result.stderr[:300])
    m = re.search(r"(\d+\.\d+\.\d+)", result.stdout)
    if not m or tuple(map(int,m.group(1).split('.'))) < tuple(map(int,cfg['min_claude_version'].split('.'))):
        raise RuntimeError("Claude Code >= " + cfg['min_claude_version'] + " required; found " + result.stdout.strip())
    help_result = subprocess.run([exe, "--help"], text=True, capture_output=True, timeout=20)
    help_text = help_result.stdout + help_result.stderr
    required = ("--tools", "--permission-mode", "--permission-prompts", "--append-system-prompt-file", "--max-budget-usd", "--output-format")
    missing = [flag for flag in required if not flag_in_help(flag, help_text)]
    if help_result.returncode != 0 or missing:
        raise RuntimeError("Claude CLI required flags unsupported: " + ', '.join(missing))
    if cfg['require_sandbox'] and (sys.platform != 'linux' or not shutil.which('bwrap') or not shutil.which('socat')):
        raise RuntimeError("Sandbox required: Linux with bubblewrap and socat must be installed; check `claude /sandbox` locally")
    return m.group(1)


def is_complete(root):
    check = root / "scripts" / "check_release.py"
    if not check.is_file():
        return False
    result = subprocess.run([sys.executable, str(check), "--root", str(root), "--quiet"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return result.returncode == 0


def queue_state(root):
    """Returns (ready_count, not_done_count, blocked_count), best-effort."""
    path = root / "tasks" / "queue.json"
    if not path.is_file():
        return (1, 1, 0)  # let agent initialize missing state
    try:
        tasks = json.loads(path.read_text(encoding="utf-8")).get("tasks", [])
    except Exception:
        return (1, 1, 0)  # let agent fix corrupt state
    done = {t.get("id") for t in tasks if t.get("status") == "done"}
    pending = [t for t in tasks if t.get("status") != "done"]
    ready = [t for t in pending if t.get("status") in ("pending", "ready", "retry", "in_progress", "needs_review", "verified")
             and not (t.get("status") == "needs_review" and t.get("human_review_required"))
             and all(x in done for x in t.get("depends_on", []))]
    blocked = [t for t in pending if t.get("status") in ("blocked", "blocked_external")
               or (t.get("status") == "needs_review" and t.get("human_review_required"))]
    return len(ready), len(pending), len(blocked)


def done_tasks(root):
    try:
        tasks = json.loads((root / 'tasks' / 'queue.json').read_text(encoding='utf-8')).get('tasks', [])
        return {str(t['id']) for t in tasks if t.get('status') == 'done' and t.get('id')}
    except (OSError, ValueError, KeyError):
        return set()


def daily_usage(root, day, cfg):
    """Conservative cap: every started cycle counts, even after crash or missing CLI price."""
    logdir = root / 'logs' / 'pm'
    starts = list(logdir.glob(f'cycle-{day}-*.started.json'))
    completed = list(logdir.glob(f'cycle-{day}-*.meta.json'))
    starts_map = {p.name.replace('.started.json', '') for p in starts}
    completed_map = {p.name.replace('.meta.json', '') for p in completed}
    total_cycles = len(starts_map | completed_map)
    # Conservative ceiling counts full per-cycle budgets; never trust missing cost fields.
    charged_ceiling = total_cycles * float(cfg['max_budget_usd_per_cycle'])
    return total_cycles, charged_ceiling


def progress_fingerprint(root):
    """Best-effort meaningful artifact change detection; not a content quality test.

    Exclude status/ledger/heartbeats so editing those alone cannot count as progress.
    """
    h = hashlib.sha256()
    paths = ("src", "apps", "backend", "frontend", "client", "server", "content", "assets", "deploy", "docs", "release", "reports", "scripts", "tests")
    excluded_files = {"RESUME.md", "PROJECT_LEDGER.md", "RUN_STATUS.md", "pm_runner.py", "check_release.py"}
    excluded_parts = {"node_modules", ".git", ".venv", "bin", "obj", "dist", "__pycache__", "logs"}
    for folder in paths:
        base = root / folder
        if not base.exists():
            continue
        candidates = [base] if base.is_file() else sorted(x for x in base.rglob("*") if x.is_file())
        for path in candidates:
            if path.name in excluded_files or any(part in excluded_parts for part in path.relative_to(root).parts):
                continue
            try:
                st = path.stat()
                relative = str(path.relative_to(root))
                h.update(relative.encode("utf-8"))
                h.update(str(st.st_size).encode("ascii"))
                if st.st_size <= 2_000_000:
                    h.update(hashlib.sha256(path.read_bytes()).digest())
                else:
                    h.update(str(st.st_mtime_ns).encode("ascii"))
            except (OSError, ValueError):
                continue
    return h.hexdigest()


def build_command(root, cfg, claude_path):
    return [claude_path, "-p", PROMPT,
            "--append-system-prompt-file", str(root / "agents" / "SMART_PROJECT_MANAGER.md"),
            "--permission-mode", "auto",
            "--permission-prompts", "none",
            "--tools", cfg["tools"],
            "--max-turns", str(cfg["max_turns_per_cycle"]),
            "--max-budget-usd", str(cfg["max_budget_usd_per_cycle"]),
            "--output-format", "json"]


def one_cycle(root, cfg, exe, cycle):
    folder = root / "logs" / "pm"
    folder.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().astimezone().strftime("%Y%m%d-%H%M%S-%f")
    prefix = folder / f"cycle-{stamp}-{cycle:05d}"
    outpath = prefix.with_suffix(".stdout.json")
    errpath = prefix.with_suffix(".stderr.log")
    started = time.time()
    baseline_fingerprint = progress_fingerprint(root)
    baseline_tasks = done_tasks(root)
    timeout = int(cfg["cycle_timeout_minutes"] * 60)
    info = {"cycle": cycle, "start": dt.datetime.now().astimezone().isoformat(), "status": "running", "stdout": str(outpath.relative_to(root)), "stderr": str(errpath.relative_to(root))}
    atomic_json(prefix.with_suffix(".started.json"), info)
    atomic_json(folder / "heartbeat.json", info)
    cmd = build_command(root, cfg, exe)
    with outpath.open("wb") as stdout, errpath.open("wb") as stderr:
        proc = subprocess.Popen(cmd, cwd=root, stdout=stdout, stderr=stderr, start_new_session=True)
        timed_out = False
        try:
            while proc.poll() is None:
                if (root / "control" / "STOP").exists() or time.time() - started > timeout:
                    timed_out = time.time() - started > timeout
                    os.killpg(proc.pid, signal.SIGTERM)
                    try:
                        proc.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        os.killpg(proc.pid, signal.SIGKILL)
                        proc.wait()
                    break
                atomic_json(folder / "heartbeat.json", {**info, "last_heartbeat": dt.datetime.now().astimezone().isoformat(), "pid": proc.pid})
                time.sleep(8)
        except KeyboardInterrupt:
            os.killpg(proc.pid, signal.SIGTERM)
            proc.wait(timeout=15)
            raise
    status = {**info, "end": dt.datetime.now().astimezone().isoformat(), "duration_seconds": int(time.time() - started), "exit_code": proc.returncode, "timed_out": timed_out}
    status["artifacts_changed"] = progress_fingerprint(root) != baseline_fingerprint
    status["new_done_task_ids"] = sorted(done_tasks(root) - baseline_tasks)
    status["claimed_progress_needs_review"] = status["artifacts_changed"] and not bool(status["new_done_task_ids"])
    try:
        result = json.loads(outpath.read_text(encoding="utf-8"))
        if isinstance(result, dict):
            status["is_error"] = result.get("is_error", False)
            status["permission_denials_count"] = len(result.get("permission_denials") or [])
            status["reported_total_cost_usd"] = result.get("total_cost_usd")
    except Exception:
        status["json_output_unreadable"] = True
    cli_ok = (proc.returncode == 0 and not timed_out and not status.get("is_error", False)
              and not status.get("json_output_unreadable", False)
              and status.get("permission_denials_count", 0) == 0)
    status["status"] = ("ok" if cli_ok and status["artifacts_changed"] and status["new_done_task_ids"] else
                        "no_progress" if cli_ok else "failed")
    atomic_json(prefix.with_suffix(".meta.json"), status)
    atomic_json(folder / "heartbeat.json", status)
    print(f"[GAPD] cycle={cycle} status={status['status']} exit={proc.returncode} time={status['duration_seconds']}s log={outpath}", flush=True)
    return status


def main():
    p = argparse.ArgumentParser(description="Ghaith autonomous project manager runner")
    p.add_argument("--project", type=Path, default=Path.cwd())
    p.add_argument("--dry-run", action="store_true", help="Validate configuration and print planned CLI invocation only")
    p.add_argument("--once", action="store_true", help="Run a single cycle")
    args = p.parse_args()
    os.umask(0o077)  # logs may contain task/source data and must not be world-readable
    root = args.project.expanduser().resolve()
    if not (root / "agents" / "SMART_PROJECT_MANAGER.md").is_file():
        p.error("Not a Ghaith PM package root: agents/SMART_PROJECT_MANAGER.md missing")
    cfg = load_config(root)
    claude_path = os.environ.get("CLAUDE_BIN") or shutil.which("claude")
    if args.dry_run:
        print(json.dumps({"root": str(root), "binary": claude_path or "not found", "config": cfg, "command": build_command(root, cfg, claude_path or "claude")}, indent=2, ensure_ascii=False))
        return 0
    if not claude_path:
        print("Claude Code not on PATH. Try export PATH=\"$HOME/.local/bin:$PATH\"", file=sys.stderr)
        return 3
    try:
        ver = preflight_cli(claude_path, cfg)
        print(f"[GAPD] Preflight: CLI {ver}, sandbox required={cfg['require_sandbox']}", flush=True)
    except (RuntimeError, subprocess.SubprocessError, OSError) as e:
        print(f"[GAPD] Preflight failed: {e}", file=sys.stderr)
        return 6
    # Prevent two managers from concurrently editing the same project.
    lockfile = root / "logs" / "pm" / "runner.lock"
    lockfile.parent.mkdir(parents=True, exist_ok=True)
    with lockfile.open("a+") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Manager already running for this project", file=sys.stderr)
            return 4
        errors = 0
        no_progress = 0
        cycle = 0
        while True:
            if (root / "control" / "STOP").exists():
                print("[GAPD] STOP flag detected; exiting")
                return 0
            if is_complete(root):
                print("[GAPD] Independent release gate passed; project completed")
                return 0
            if (root / "control" / "PAUSE").exists():
                time.sleep(cfg["pause_poll_seconds"])
                continue
            ready, outstanding, blocked = queue_state(root)
            if ready == 0:
                if outstanding == 0:
                    print("[GAPD] All queue tasks marked done, but independent release gate did not pass. Check release and tests.", file=sys.stderr)
                    return 2
                if blocked > 0:
                    print("[GAPD] No ready tasks; external block(s) in queue. Rechecking in 10 minutes without consuming tokens.")
                    if args.once:
                        return 0
                    time.sleep(600)
                    continue
                print("[GAPD] Queue dependency deadlock: no ready tasks. Needs repair.", file=sys.stderr)
                return 2
            today = dt.datetime.now().astimezone().strftime("%Y%m%d")
            daily, committed_estimate = daily_usage(root, today, cfg)
            if committed_estimate + float(cfg["max_budget_usd_per_cycle"]) > float(cfg["max_estimated_usd_per_day"]):
                print("[GAPD] Conservative estimated daily spend ceiling reached; waiting until the next local date.")
                if args.once: return 0
                time.sleep(600)
                continue
            if daily >= cfg["max_cycles_per_calendar_day"]:
                print("[GAPD] Daily cycle cap reached. Resuming automatically next calendar day.")
                if args.once:
                    return 0
                time.sleep(600)
                continue
            cycle += 1
            try:
                result = one_cycle(root, cfg, claude_path, cycle)
                outcome = result["status"]
            except Exception as exc:
                print(f"[GAPD] runner error: {exc}", file=sys.stderr)
                outcome = "failed"
            success = outcome == "ok"
            no_progress = no_progress + 1 if outcome == "no_progress" else 0
            errors = 0 if success else errors + 1
            if args.once:
                return 0 if success else 2
            if no_progress >= cfg["max_no_progress_cycles"]:
                print("[GAPD] No meaningful artifacts changed across cycles; paused to prevent quota drain. Inspect logs/pm.", file=sys.stderr)
                return 5
            if errors >= cfg["max_consecutive_failures"]:
                print("[GAPD] Repeated failures: stopped to avoid infinite quota drain; inspect logs/pm and credentials.", file=sys.stderr)
                return 2
            delay = cfg["idle_seconds_between_cycles"] if success else min(1800, cfg["retry_delay_seconds"] * 2 ** max(0, errors - 1))
            time.sleep(delay)


if __name__ == "__main__":
    sys.exit(main())
