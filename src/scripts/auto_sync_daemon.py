import time
import os
import sys

# Ensure UTF-8 output encoding
sys.stdout.reconfigure(encoding='utf-8')

script_dir = os.path.dirname(os.path.abspath(__file__))
sync_script = os.path.join(script_dir, "sync_google_sheet.py")

print("⚡ Starting Raftra Google Sheet Live Auto-Sync Daemon (Polling interval: 15s)...")

while True:
    try:
        os.system(f'python "{sync_script}"')
    except Exception as e:
        print(f"Error during sync: {e}")
    time.sleep(15)
