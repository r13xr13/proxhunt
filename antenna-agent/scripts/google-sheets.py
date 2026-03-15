#!/usr/bin/env python3
"""Google Sheets wrapper for Antenna"""

import json
import sys
import os
import gspread
from gspread.exceptions import SpreadsheetNotFound

CREDS_FILE = os.path.expanduser("~/.antenna/credentials/google-sheets.json")


def get_client():
    try:
        gc = gspread.service_account(filename=CREDS_FILE)
        return gc
    except FileNotFoundError:
        return {
            "error": f"Credentials not found at {CREDS_FILE}. Set up at Google Cloud Console."
        }
    except Exception as e:
        return {"error": str(e)}


def list_sheets(args):
    gc = get_client()
    if isinstance(gc, dict) and "error" in gc:
        return gc

    try:
        spreadsheets = gc.list_spreadsheet_files()
        return {"count": len(spreadsheets), "sheets": spreadsheets[:20]}
    except Exception as e:
        return {"error": str(e)}


def read_sheet(args):
    gc = get_client()
    if isinstance(gc, dict) and "error" in gc:
        return gc

    title = args.get("title", "")
    sheet = args.get("sheet", "Sheet1")

    if not title:
        return {"error": "title is required"}

    try:
        wks = gc.open(title).sheet1
        if sheet != "Sheet1":
            wks = gc.open(title).worksheet(sheet)
        values = wks.get_all_values()
        return {
            "title": title,
            "sheet": sheet,
            "rows": len(values),
            "data": values[:50],
        }
    except SpreadsheetNotFound:
        return {"error": f"Spreadsheet '{title}' not found"}
    except Exception as e:
        return {"error": str(e)}


def write_sheet(args):
    gc = get_client()
    if isinstance(gc, dict) and "error" in gc:
        return gc

    title = args.get("title", "")
    data = args.get("data", [])
    sheet = args.get("sheet", "Sheet1")

    if not title:
        return {"error": "title is required"}
    if not data:
        return {"error": "data is required"}

    try:
        wks = gc.open(title).sheet1
        if sheet != "Sheet1":
            wks = gc.open(title).worksheet(sheet)
        wks.update(data, "A1")
        return {"success": True, "title": title, "rows": len(data)}
    except SpreadsheetNotFound:
        return {"error": f"Spreadsheet '{title}' not found"}
    except Exception as e:
        return {"error": str(e)}


def create_sheet(args):
    gc = get_client()
    if isinstance(gc, dict) and "error" in gc:
        return gc

    title = args.get("title", "")

    if not title:
        return {"error": "title is required"}

    try:
        spreadsheet = gc.create(title)
        return {"success": True, "title": title, "url": spreadsheet.url}
    except Exception as e:
        return {"error": str(e)}


COMMANDS = {
    "list": list_sheets,
    "read": read_sheet,
    "write": write_sheet,
    "create": create_sheet,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: google-sheets.py <command> [args...]"}))
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
