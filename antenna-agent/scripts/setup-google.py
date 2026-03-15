#!/usr/bin/env python3
"""Google Sheets/Tasks OAuth setup helper"""

import os
import json
import sys
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import gspread


def setup_sheets():
    print("=== Google Sheets Setup ===")
    print("1. Go to https://console.cloud.google.com/")
    print("2. Create a project")
    print("3. Enable Google Sheets API")
    print("4. Create Credentials > OAuth Client ID > Desktop App")
    print("5. Download the JSON and save it to:")
    print(f"   {os.path.expanduser('~/.antenna/credentials/google-sheets.json')}")
    print(
        "\nAfter setup, run: python -m gspread oauth --credentials ~/.antenna/credentials/google-sheets.json"
    )


def setup_tasks():
    print("=== Google Tasks Setup ===")
    print("1. Go to https://console.cloud.google.com/")
    print("2. Enable Google Tasks API")
    print("3. Create OAuth credentials (same as Sheets)")
    print("4. Download and save as:")
    print(f"   {os.path.expanduser('~/.antenna/credentials/google-tasks.json')}")

    creds_file = os.path.expanduser("~/.antenna/credentials/google-tasks.json")
    token_file = os.path.expanduser("~/.antenna/credentials/google-tasks.token")

    if not os.path.exists(creds_file):
        print(f"\nPlease save credentials to {creds_file} first")
        return

    print("\nRunning OAuth flow...")
    SCOPES = ["https://www.googleapis.com/auth/tasks"]

    try:
        flow = InstalledAppFlow.from_client_secrets_file(creds_file, SCOPES)
        creds = flow.run_local_server(port=0)

        with open(token_file, "w") as f:
            f.write(creds.to_json())

        print(f"Success! Token saved to {token_file}")
    except Exception as e:
        print(f"Error: {e}")


def main():
    os.makedirs(os.path.expanduser("~/.antenna/credentials"), exist_ok=True)

    if len(sys.argv) < 2:
        print("Usage: setup-google.py <sheets|tasks>")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "sheets":
        setup_sheets()
    elif cmd == "tasks":
        setup_tasks()
    else:
        print("Unknown command. Use 'sheets' or 'tasks'")


if __name__ == "__main__":
    main()
