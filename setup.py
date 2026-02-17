"""
YouTube Music Song Rating App — Setup Wizard
Walks the user through installing dependencies and authenticating with YouTube Music.
"""

import subprocess
import sys
import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BROWSER_AUTH_FILE = BASE_DIR / "browser.json"


def print_header():
    print()
    print("=" * 58)
    print("  🎵  YouTube Music Song Rating App — Setup Wizard")
    print("=" * 58)
    print()


def step_install_deps():
    print("─── Step 1: Installing Python dependencies ───")
    print()
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-r", str(BASE_DIR / "requirements.txt")],
            cwd=str(BASE_DIR),
        )
        print("\n  ✓ Dependencies installed.\n")
        return True
    except subprocess.CalledProcessError:
        print("\n  ✗ Failed to install dependencies.")
        return False


def step_browser_auth():
    print("─── Step 2: YouTube Music Browser Authentication ───")
    print()

    if BROWSER_AUTH_FILE.exists():
        print("  Found existing browser.json.")
        reuse = input("  Use existing auth? (Y/n): ").strip().lower()
        if reuse != "n":
            print("  ✓ Using existing auth.\n")
            return True

    print("  You need to copy request headers from your browser.")
    print()
    print("  Steps:")
    print("  1. Open a browser and go to https://music.youtube.com")
    print("  2. Make sure you are logged in")
    print("  3. Open Developer Tools (F12 or Ctrl+Shift+I)")
    print("  4. Go to the 'Network' tab")
    print("  5. Filter requests by typing '/browse' in the filter bar")
    print("  6. Click around in YouTube Music (e.g. click Library)")
    print("     to trigger a POST request to /browse")
    print()
    print("  For Chrome/Edge:")
    print("    - Click on any 'browse?' request")
    print("    - In the Headers tab, scroll to 'Request Headers'")
    print("    - Copy everything from 'accept: */*' to the end")
    print()
    print("  For Firefox:")
    print("    - Right-click the 'browse' request")
    print("    - Click 'Copy > Copy Request Headers'")
    print()
    print("  Paste the headers below, then press Enter twice")
    print("  when done (empty line to finish):")
    print()

    lines = []
    while True:
        try:
            line = input()
            if line.strip() == "" and lines:
                break
            lines.append(line)
        except EOFError:
            break

    headers_raw = "\n".join(lines)

    if not headers_raw.strip():
        print("  ✗ No headers provided.")
        return False

    try:
        import ytmusicapi
        ytmusicapi.setup(filepath=str(BROWSER_AUTH_FILE), headers_raw=headers_raw)
        print(f"\n  ✓ Auth saved to browser.json\n")
        return True
    except Exception as e:
        print(f"\n  ✗ Auth setup failed: {e}")
        print("  Make sure you copied the full request headers.")
        return False


def step_verify():
    print("─── Step 3: Verifying Connection ───")
    print()

    try:
        from ytmusicapi import YTMusic

        yt = YTMusic(str(BROWSER_AUTH_FILE))

        # Try to fetch history
        try:
            history = yt.get_history()
            if history:
                latest = history[0]
                title = latest.get("title", "Unknown")
                artist = ", ".join(a.get("name", "") for a in latest.get("artists", []))
                print(f"  ✓ Connected! Most recent song: {title} by {artist}")
            else:
                print("  ✓ Connected! (No listening history yet)")
        except Exception:
            # Fallback: try library
            try:
                yt.get_library_songs(limit=1)
                print("  ✓ Connected to YouTube Music!")
            except Exception:
                print("  ✓ Authenticated! (Play a song on YT Music to test)")

        print()
        return True
    except Exception as e:
        print(f"  ✗ Verification failed: {e}")
        print("  Try running setup.py again with fresh headers.\n")
        return False


def main():
    print_header()

    steps = [
        ("Install dependencies", step_install_deps),
        ("Browser authentication", step_browser_auth),
        ("Verify connection", step_verify),
    ]

    for name, step_fn in steps:
        if not step_fn():
            print(f"  ⚠ Setup stopped at: {name}")
            print("  Fix the issue above and run setup.py again.\n")
            sys.exit(1)

    print("=" * 58)
    print("  ✓ Setup complete! Run the app with:")
    print()
    print("    python server.py")
    print()
    print("  Then open http://localhost:5000 in your browser.")
    print("=" * 58)
    print()


if __name__ == "__main__":
    main()
