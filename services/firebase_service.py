"""
SecureEncrypt - Firebase Service
"""

import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth, credentials, firestore
from google.cloud.firestore import Query, SERVER_TIMESTAMP, Increment

load_dotenv()

# ── قائمة الأدمن (يمكن إضافة المزيد عبر .env) ──────────────────────
ADMIN_EMAIL  = os.getenv("ADMIN_EMAIL",  "admin_omar@gmail.com")
ADMIN_UID    = os.getenv("ADMIN_UID",    "UP9IVetpO7WqyiRIFhhqCIkHUAk2")

ADMIN_EMAIL2 = os.getenv("ADMIN_EMAIL2", "eng.omar.project@gmail.com")
ADMIN_UID2   = os.getenv("ADMIN_UID2",   "")   # يُحدَّث تلقائياً بعد تشغيل fix_admin.py

# قائمة موحّدة (نزيل القيم الفارغة)
ADMIN_EMAILS = {e for e in [ADMIN_EMAIL, ADMIN_EMAIL2] if e}
ADMIN_UIDS   = {u for u in [ADMIN_UID,   ADMIN_UID2]   if u}


class FirebaseService:
    _initialized: bool = False
    _app = None
    _db = None

    def __init__(self):
        if not FirebaseService._initialized:
            self._initialize_firebase()

    def _initialize_firebase(self) -> None:
        try:
            if firebase_admin._apps:
                FirebaseService._app = firebase_admin.get_app()
                FirebaseService._db = firestore.client()
                FirebaseService._initialized = True
                print("✅ Firebase: إعادة استخدام التطبيق الموجود")
                return

            cred_path = os.getenv("FIREBASE_CREDENTIALS", "serviceAccountKey.json")
            if not os.path.exists(cred_path):
                raise FileNotFoundError("ملف Firebase غير موجود: %s" % cred_path)

            storage_bucket = os.getenv(
                "FIREBASE_STORAGE_BUCKET",
                "%s.appspot.com" % os.getenv("FIREBASE_PROJECT_ID", "omar-encryption-project-87055"),
            )
            FirebaseService._app = firebase_admin.initialize_app(
                credentials.Certificate(cred_path), {"storageBucket": storage_bucket}
            )
            FirebaseService._db = firestore.client()
            FirebaseService._initialized = True
            print("✅ تم تهيئة Firebase (Storage: %s)" % storage_bucket)
            self._ensure_admin_accounts()

        except ValueError as e:
            if "already exists" in str(e):
                FirebaseService._app = firebase_admin.get_app()
                FirebaseService._db = firestore.client()
                FirebaseService._initialized = True
                print("✅ Firebase: استُعيد من تطبيق موجود")
            else:
                raise
        except Exception as e:
            print("❌ خطأ في تهيئة Firebase: %s" % str(e))
            raise

    def _ensure_admin_accounts(self):
        """يضمن وجود جميع حسابات الأدمن مع UID صحيح."""
        # الأدمن الأصلي
        self._ensure_single_admin(ADMIN_UID, ADMIN_EMAIL, "Admin Omar")
        # الأدمن الثاني (لو UID محدد)
        if ADMIN_UID2:
            self._ensure_single_admin(ADMIN_UID2, ADMIN_EMAIL2, "Admin Omar 2")
        else:
            # حاول إيجاده بالإيميل
            self._ensure_admin_by_email(ADMIN_EMAIL2, "Admin Omar 2")

    def _ensure_single_admin(self, uid: str, email: str, name: str):
        """يضمن وجود document أدمن واحد بـ UID صحيح."""
        try:
            from services.encryption_service import generate_new_key, validate_encryption_key

            db = self.get_database()
            if not db or not uid:
                return

            docs = list(db.collection("users").where("email", "==", email).limit(5).stream())
            correct_doc = next((d for d in docs if d.id == uid), None)
            wrong_docs  = [d for d in docs if d.id != uid]

            if correct_doc:
                d = correct_doc.to_dict() or {}
                updates = {}
                if not d.get("is_admin", False):
                    updates["is_admin"] = True
                existing_key = d.get("encryption_key", "")
                if not existing_key or not validate_encryption_key(existing_key):
                    updates["encryption_key"] = generate_new_key()
                    print("✅ تم توليد مفتاح تشفير جديد لـ %s" % email)
                if updates:
                    updates["updated_at"] = SERVER_TIMESTAMP
                    correct_doc.reference.update(updates)
                for wd in wrong_docs:
                    wd.reference.delete()
                print("✅ Admin OK: %s → %s" % (email, uid))
                return

            if wrong_docs:
                old = wrong_docs[0].to_dict() or {}
                old_key = old.get("encryption_key", "")
                if not old_key or not validate_encryption_key(old_key):
                    old_key = generate_new_key()
                db.collection("users").document(uid).set({
                    "uid": uid, "email": email,
                    "full_name": old.get("full_name", name), "bio": old.get("bio", ""),
                    "encryption_key": old_key,
                    "created_at": old.get("created_at", SERVER_TIMESTAMP),
                    "updated_at": SERVER_TIMESTAMP,
                    "is_active": True, "key_sent_count": old.get("key_sent_count", 0),
                    "last_key_request": old.get("last_key_request"), "is_admin": True,
                })
                for wd in wrong_docs:
                    wd.reference.delete()
                print("✅ Admin migrated: %s → %s" % (email, uid))
                return

            db.collection("users").document(uid).set({
                "uid": uid, "email": email, "full_name": name, "bio": "",
                "created_at": SERVER_TIMESTAMP, "updated_at": SERVER_TIMESTAMP,
                "is_active": True, "key_sent_count": 0, "last_key_request": None,
                "encryption_key": generate_new_key(), "is_admin": True,
            })
            print("✅ Admin created: %s → %s" % (email, uid))

        except Exception as e:
            print("❌ خطأ في _ensure_single_admin (%s): %s" % (email, str(e)))

    def _ensure_admin_by_email(self, email: str, name: str):
        """يضمن وجود document أدمن عندما لا يكون UID محدداً مسبقاً."""
        try:
            from services.encryption_service import generate_new_key, validate_encryption_key

            db = self.get_database()
            if not db or not email:
                return

            docs = list(db.collection("users").where("email", "==", email).limit(5).stream())
            admin_docs = [d for d in docs if (d.to_dict() or {}).get("is_admin", False)]

            if admin_docs:
                # تحقق من المفتاح فقط
                doc = admin_docs[0]
                d = doc.to_dict() or {}
                key = d.get("encryption_key", "")
                if not key or not validate_encryption_key(key):
                    doc.reference.update({"encryption_key": generate_new_key(), "updated_at": SERVER_TIMESTAMP})
                print("✅ Admin by email OK: %s → %s" % (email, doc.id))
            # لو مش موجود خالص، هيتعمل بعد fix_admin.py

        except Exception as e:
            print("❌ خطأ في _ensure_admin_by_email (%s): %s" % (email, str(e)))

    def get_database(self):
        return FirebaseService._db

    def is_admin_user(self, uid: str) -> bool:
        """
        التحقق من صلاحية الأدمن.
        يتحقق أولاً من قائمة UIDs المعروفة، ثم من Firestore.
        """
        try:
            # ✅ تحقق سريع من القائمة المحلية
            if uid in ADMIN_UIDS:
                return True

            if not FirebaseService._db:
                return False

            # تحقق من Firestore (يشمل الأدمن الثاني الذي قد لا يكون UID2 محدداً)
            doc = FirebaseService._db.collection("users").document(uid).get()
            if doc.exists:
                d = doc.to_dict() or {}
                if d.get("is_admin", False):
                    # أضف الـ UID لقائمة الكاش المحلية
                    ADMIN_UIDS.add(uid)
                    return True

            # بحث إضافي بـ uid field
            docs = list(
                FirebaseService._db.collection("users")
                .where("uid", "==", uid)
                .limit(1)
                .stream()
            )
            if docs:
                d = docs[0].to_dict() or {}
                if d.get("is_admin", False):
                    ADMIN_UIDS.add(uid)
                    return True

            return False
        except Exception as e:
            print("❌ خطأ في is_admin_user: %s" % str(e))
            return False

    def verify_id_token(self, id_token: str) -> Optional[Dict[str, Any]]:
        try:
            decoded = auth.verify_id_token(id_token)
            return {
                "uid": decoded.get("uid"),
                "email": decoded.get("email"),
                "email_verified": decoded.get("email_verified", False),
            }
        except Exception as e:
            err_msg = str(e)
            if "used too early" in err_msg:
                import time
                time.sleep(1)
                try:
                    decoded = auth.verify_id_token(id_token)
                    return {
                        "uid": decoded.get("uid"),
                        "email": decoded.get("email"),
                        "email_verified": decoded.get("email_verified", False),
                    }
                except Exception as e2:
                    print("⚠️ خطأ في التحقق من التوكن: %s" % str(e2))
                    return None
            print("⚠️ خطأ في التحقق من التوكن: %s" % err_msg)
            return None

    def _format_profile(self, uid: str, d: dict) -> dict:
        return {
            "uid": uid,
            "email": d.get("email"),
            "encryption_key": d.get("encryption_key"),
            "full_name": d.get("full_name", ""),
            "bio": d.get("bio", ""),
            "created_at": d.get("created_at"),
            "updated_at": d.get("updated_at"),
            "is_active": d.get("is_active", True),
            "key_sent_count": d.get("key_sent_count", 0),
            "last_key_request": d.get("last_key_request"),
            "is_admin": d.get("is_admin", False),
        }

    def create_user_profile(self, uid: str, email: str, encryption_key: str, full_name: Optional[str] = None) -> Dict[str, Any]:
        try:
            if not FirebaseService._db:
                return {"success": False, "error": "قاعدة البيانات غير مهيئة"}
            FirebaseService._db.collection("users").document(uid).set({
                "uid": uid, "email": email, "encryption_key": encryption_key,
                "full_name": full_name or "", "bio": "",
                "created_at": SERVER_TIMESTAMP, "updated_at": SERVER_TIMESTAMP,
                "is_active": True, "key_sent_count": 0, "last_key_request": None,
                "is_admin": email in ADMIN_EMAILS,
            })
            return {"success": True, "uid": uid}
        except Exception as e:
            return {"success": False, "error": "فشل إنشاء الحساب: %s" % str(e)}

    def get_user_profile(self, uid: str) -> Optional[Dict[str, Any]]:
        try:
            if not FirebaseService._db:
                return None
            doc = FirebaseService._db.collection("users").document(uid).get()
            if doc.exists:
                d = doc.to_dict()
                if d:
                    return self._format_profile(uid, d)
            docs = list(FirebaseService._db.collection("users").where("uid", "==", uid).limit(1).stream())
            if docs:
                d = docs[0].to_dict()
                if d:
                    return self._format_profile(uid, d)
            return None
        except Exception as e:
            print("❌ خطأ في get_user_profile: %s" % str(e))
            return None

    def get_user_encryption_key(self, uid: str) -> Optional[str]:
        try:
            from services.encryption_service import validate_encryption_key, generate_new_key

            profile = self.get_user_profile(uid)
            if not profile:
                return None

            key = profile.get("encryption_key", "")
            if key and validate_encryption_key(key):
                return key

            print("⚠️ مفتاح التشفير غير صالح للمستخدم %s — يتم توليد مفتاح جديد" % uid)
            new_key = generate_new_key()
            if FirebaseService._db:
                FirebaseService._db.collection("users").document(uid).update({
                    "encryption_key": new_key, "updated_at": SERVER_TIMESTAMP,
                })
            return new_key

        except Exception as e:
            print("❌ خطأ في get_user_encryption_key: %s" % str(e))
            return None

    def update_user_profile(self, uid: str, data: Dict[str, Any]) -> bool:
        try:
            if not FirebaseService._db:
                return False
            data["updated_at"] = SERVER_TIMESTAMP
            FirebaseService._db.collection("users").document(uid).update(data)
            return True
        except Exception as e:
            print("❌ خطأ في تحديث الملف: %s" % str(e))
            return False

    def get_all_users(self) -> Dict[str, Any]:
        try:
            if not FirebaseService._db:
                return {"success": False, "error": "قاعدة البيانات غير مهيئة"}
            users = []
            for doc in FirebaseService._db.collection("users").stream():
                d = doc.to_dict()
                if d and not d.get("is_admin", False):
                    users.append({
                        "uid": doc.id, "email": d.get("email"),
                        "full_name": d.get("full_name", ""), "bio": d.get("bio", ""),
                        "created_at": d.get("created_at"),
                        "key_sent_count": d.get("key_sent_count", 0),
                        "last_key_request": d.get("last_key_request"),
                        "is_active": d.get("is_active", True),
                    })
            return {"success": True, "users": users, "count": len(users)}
        except Exception as e:
            return {"success": False, "error": "فشل جلب المستخدمين: %s" % str(e)}

    def increment_key_request_count(self, uid: str) -> Dict[str, Any]:
        try:
            if not FirebaseService._db:
                return {"success": False, "error": "قاعدة البيانات غير مهيئة"}

            user_ref = FirebaseService._db.collection("users").document(uid)
            doc = user_ref.get()
            if not doc.exists:
                return {"success": False, "error": "المستخدم غير موجود"}

            d = doc.to_dict() or {}
            count = d.get("key_sent_count", 0)
            last  = d.get("last_key_request")

            if count >= 10:
                return {"success": False, "can_request": False, "message": "تجاوزت الحد المسموح لطلبات المفتاح (10 مرات)"}

            if last:
                last_dt = last.replace(tzinfo=None) if hasattr(last, "replace") else last
                if (datetime.now() - last_dt) < timedelta(minutes=1):
                    return {"success": False, "can_request": False, "message": "انتظر دقيقة قبل الطلب"}

            user_ref.update({"key_sent_count": Increment(1), "last_key_request": SERVER_TIMESTAMP})
            return {"success": True, "count": count + 1, "can_request": True}

        except Exception as e:
            return {"success": False, "error": "فشل التحديث: %s" % str(e)}

    def store_otp(self, uid: str, email: str, otp_code: str, expires_in_minutes: int = 5) -> Dict[str, Any]:
        try:
            if not FirebaseService._db:
                return {"success": False, "error": "قاعدة البيانات غير مهيئة"}
            expires_at = datetime.now() + timedelta(minutes=expires_in_minutes)
            FirebaseService._db.collection("otp_verification").document(uid).set({
                "uid": uid, "email": email, "otp_code": otp_code,
                "created_at": SERVER_TIMESTAMP, "expires_at": expires_at,
                "attempts": 0, "verified": False,
            })
            return {"success": True, "expires_at": expires_at.isoformat()}
        except Exception as e:
            return {"success": False, "error": "فشل تخزين OTP: %s" % str(e)}

    def verify_otp(self, uid: str, otp_code: str) -> Dict[str, Any]:
        try:
            if not FirebaseService._db:
                return {"success": False, "verified": False, "message": "DB غير مهيئة"}
            ref = FirebaseService._db.collection("otp_verification").document(uid)
            doc = ref.get()
            if not doc.exists:
                return {"success": False, "verified": False, "message": "لم يتم طلب OTP"}
            d = doc.to_dict() or {}
            exp = d.get("expires_at")
            if exp:
                exp_dt = exp.replace(tzinfo=None) if hasattr(exp, "replace") else exp
                if datetime.now() > exp_dt:
                    return {"success": False, "verified": False, "message": "انتهت صلاحية OTP"}
            if d.get("attempts", 0) >= 3:
                return {"success": False, "verified": False, "message": "تجاوزت عدد المحاولات"}
            ref.update({"attempts": Increment(1)})
            if d.get("otp_code") != otp_code:
                return {"success": False, "verified": False, "message": "رمز OTP غير صحيح"}
            return {"success": True, "verified": True, "message": "تم التحقق بنجاح"}
        except Exception as e:
            return {"success": False, "verified": False, "message": "خطأ: %s" % str(e)}

    def delete_otp(self, uid: str) -> bool:
        try:
            if FirebaseService._db:
                FirebaseService._db.collection("otp_verification").document(uid).delete()
            return True
        except Exception:
            return False

    def log_operation(self, uid: str, operation_type: str, metadata: Optional[Dict] = None) -> bool:
        try:
            if not FirebaseService._db:
                return False
            FirebaseService._db.collection("operation_logs").document().set({
                "uid": uid, "operation_type": operation_type,
                "timestamp": SERVER_TIMESTAMP, "metadata": metadata or {},
            })
            return True
        except Exception as e:
            print("❌ خطأ في log_operation: %s" % str(e))
            return False

    def get_user_operation_history(self, uid: str, limit: int = 50) -> Dict[str, Any]:
        try:
            if not FirebaseService._db:
                return {"success": False, "error": "DB غير مهيئة"}
            docs = (
                FirebaseService._db.collection("operation_logs")
                .where("uid", "==", uid)
                .order_by("timestamp", direction=Query.DESCENDING)
                .limit(limit)
                .stream()
            )
            history = [{"id": d.id, **d.to_dict()} for d in docs if d.to_dict()]
            return {"success": True, "history": history, "count": len(history)}
        except Exception as e:
            return {"success": False, "error": "فشل جلب السجل: %s" % str(e)}

    def get_stats(self) -> Dict[str, Any]:
        try:
            if not FirebaseService._db:
                return {"success": False}
            users = list(FirebaseService._db.collection("users").stream())
            logs  = list(FirebaseService._db.collection("operation_logs").stream())
            return {"success": True, "total_users": len(users), "total_operations": len(logs)}
        except Exception as e:
            return {"success": False, "error": str(e)}


_instance: Optional[FirebaseService] = None


def get_firebase_service() -> FirebaseService:
    global _instance
    if _instance is None or not FirebaseService._initialized:
        _instance = FirebaseService()
    return _instance


def is_admin_user(uid: str) -> bool:
    return get_firebase_service().is_admin_user(uid)