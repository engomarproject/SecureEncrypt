import os
import sys
sys.path.insert(0, r"B:\Omar_Encryption_Project\Omar_Encryption_Project\backend")
os.chdir(r"B:\Omar_Encryption_Project\Omar_Encryption_Project\backend")

from dotenv import load_dotenv
load_dotenv()

from services.firebase_service import get_firebase_service
from firebase_admin import firestore

fb = get_firebase_service()
db = fb.get_database()

# نجرب الـ query اللي بتفشل
try:
    docs = list(
        db.collection("operation_logs")
        .where("uid", "==", "test")
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .limit(10)
        .stream()
    )
    print("Query with order_by ok!")
except Exception as e:
    print("Error:", str(e))
    print("\nهتلاقي في الـ error link لإنشاء الـ index — افتحه في المتصفح")