#!/usr/bin/env python3
"""Google Tasks wrapper for Antenna"""

import json
import sys
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

CREDS_FILE = os.path.expanduser("~/.antenna/credentials/google-tasks.json")
TOKEN_FILE = os.path.expanduser("~/.antenna/credentials/google-tasks.token")


def get_service():
    try:
        creds = None
        if os.path.exists(TOKEN_FILE):
            creds = Credentials.from_authorized_user_file(
                TOKEN_FILE, ["https://www.googleapis.com/auth/tasks"]
            )

        if not creds or not creds.valid:
            return {
                "error": f"No valid credentials. Set up at Google Cloud Console with {CREDS_FILE}"
            }

        service = build("tasks", "v1", credentials=creds)
        return service
    except FileNotFoundError:
        return {"error": f"Credentials not found at {TOKEN_FILE}. Run OAuth flow."}
    except Exception as e:
        return {"error": str(e)}


def list_tasks(args):
    service = get_service()
    if isinstance(service, dict) and "error" in service:
        return service

    tasklist_id = args.get("tasklist", "@default")

    try:
        results = service.tasks().list(tasklist=tasklist_id, maxResults=50).execute()
        tasks = results.get("items", [])
        return {
            "count": len(tasks),
            "tasks": [
                {
                    "id": t.get("id"),
                    "title": t.get("title"),
                    "status": t.get("status"),
                    "due": t.get("due"),
                }
                for t in tasks
            ],
        }
    except Exception as e:
        return {"error": str(e)}


def list_tasklists(args):
    service = get_service()
    if isinstance(service, dict) and "error" in service:
        return service

    try:
        results = service.tasklists().list(maxResults=20).execute()
        items = results.get("items", [])
        return {
            "count": len(items),
            "tasklists": [{"id": t.get("id"), "title": t.get("title")} for t in items],
        }
    except Exception as e:
        return {"error": str(e)}


def create_task(args):
    service = get_service()
    if isinstance(service, dict) and "error" in service:
        return service

    title = args.get("title", "")
    tasklist_id = args.get("tasklist", "@default")
    due = args.get("due", "")

    if not title:
        return {"error": "title is required"}

    try:
        task = {"title": title}
        if due:
            task["due"] = due

        result = service.tasks().insert(tasklist=tasklist_id, body=task).execute()
        return {"success": True, "id": result.get("id"), "title": result.get("title")}
    except Exception as e:
        return {"error": str(e)}


def complete_task(args):
    service = get_service()
    if isinstance(service, dict) and "error" in service:
        return service

    task_id = args.get("id", "")
    tasklist_id = args.get("tasklist", "@default")

    if not task_id:
        return {"error": "id is required"}

    try:
        task = service.tasks().get(tasklist=tasklist_id, task=task_id).execute()
        task["status"] = "completed"
        result = (
            service.tasks()
            .update(tasklist=tasklist_id, task=task_id, body=task)
            .execute()
        )
        return {
            "success": True,
            "title": result.get("title"),
            "status": result.get("status"),
        }
    except Exception as e:
        return {"error": str(e)}


def delete_task(args):
    service = get_service()
    if isinstance(service, dict) and "error" in service:
        return service

    task_id = args.get("id", "")
    tasklist_id = args.get("tasklist", "@default")

    if not task_id:
        return {"error": "id is required"}

    try:
        service.tasks().delete(tasklist=tasklist_id, task=task_id).execute()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}


COMMANDS = {
    "list_tasks": list_tasks,
    "list_tasklists": list_tasklists,
    "create": create_task,
    "complete": complete_task,
    "delete": delete_task,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: google-tasks.py <command> [args...]"}))
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
