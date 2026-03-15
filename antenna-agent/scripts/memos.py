#!/usr/bin/env python3
"""Memos wrapper for Antenna - Open source self-hosted notes"""

import json
import sys
import os
import requests
import subprocess

MEMOS_URL = os.environ.get("MEMOS_URL", "http://localhost:5230")


def ensure_memos_running():
    """Start memos container if not running"""
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True
        )
        if "memos" not in result.stdout:
            subprocess.run(["docker", "start", "memos"], capture_output=True)
            import time

            time.sleep(2)
    except:
        pass


def get_headers():
    return {"Content-Type": "application/json"}


def login():
    username = os.environ.get("MEMOS_USER", "admin")
    password = os.environ.get("MEMOS_PASSWORD", "admin")

    try:
        r = requests.post(
            f"{MEMOS_URL}/api/v1/auth/signin",
            json={"username": username, "password": password},
            headers=get_headers(),
        )
        if r.status_code == 200:
            return r.json().get("data", {}).get("accessToken")
        return None
    except:
        return None


TOKEN = login()


def list_memos(args):
    ensure_memos_running()
    if not TOKEN:
        return {"error": "Failed to login to Memos"}

    try:
        r = requests.get(
            f"{MEMOS_URL}/api/v1/memos",
            headers={**get_headers(), "Authorization": f"Bearer {TOKEN}"},
        )
        if r.status_code == 200:
            memos = r.json().get("data", [])
            return {
                "count": len(memos),
                "memos": [
                    {
                        "id": m["id"],
                        "content": m.get("content", "")[:100],
                        "created": m.get("createdAt"),
                    }
                    for m in memos
                ],
            }
        return {"error": r.text}
    except Exception as e:
        return {"error": str(e)}


def create_memo(args):
    ensure_memos_running()
    if not TOKEN:
        return {"error": "Failed to login to Memos"}

    content = args.get("content", "")
    if not content:
        return {"error": "content is required"}

    try:
        r = requests.post(
            f"{MEMOS_URL}/api/v1/memos",
            json={"content": content},
            headers={**get_headers(), "Authorization": f"Bearer {TOKEN}"},
        )
        if r.status_code == 200:
            m = r.json().get("data", {})
            return {
                "success": True,
                "id": m.get("id"),
                "url": f"{MEMOS_URL}/m/{m.get('uid')}",
            }
        return {"error": r.text}
    except Exception as e:
        return {"error": str(e)}


def update_memo(args):
    ensure_memos_running()
    if not TOKEN:
        return {"error": "Failed to login to Memos"}

    memo_id = args.get("id", "")
    content = args.get("content", "")

    if not memo_id:
        return {"error": "id is required"}
    if not content:
        return {"error": "content is required"}

    try:
        r = requests.patch(
            f"{MEMOS_URL}/api/v1/memos/{memo_id}",
            json={"content": content},
            headers={**get_headers(), "Authorization": f"Bearer {TOKEN}"},
        )
        if r.status_code == 200:
            return {"success": True}
        return {"error": r.text}
    except Exception as e:
        return {"error": str(e)}


def delete_memo(args):
    ensure_memos_running()
    if not TOKEN:
        return {"error": "Failed to login to Memos"}

    memo_id = args.get("id", "")
    if not memo_id:
        return {"error": "id is required"}

    try:
        r = requests.delete(
            f"{MEMOS_URL}/api/v1/memos/{memo_id}",
            headers={**get_headers(), "Authorization": f"Bearer {TOKEN}"},
        )
        if r.status_code == 200:
            return {"success": True}
        return {"error": r.text}
    except Exception as e:
        return {"error": str(e)}


def search_memos(args):
    ensure_memos_running()
    if not TOKEN:
        return {"error": "Failed to login to Memos"}

    query = args.get("query", "")
    if not query:
        return {"error": "query is required"}

    try:
        r = requests.get(
            f"{MEMOS_URL}/api/v1/memos",
            headers={**get_headers(), "Authorization": f"Bearer {TOKEN}"},
        )
        if r.status_code == 200:
            memos = r.json().get("data", [])
            filtered = [
                m for m in memos if query.lower() in m.get("content", "").lower()
            ]
            return {
                "count": len(filtered),
                "memos": [
                    {"id": m["id"], "content": m.get("content", "")[:100]}
                    for m in filtered
                ],
            }
        return {"error": r.text}
    except Exception as e:
        return {"error": str(e)}


COMMANDS = {
    "list": list_memos,
    "create": create_memo,
    "update": update_memo,
    "delete": delete_memo,
    "search": search_memos,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: memos.py <command> [args...]"}))
        sys.exit(1)

    cmd = sys.argv[1]
    args = {}

    if len(sys.argv) > 2:
        try:
            args = json.loads(sys.argv[2])
        except:
            args = {}

    if cmd in COMMANDS:
        result = COMMANDS[cmd](args)
    else:
        result = {"error": f"Unknown command: {cmd}"}

    print(json.dumps(result))
