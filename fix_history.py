import os
import sys
sys.path.insert(0, r"B:\Omar_Encryption_Project\Omar_Encryption_Project\backend")
os.chdir(r"B:\Omar_Encryption_Project\Omar_Encryption_Project\backend")

from dotenv import load_dotenv
load_dotenv()

from services.firebase_service import get_firebase_service

fb = get_firebase_service()
db = fb.get_database()

try:
    db.collection("operation_logs").document("_init").set({"init": True})
    print("operation_logs created ok")
except Exception as e:
    print("Error:", e)

try:
    docs = list(db.collection("operation_logs").limit(1).stream())
    print("Query ok, docs:", len(docs))
except Exception as e:
    print("Query Error:", e)