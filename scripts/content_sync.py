#!/usr/bin/env python3
"""Build the complete card dataset from the checked-in, offline source snapshot.

Usage:
  python3 scripts/content_sync.py               # deterministic, no network
  python3 scripts/content_sync.py --refresh     # fetch a fresh upstream snapshot
  python3 scripts/content_sync.py --from PATH   # import an existing git checkout
"""

import argparse
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--refresh", action="store_true", help="Fetch the upstream public GitHub repository before generating cards.")
parser.add_argument("--from", dest="checkout", help="Import an existing upstream git checkout.")
arguments = parser.parse_args()
node = shutil.which("node")
if not node:
    parser.error("Node.js is required to generate the source dataset.")
script = "sync-content.mjs" if arguments.refresh or arguments.checkout else "content-build.mjs"
command = [node, str(ROOT / "scripts" / script)]
if arguments.checkout:
    command.extend(["--from", arguments.checkout])
subprocess.run(command, cwd=ROOT, check=True)
