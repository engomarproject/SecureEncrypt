"""
fix_admin.py
============

يضيف / يصلح حسابات الأدمن في Firebase Firestore.
الأدمن الأصلي  : admin_omar@gmail.com  → UID: UP9IVetpO7WqyiRIFhhqCIkHUAk2
الأدمن الثاني  : eng.omar.project@gmail.com  (يتم إنشاؤه تلقائياً)

تشغيل:
    python fix_admin.py
"""

import os
import sys
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, auth as fb_auth
from firebase_admin.firestore import SERVER_TIMESTAMP

load_dotenv()

# ── بيانات الأدمن الأصلي ──────────────────────────────────────────
REAL_ADMIN_UID   = "UP9IVetpO7WqyiRIFhhqCIkHUAk2"
ADMIN_EMAIL      = "admin_omar@gmail.com"
OLD_DOCUMENT_ID  = "44jFj97OsRXsQi10zPeyfCq7XHz1"

# ── بيانات الأدمن الثاني ──────────────────────────────────────────
SECOND_ADMIN_EMAIL    = "eng.omar.project@gmail.com"
SECOND_ADMIN_PASSWORD = "Omar@2004"
SECOND_ADMIN_NAME     = "Admin Omar 2"


def get_or_create_firebase_uid(email: str, password: str, display_name: str) -> str:
    """
    يرجع UID المستخدم إذا كان موجوداً في Firebase Auth،
    أو ينشئه إذا لم يكن موجوداً.
    """
    try:
        user = fb_auth.get_user_by_email(email)
        print(f"✅ المستخدم موجود في Firebase Auth: {user.uid}")
        return user.uid
    except fb_auth.UserNotFoundError:
        print(f"🆕 إنشاء مستخدم جديد في Firebase Auth: {email}")
        user = fb_auth.create_user(
            email=email,
            password=password,
            display_name=display_name,
            email_verified=True,
        )
        print(f"✅ تم الإنشاء: {user.uid}")
        return user.uid
    except Exception as e:
        print(f"❌ خطأ في Firebase Auth: {e}")
        raise


def fix_first_admin(db):
    """إصلاح / إنشاء حساب الأدمن الأصلي."""
    print("\n" + "=" * 50)
    print("🔧 [1] Fixing First Admin")
    print("=" * 50)

    users_ref = db.collection("users")

    # حذف أي document بنفس الإيميل وUID مختلف
    docs = users_ref.where("email", "==", ADMIN_EMAIL).stream()
    for doc in docs:
        if doc.id != REAL_ADMIN_UID:
            doc.reference.delete()
            print(f"🗑️  Deleted wrong document: {doc.id}")

    # إنشاء / تحديث document الأدمن الأصلي
    admin_ref = users_ref.document(REAL_ADMIN_UID)
    admin_ref.set(
        {
            "uid":              REAL_ADMIN_UID,
            "email":            ADMIN_EMAIL,
            "full_name":        "Admin Omar",
            "bio":              "",
            "encryption_key":   "",        # سيتم توليده تلقائياً عند أول استخدام
            "created_at":       SERVER_TIMESTAMP,
            "updated_at":       SERVER_TIMESTAMP,
            "is_active":        True,
            "key_sent_count":   0,
            "last_key_request": None,
            "is_admin":         True,
        },
        merge=True,
    )
    print(f"✅ First admin fixed: {ADMIN_EMAIL} → {REAL_ADMIN_UID}")

    # حذف document القديم لو كان مختلفاً
    if OLD_DOCUMENT_ID != REAL_ADMIN_UID:
        old_ref = users_ref.document(OLD_DOCUMENT_ID)
        if old_ref.get().exists:
            old_ref.delete()
            print(f"🗑️  Deleted old document: {OLD_DOCUMENT_ID}")


def fix_second_admin(db):
    """إنشاء / تحديث حساب الأدمن الثاني."""
    print("\n" + "=" * 50)
    print("🔧 [2] Adding Second Admin")
    print("=" * 50)

    # الحصول على UID من Firebase Auth (أو إنشاء المستخدم)
    second_uid = get_or_create_firebase_uid(
        email=SECOND_ADMIN_EMAIL,
        password=SECOND_ADMIN_PASSWORD,
        display_name=SECOND_ADMIN_NAME,
    )

    users_ref = db.collection("users")

    # حذف أي document خاطئ بنفس الإيميل
    docs = users_ref.where("email", "==", SECOND_ADMIN_EMAIL).stream()
    for doc in docs:
        if doc.id != second_uid:
            doc.reference.delete()
            print(f"🗑️  Deleted wrong document: {doc.id}")

    # إنشاء / تحديث document الأدمن الثاني
    second_ref = users_ref.document(second_uid)
    second_ref.set(
        {
            "uid":              second_uid,
            "email":            SECOND_ADMIN_EMAIL,
            "full_name":        SECOND_ADMIN_NAME,
            "bio":              "",
            "encryption_key":   "",        # سيتم توليده تلقائياً
            "created_at":       SERVER_TIMESTAMP,
            "updated_at":       SERVER_TIMESTAMP,
            "is_active":        True,
            "key_sent_count":   0,
            "last_key_request": None,
            "is_admin":         True,
        },
        merge=True,
    )
    print(f"✅ Second admin created/updated: {SECOND_ADMIN_EMAIL} → {second_uid}")
    return second_uid


def update_env_file(second_uid: str):
    """
    تحديث ملف .env لإضافة ADMIN_EMAIL2 و ADMIN_UID2.
    """
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        print("⚠️  ملف .env غير موجود — تخطّي التحديث التلقائي")
        return

    with open(env_path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()
    new_lines = []
    found_email2 = False
    found_uid2   = False

    for line in lines:
        if line.startswith("ADMIN_EMAIL2="):
            new_lines.append(f"ADMIN_EMAIL2={SECOND_ADMIN_EMAIL}")
            found_email2 = True
        elif line.startswith("ADMIN_UID2="):
            new_lines.append(f"ADMIN_UID2={second_uid}")
            found_uid2 = True
        else:
            new_lines.append(line)

    if not found_email2:
        new_lines.append(f"ADMIN_EMAIL2={SECOND_ADMIN_EMAIL}")
    if not found_uid2:
        new_lines.append(f"ADMIN_UID2={second_uid}")

    with open(env_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines))

    print(f"✅ تم تحديث .env: ADMIN_EMAIL2 و ADMIN_UID2={second_uid}")


def fix_admin():
    # تهيئة Firebase
    if not firebase_admin._apps:
        cred = credentials.Certificate(
            os.getenv("FIREBASE_CREDENTIALS", "serviceAccountKey.json")
        )
        firebase_admin.initialize_app(cred)

    db = firestore.client()

    # إصلاح الأدمن الأول
    fix_first_admin(db)

    # إضافة الأدمن الثاني
    second_uid = fix_second_admin(db)

    # تحديث .env
    update_env_file(second_uid)

    # ملخص نهائي
    print("\n" + "=" * 60)
    print("🎉 DONE — ملخص الأدمن")
    print("=" * 60)
    print(f"Admin 1  | {ADMIN_EMAIL:<35} | {REAL_ADMIN_UID}")
    print(f"Admin 2  | {SECOND_ADMIN_EMAIL:<35} | {second_uid}")
    print("=" * 60)
    print("\n⚠️  تذكّر: حدّث firebase_service.py بـ UID الأدمن الثاني إذا لم يتم تلقائياً")
    print(f"    ADMIN_UID2 = \"{second_uid}\"")


if __name__ == "__main__":
    fix_admin()