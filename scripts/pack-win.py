#!/usr/bin/env python3
"""Zip Windows build without the Chromium license page. Stays under GitHub release limits."""
import os
import sys
import zipfile

root = sys.argv[1] if len(sys.argv) > 1 else "dist/win-unpacked"
out = sys.argv[2] if len(sys.argv) > 2 else "dist/Budget-Setup.zip"
skip = {"LICENSES.chromium.html"}

with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        for name in sorted(filenames):
            if name in skip:
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            archive.write(full, rel)

size = os.path.getsize(out)
print(f"{out} {size} bytes ({size / 1024 / 1024:.1f} MiB)")
if size > 100 * 1024 * 1024:
    sys.exit("zip trop gros pour rester confortable")
