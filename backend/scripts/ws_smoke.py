"""Watch the agent WebSocket while a creative generation runs. Manual, not a test.

This lived at backend/test_ws.py, where pytest collected it as `test_ws.py::test` and the
whole suite reported a failure on every run:

    Failed: async def functions are not natively supported

That was never a real regression. The file asserts nothing, needs a server already
listening on localhost:8005, waits up to 20s per message and prints what arrives - it is
something you read, not something that passes or fails. Its name was the only reason
pytest looked at it, so a red suite hid genuine failures behind a permanent one.

Installing pytest-asyncio to make it "run" would have been the wrong fix: it would then
hang for 20s and still assert nothing. It belongs here beside section_smoke.py instead.

    python scripts/ws_smoke.py        # with the API already running on :8005
"""
import asyncio
import json
import urllib.request
import websockets

async def main():
    async with websockets.connect('ws://localhost:8005/ws') as ws:
        # Trigger creative ad generation
        req = urllib.request.Request(
            'http://localhost:8005/api/agents/1/creative',
            data=json.dumps({'target_product':'test', 'concept_strategy':'test'}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        try:
            res = urllib.request.urlopen(req)
            print("API triggered successfully, waiting for WebSocket messages...")
        except urllib.error.HTTPError as e:
            print("HTTP Error:", e.code)
            
            # Since HTTP 401 is expected due to auth, let's trigger the background task manually
            print("Triggering task manually via sys.path...")
            import sys
            sys.path.append('.')
            from agents.creative_nodes.generation_graph import run_ad_generation_task
            
            # Run in a background asyncio task so we can receive on ws
            asyncio.create_task(run_ad_generation_task(1, 'test', 'test'))

        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=20.0)
                print("Received WS message:", msg)
            except asyncio.TimeoutError:
                print("Timeout waiting for message")
                break

if __name__ == "__main__":
    asyncio.run(main())
