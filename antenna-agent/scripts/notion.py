#!/usr/bin/env python3
"""Notion wrapper for Antenna - Notes, Databases, Todos"""

import json
import sys
import os
from notion_client import Client

TOKEN_FILE = os.path.expanduser("~/.antenna/.notion_token")


def get_client():
    try:
        with open(TOKEN_FILE) as f:
            token = f.read().strip()
        if not token:
            return {
                "error": f"No token in {TOKEN_FILE}. Get at notion.so/my-integrations"
            }
        return Client(auth=token)
    except FileNotFoundError:
        return {
            "error": f"Token not found. Get at notion.so/my-integrations and save to {TOKEN_FILE}"
        }
    except Exception as e:
        return {"error": str(e)}


def list_databases(args):
    client = get_client()
    if isinstance(client, dict):
        return client

    try:
        search = client.search(
            filter={"property": "object", "value": "database"}, page_size=50
        )
        dbs = [
            {
                "id": r["id"],
                "title": r["title"][0]["plain_text"] if r.get("title") else "Untitled",
            }
            for r in search.get("results", [])
        ]
        return {"count": len(dbs), "databases": dbs}
    except Exception as e:
        return {"error": str(e)}


def list_pages(args):
    client = get_client()
    if isinstance(client, dict):
        return client

    try:
        search = client.search(
            filter={"property": "object", "value": "page"}, page_size=50
        )
        pages = [
            {
                "id": r["id"],
                "title": r["properties"]
                .get("title", {})
                .get("title", [{}])[0]
                .get("plain_text", "Untitled"),
            }
            for r in search.get("results", [])
        ]
        return {"count": len(pages), "pages": pages}
    except Exception as e:
        return {"error": str(e)}


def query_database(args):
    client = get_client()
    if isinstance(client, dict):
        return client

    db_id = args.get("id", "")
    if not db_id:
        return {"error": "database id is required"}

    try:
        rows = client.databases.query(database_id=db_id)
        results = []
        for r in rows.get("results", []):
            props = {}
            for k, v in r.get("properties", {}).items():
                if v.get("type") == "title":
                    props[k] = v.get("title", [{}])[0].get("plain_text", "")
                elif v.get("type") == "rich_text":
                    props[k] = v.get("rich_text", [{}])[0].get("plain_text", "")
                elif v.get("type") == "checkbox":
                    props[k] = v.get("checkbox", False)
                elif v.get("type") == "date":
                    props[k] = v.get("date", {}).get("start", "")
            props["id"] = r["id"]
            results.append(props)
        return {"count": len(results), "rows": results}
    except Exception as e:
        return {"error": str(e)}


def create_page(args):
    client = get_client()
    if isinstance(client, dict):
        return client

    parent_id = args.get("parent_id", "")
    title = args.get("title", "")
    content = args.get("content", "")

    if not title:
        return {"error": "title is required"}

    try:
        if parent_id:
            parent = {"database_id": parent_id}
        else:
            parent = {"page_id": os.environ.get("NOTION_PAGE_ID", "")}

        props = {"title": {"title": [{"text": {"content": title}}]}}

        page = client.pages.create(parent=parent, properties=props)

        if content:
            client.blocks.children.append(
                block_id=page["id"],
                children=[
                    {
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {"rich_text": [{"text": {"content": content}}]},
                    }
                ],
            )

        return {"success": True, "id": page["id"], "url": page["url"]}
    except Exception as e:
        return {"error": str(e)}


def add_todo(args):
    client = get_client()
    if isinstance(client, dict):
        return client

    db_id = args.get("database_id", "")
    title = args.get("title", "")
    done = args.get("done", False)

    if not db_id:
        return {"error": "database_id is required (use notion_list_databases to find)"}
    if not title:
        return {"error": "title is required"}

    try:
        props = {
            "Name": {"title": [{"text": {"content": title}}]},
            "Done": {"checkbox": done},
        }
        page = client.pages.create(parent={"database_id": db_id}, properties=props)
        return {"success": True, "id": page["id"]}
    except Exception as e:
        return {"error": str(e)}


def update_todo(args):
    client = get_client()
    if isinstance(client, dict):
        return client

    page_id = args.get("id", "")
    done = args.get("done", None)

    if not page_id:
        return {"error": "page id is required"}

    try:
        props = {}
        if done is not None:
            props["Done"] = {"checkbox": done}

        if props:
            client.pages.update(page_id=page_id, properties=props)
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}


COMMANDS = {
    "list_databases": list_databases,
    "list_pages": list_pages,
    "query": query_database,
    "create_page": create_page,
    "add_todo": add_todo,
    "update_todo": update_todo,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: notion.py <command> [args...]"}))
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
