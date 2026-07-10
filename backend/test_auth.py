import requests
try:
    res = requests.post('http://localhost:8005/api/auth/register', json={
        'email': 'test78@example.com',
        'password': 'pass',
        'first_name': 'Test',
        'last_name': '78',
        'role': 'creator'
    })
    print("Register Status:", res.status_code)
    print("Register Response:", res.text)
except Exception as e:
    print(e)
