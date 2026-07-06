import sys
sys.path.append('.')
from auth import get_password_hash, verify_password

password = "password123"
h = get_password_hash(password)
print(f"Hash: {h}")
v = verify_password(password, h)
print(f"Verified: {v}")
