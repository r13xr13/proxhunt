#!/usr/bin/env python3
"""
ClawHub Skill Installer
Wraps clawdhub CLI for Antenna integration
"""

import os
import subprocess
import sys

SKILLS_DIR = os.path.expanduser("~/.antenna/workspace/skills")


def run_clawdhub(args):
    """Run clawdhub command"""
    cmd = ["clawdhub", "--workdir", os.path.expanduser("~/.antenna/workspace")] + args
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout + result.stderr


def search(query):
    """Search for skills"""
    return run_clawdhub(["search", query, "--no-input"])


def install(skill_name):
    """Install a skill"""
    return run_clawdhub(["install", skill_name])


def list_installed():
    """List installed skills"""
    return run_clawdhub(["list"])


def inspect(skill_name):
    """Inspect a skill before installing"""
    return run_clawdhub(["inspect", skill_name])


def main():
    if len(sys.argv) < 2:
        print("""
ClawHub Skill Installer
Usage:
  clawhub.py search <query>
  clawhub.py install <skill-name>
  clawhub.py list
  clawhub.py inspect <skill-name>
        """)
        sys.exit(1)

    action = sys.argv[1]

    if action == "search":
        if len(sys.argv) < 3:
            print("Usage: clawhub.py search <query>")
            sys.exit(1)
        print(search(sys.argv[2]))

    elif action == "install":
        if len(sys.argv) < 3:
            print("Usage: clawhub.py install <skill-name>")
            sys.exit(1)
        print(install(sys.argv[2]))

    elif action == "list":
        print(list_installed())

    elif action == "inspect":
        if len(sys.argv) < 3:
            print("Usage: clawhub.py inspect <skill-name>")
            sys.exit(1)
        print(inspect(sys.argv[2]))

    else:
        print(f"Unknown action: {action}")
        sys.exit(1)


if __name__ == "__main__":
    main()
