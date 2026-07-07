import requests

BASE_URL = "http://localhost:8005/api"

def run_test():
    # Register
    print("Registering...")
    res = requests.post(f"{BASE_URL}/auth/register", json={
        "first_name": "Test",
        "last_name": "User",
        "email": "test2@example.com",
        "password": "password"
    })
    
    if res.status_code == 400 and "already registered" in res.text:
        print("User already exists, proceeding to login...")
    elif res.status_code != 200:
        print(f"Failed to register: {res.text}")
        return

    # Login
    print("Logging in...")
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "test2@example.com",
        "password": "password"
    })
    if res.status_code != 200:
        print(f"Failed to login: {res.text}")
        return
        
    token = res.json().get("access_token")
    print(f"Got token: {token[:20]}...")
    
    # Fetch workspaces
    print("Fetching workspaces...")
    res = requests.get(f"{BASE_URL}/workspaces", headers={
        "Authorization": f"Bearer {token}"
    })
    print(f"Workspaces response: {res.status_code}")
    print(res.text)

if __name__ == "__main__":
    run_test()
