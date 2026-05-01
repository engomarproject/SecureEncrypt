"""
============================================
مشروع أداة التشفير وفك التشفير الآمنة
الطالب: عمر حمدي عبد العزيز - 22510462
الملف: init_database.py - تهيئة قاعدة بيانات Firebase Firestore
============================================

الوظيفة:
- إنشاء المجموعات (Collections) في Firestore
- إعداد قواعد الأمان الأساسية
- التحقق من اتصال Firebase
- الحفاظ على وثائق _init لضمان ظهور المجموعات

طريقة الاستخدام:
    python init_database.py
"""

import os
import time
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin.exceptions import FirebaseError

# تحميل المتغيرات من ملف .env
load_dotenv()


def initialize_firebase():
    """
    تهيئة Firebase Admin SDK لـ Firestore
    ملاحظة: لا نستخدم databaseURL لأنها لـ Realtime Database
    """
    try:
        credentials_path = os.getenv("FIREBASE_CREDENTIALS", "serviceAccountKey.json")

        if not os.path.exists(credentials_path):
            print("❌ ملف المفاتيح غير موجود: %s" % credentials_path)
            print(
                "💡 الحل: حمل الملف من Firebase Console > Project Settings > Service Accounts"
            )
            return False

        cred = credentials.Certificate(credentials_path)

        # ✅ تهيئة Firebase بدون databaseURL (لأن ده لـ Firestore مش Realtime Database)
        firebase_admin.initialize_app(cred)

        print("✅ تم تهيئة Firebase بنجاح")
        return True

    except FirebaseError as error:
        print("❌ خطأ في تهيئة Firebase: %s" % str(error))
        return False
    except IOError as error:
        print("❌ خطأ في قراءة الملف: %s" % str(error))
        return False


def test_database_connection():
    """
    اختبار اتصال قاعدة البيانات بمحاولة بسيطة
    """
    try:
        # انتظار 3 ثواني للتأكد من تهيئة القاعدة
        print("⏳ جاري الانتظار للاتصال بالقاعدة...")
        time.sleep(3)

        # الحصول على عميل Firestore
        db = firestore.client()

        # اختبار قراءة/كتابة بسيط
        test_ref = db.collection("_system_check").document("test")
        test_ref.set({"status": "connected", "timestamp": firestore.SERVER_TIMESTAMP})

        # التحقق من الكتابة
        test_doc = test_ref.get()

        if test_doc.exists:
            # ✅ تم إزالة الحذف للحفاظ على الوثيقة كدليل على النجاح
            # test_ref.delete()
            print("\n✅ اختبار قاعدة البيانات: ناجح")
            print("📄 وثيقة الاختبار _system_check/test تم إنشاؤها")
            return True

        print("\n❌ اختبار قاعدة البيانات: فشل (الكتابة نجحت لكن القراءة لا)")
        return False

    except FirebaseError as error:
        error_msg = str(error)
        print("\n❌ خطأ في اختبار قاعدة البيانات: %s" % error_msg)

        # تحليل الخطأ
        if "default" in error_msg.lower() and "does not exist" in error_msg.lower():
            print("\n💡 السبب: قاعدة Firestore غير مفعلة بالكامل بعد")
            print("💡 الحل 1: تأكد من إنشاء القاعدة من Firebase Console")
            print("💡 الحل 2: انتظر 5-10 دقائق بعد إنشاء القاعدة")
            print("💡 الحل 3: تأكد من اختيار 'Firestore Native' مش 'Datastore'")
            print("\n🔗 رابط إنشاء القاعدة:")
            print(
                "https://console.firebase.google.com/project/omar-encryption-project/firestore"
            )

        return False
    except IOError as error:
        print("\n❌ خطأ في الاتصال: %s" % str(error))
        return False


def create_collections():
    """
    إنشاء المجموعات الأساسية في Firestore
    ملاحظة: لا نحذف وثائق _init لضمان ظهور المجموعات في Firebase Console
    """
    try:
        db = firestore.client()

        collections = [
            "users",  # بيانات المستخدمين ومفاتيح التشفير
            "operation_logs",  # سجل عمليات التشفير وفك التشفير
            "otp_verification",  # رموز OTP للتحقق
            "encrypted_files",  # الملفات المشفرة
            "temp_keys",  # المفاتيح المؤقتة
        ]

        print("\n📁 إنشاء المجموعات (Collections)...")

        for collection_name in collections:
            doc_ref = db.collection(collection_name).document("_init")
            doc_ref.set(
                {
                    "initialized": True,
                    "created_at": firestore.SERVER_TIMESTAMP,
                    "purpose": "هذه الوثيقة تحافظ على ظهور المجموعة في Firebase Console",
                }
            )
            # ✅ تم إزالة أمر الحذف للحفاظ على المجموعة ظاهرة
            # doc_ref.delete()
            print("  ✅ %s (تم إنشاء وثيقة _init)" % collection_name)

        print("\n✅ تم إنشاء جميع المجموعات بنجاح")
        print("📌 ملاحظة: وثائق _init تحافظ على ظهور المجموعات في Firebase Console")
        return True

    except FirebaseError as error:
        print("❌ خطأ في إنشاء المجموعات: %s" % str(error))
        return False
    except IOError as error:
        print("❌ خطأ في الاتصال: %s" % str(error))
        return False


def main():
    """
    الدالة الرئيسية لتهيئة قاعدة البيانات
    """
    print("=" * 50)
    print("🔧 أداة تهيئة قاعدة بيانات Firebase Firestore")
    print("مشروع أداة التشفير وفك التشفير الآمنة")
    print("الطالب: عمر حمدي عبد العزيز - 22510462")
    print("=" * 50)
    print()

    # 1. تهيئة Firebase
    if not initialize_firebase():
        print("\n❌ فشل تهيئة Firebase.")
        return

    # 2. اختبار الاتصال
    print("\n🔍 جاري اختبار الاتصال بقاعدة البيانات...")
    if not test_database_connection():
        print("\n❌ فشل اختبار الاتصال.")
        print("\n⚠️ خطوات إضافية مطلوبة:")
        print("1. افتح Firebase Console")
        print("2. اذهب إلى Firestore Database")
        print("3. اضغط Create Database إذا لم تكن موجودة")
        print("4. اختر Start in Test Mode")
        print("5. انتظر 5-10 دقائق ثم شغل السكريبت مرة أخرى")
        return

    # 3. إنشاء المجموعات
    if not create_collections():
        print("\n❌ فشل إنشاء المجموعات.")
        return

    print("\n" + "=" * 50)
    print("✅ اكتملت تهيئة قاعدة البيانات بنجاح!")
    print("=" * 50)
    print("\n📌 الخطوات التالية:")
    print("1. افتح Firebase Console > Firestore Database > Data")
    print("2. ستظهر جميع المجموعات (Collections) الآن")
    print("3. شغل تطبيق الباك إند: python app.py")
    print("4. افتح الفرونت إند في متصفح آخر")
    print("5. جرب إنشاء حساب جديد")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
