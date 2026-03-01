"""
YouTube Music Song Rating App — Setup Wizard (CLI fallback)

NOTE: You can now run setup directly in the browser!
      Just start the server with 'python server.py' and open http://localhost:5000.
      If authentication is missing, the app will walk you through setup automatically.

      This CLI script is kept as a fallback for headless/terminal-only environments.
"""

import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


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


def step_install_cloudflared():
    print("─── Step 2: Checking for Cloudflare Tunnel (cloudflared) ───")
    print()

    # Check if cloudflared is already available
    try:
        result = subprocess.run(
            ["cloudflared", "--version"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            version = result.stdout.strip().split("\n")[0]
            print(f"  ✓ cloudflared already installed: {version}\n")
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    print("  cloudflared not found. Attempting to install via winget...")
    print()

    # Try installing via winget
    try:
        subprocess.check_call(
            ["winget", "install", "--id", "Cloudflare.cloudflared",
             "--accept-package-agreements", "--accept-source-agreements"],
            cwd=str(BASE_DIR),
        )
        print("\n  ✓ cloudflared installed successfully.")
        print("  ⚠ You may need to restart your terminal for 'cloudflared' to be on PATH.\n")
        return True
    except FileNotFoundError:
        print("  winget not found. Please install cloudflared manually:")
        print("    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/")
        print()
        skip = input("  Skip this step and continue anyway? (Y/n): ").strip().lower()
        return skip != "n"
    except subprocess.CalledProcessError:
        print("\n  ✗ winget install failed. Please install cloudflared manually:")
        print("    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/")
        print()
        skip = input("  Skip this step and continue anyway? (Y/n): ").strip().lower()
        return skip != "n"


def main():
    print_header()

    steps = [
        ("Install dependencies", step_install_deps),
        ("Install cloudflared", step_install_cloudflared),
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
    print("  If this is your first time, the app will walk you")
    print("  through YouTube Music authentication automatically.")
    print("=" * 58)
    print()


if __name__ == "__main__":
    main()
