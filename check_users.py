import os
import sys
os.chdir(r"B:\Omar_Encryption_Project\Omar_Encryption_Project\backend")
sys.path.insert(0, r"B:\Omar_Encryption_Project\Omar_Encryption_Project\backend")

from dotenv import load_dotenv
load_dotenv()

print("Starting...")

import firebase_admin
from firebase_admin import credentials, auth

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

print("Firebase initialized")
print("=== Users ===")

page = auth.list_users()
for user in page.iterate_all():
    print("UID:", user.uid, "Email:", user.email)

print("Done")