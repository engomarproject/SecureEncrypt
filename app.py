"""
SecureEncrypt - Flask API Server
"""

import base64
import io
import logging
import os
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from firebase_admin import firestore
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
firestore.SERVER_TIMESTAMP = SERVER_TIMESTAMP
from werkzeug.utils import secure_filename

from config import Config, get_config
from utils import (
    success_response,
    error_response,
    validate_email,
    generate_otp,
    rate_limit,
    log_operation,
    logger,
    get_client_ip,
    get_user_agent,
)
from services.firebase_service import get_firebase_service
from services.encryption_service import (
    EncryptionService,
    generate_new_key,
    validate_encryption_key,
)
from services.email_service import EmailService, send_key_email
from services.storage_service import (
    upload_encrypted_file,
    download_encrypted_file,
    delete_encrypted_file,
    is_image,
)

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-key-change-in-production")
config = get_config()
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": config.ALLOWED_ORIGINS,
            "supports_credentials": config.CORS_SUPPORTS_CREDENTIALS,
        }
    },
)


# ============================================
# Auth Decorators
# ============================================


def verify_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return error_response("التوكن غير موجود", 401, "MISSING_TOKEN")
        token = auth_header.split("Bearer ")[1]
        firebase_service = get_firebase_service()
        decoded = firebase_service.verify_id_token(token)
        if not decoded:
            return error_response("التوكن غير صالح", 401, "INVALID_TOKEN")
        request.user_id = decoded.get("uid")
        request.user_email = decoded.get("email")
        return f(*args, **kwargs)

    return decorated


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        firebase_service = get_firebase_service()
        if not firebase_service.is_admin_user(request.user_id):
            return error_response("غير مصرح الوصول", 403, "UNAUTHORIZED")
        return f(*args, **kwargs)

    return decorated


# ============================================
# Public Routes
# ============================================


@app.route("/api/health", methods=["GET"])
def health_check():
    return success_response(
        {"status": "running", "version": "1.0.0"}, "الخادم يعمل", 200
    )


@app.route("/", methods=["GET"])
def home():
    return success_response({"message": "SecureEncrypt API"}, "مرحباً", 200)


# ============================================
# Auth Routes
# ============================================


@app.route("/api/signup", methods=["POST"])
@rate_limit(max_requests=5, per_seconds=60)
def signup():
    try:
        data = request.get_json()
        if not data:
            return error_response("البيانات غير صالحة", 400)
        email = data.get("email")
        full_name = data.get("fullName", "")
        uid = data.get("uid")
        if not email or not validate_email(email):
            return error_response("البريد الإلكتروني غير صالح", 400)
        if not uid:
            return error_response("uid مطلوب", 400)
        encryption_key = generate_new_key()
        if not validate_encryption_key(encryption_key):
            return error_response("فشل توليد المفتاح", 500)
        firebase_service = get_firebase_service()
        result = firebase_service.create_user_profile(
            uid=uid, email=email, encryption_key=encryption_key, full_name=full_name
        )
        if not result.get("success"):
            return error_response(result.get("error", "فشل إنشاء الحساب"), 500)
        try:
            EmailService().send_encryption_key_email(email, encryption_key, full_name)
        except Exception as e:
            logger.warning("فشل إرسال الإيميل: %s", str(e))
        firebase_service.log_operation(uid, "signup", {"ip": get_client_ip()})
        return success_response({"uid": uid, "email": email}, "تم التسجيل بنجاح", 201)
    except Exception as e:
        logger.error("خطأ في التسجيل: %s", str(e))
        return error_response("حدث خطأ: %s" % str(e), 500)


# ============================================
# Encryption Routes
# ============================================


@app.route("/api/encrypt", methods=["POST"])
@verify_token
@rate_limit(max_requests=30, per_seconds=60)
def encrypt():
    try:
        data = request.get_json()
        if not data:
            return error_response("البيانات غير صالحة", 400)
        input_data = data.get("data") or data.get("inputData")
        if not input_data:
            return error_response("البيانات فارغة", 400)
        firebase_service = get_firebase_service()
        encryption_key = firebase_service.get_user_encryption_key(request.user_id)
        if not encryption_key:
            return error_response("مفتاح التشفير غير موجود", 404)
        enc = EncryptionService()
        enc.set_key(encryption_key)
        result = enc.encrypt_text(input_data)
        if not result.get("success"):
            return error_response(result.get("error", "فشل التشفير"), 500)
        firebase_service.log_operation(
            request.user_id, "encrypt", {"success": True, "size": len(input_data)}
        )
        return success_response(
            {
                "encrypted": result.get("encrypted"),
                "algorithm": result.get("algorithm"),
            },
            "تم التشفير",
            200,
        )
    except Exception as e:
        logger.error("خطأ في التشفير: %s", str(e))
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/decrypt", methods=["POST"])
@verify_token
@rate_limit(max_requests=30, per_seconds=60)
def decrypt():
    try:
        data = request.get_json()
        if not data:
            return error_response("البيانات غير صالحة", 400)
        token = data.get("token")
        key = data.get("key")
        if not token:
            return error_response("النص المشفر فارغ", 400)
        if not key:
            return error_response("مفتاح التشفير مطلوب", 400)
        if not validate_encryption_key(key):
            return error_response("مفتاح التشفير غير صالح", 400)
        firebase_service = get_firebase_service()
        stored_key = firebase_service.get_user_encryption_key(request.user_id)
        if not stored_key:
            return error_response("مفتاح التشفير غير موجود", 404)
        if key != stored_key:
            return error_response("مفتاح التشفير غير صحيح", 400, "KEY_MISMATCH")
        enc = EncryptionService()
        enc.set_key(key)
        result = enc.decrypt_text(token)
        if not result.get("success"):
            return error_response(
                result.get("error", "فشل فك التشفير"), 400, result.get("error_code")
            )
        firebase_service.log_operation(request.user_id, "decrypt", {"success": True})
        return success_response(
            {
                "decrypted": result.get("decrypted"),
                "algorithm": result.get("algorithm"),
            },
            "تم فك التشفير",
            200,
        )
    except Exception as e:
        logger.error("خطأ في فك التشفير: %s", str(e))
        return error_response("خطأ: %s" % str(e), 500)


# ============================================
# Key Management
# ============================================


@app.route("/api/user/key", methods=["GET"])
@verify_token
def get_user_key_route():
    try:
        firebase_service = get_firebase_service()
        key = firebase_service.get_user_encryption_key(request.user_id)
        if not key:
            return error_response("المفتاح غير موجود", 404)
        return success_response(
            {"key": key, "email": request.user_email}, "تم جلب المفتاح", 200
        )
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/send-key", methods=["POST"])
@verify_token
@rate_limit(max_requests=10, per_seconds=300)
def send_key():
    try:
        firebase_service = get_firebase_service()
        limit_check = firebase_service.increment_key_request_count(request.user_id)
        if not limit_check.get("success"):
            return error_response(limit_check.get("message", "تجاوزت الحد"), 429)
        profile = firebase_service.get_user_profile(request.user_id)
        if not profile:
            return error_response("الملف الشخصي غير موجود", 404)
        result = send_key_email(
            profile.get("email"),
            profile.get("encryption_key"),
            profile.get("full_name", ""),
        )
        if not result.get("success"):
            return error_response(result.get("message", "فشل الإرسال"), 500)
        firebase_service.log_operation(request.user_id, "send_key", {"success": True})
        return success_response(
            {"message": result.get("message"), "email": profile.get("email")},
            "تم الإرسال",
            200,
        )
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


# ============================================
# File Routes
# ============================================


def _is_allowed(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in config.ALL_ALLOWED_EXTENSIONS


@app.route("/api/upload-encrypt", methods=["POST"])
@verify_token
@rate_limit(max_requests=10, per_seconds=60)
def upload_encrypt():
    """
    ✅ التدفق:
    1. استقبال الملف
    2. تشفيره
    3. محاولة رفع النسخة المشفرة على Cloudinary (اختياري)
    4. إرجاع الملف المشفر (.enc) للمستخدم ليحمّله
    5. حفظ الـ metadata في Firestore (إن نجح الرفع)
    """
    try:
        logger.info("📥 upload_encrypt: طلب جديد من %s", request.user_id)

        # ── 1. التحقق من وجود الملف ──────────────────────────────
        if "file" not in request.files:
            logger.warning("upload_encrypt: لا يوجد ملف في الطلب")
            return error_response("لم يتم رفع ملف", 400)

        file = request.files["file"]
        if not file or not file.filename:
            return error_response("اسم الملف فارغ", 400)

        safe_name = secure_filename(file.filename)
        if not safe_name:
            return error_response("اسم الملف غير صالح", 400)

        logger.info("upload_encrypt: الملف = %s", safe_name)

        # ── 2. التحقق من نوع الملف ───────────────────────────────
        base_ext = safe_name.rsplit(".", 1)[1].lower() if "." in safe_name else ""
        if base_ext != "enc" and not _is_allowed(safe_name):
            logger.warning("upload_encrypt: نوع غير مسموح = %s", base_ext)
            return error_response(
                "نوع الملف غير مسموح به. الأنواع المسموحة: txt, pdf, doc, docx, xls, xlsx, ppt, pptx, png, jpg, jpeg, gif, webp, zip, rar, mp3, mp4",
                400,
            )

        # ── 3. قراءة محتوى الملف ─────────────────────────────────
        file_content = file.read()
        file_size = len(file_content)
        logger.info("upload_encrypt: حجم الملف = %d bytes", file_size)

        if file_size == 0:
            return error_response("الملف فارغ", 400)
        if file_size > 50 * 1024 * 1024:
            return error_response("حجم الملف كبير جداً (الحد 50MB)", 400)

        # ── 4. جلب مفتاح التشفير ─────────────────────────────────
        firebase_service = get_firebase_service()
        encryption_key = firebase_service.get_user_encryption_key(request.user_id)
        if not encryption_key:
            logger.error("upload_encrypt: مفتاح التشفير غير موجود للمستخدم %s", request.user_id)
            return error_response("مفتاح التشفير غير موجود", 404)

        # ── 5. تشفير المحتوى ──────────────────────────────────────
        try:
            enc = EncryptionService()
            enc.set_key(encryption_key)
            file_b64 = base64.b64encode(file_content).decode("utf-8")
            enc_result = enc.encrypt_text(file_b64)
        except Exception as e:
            logger.error("upload_encrypt: خطأ في التشفير = %s", str(e))
            return error_response("فشل تشفير الملف: %s" % str(e), 500)

        if not enc_result.get("success"):
            return error_response(enc_result.get("error", "فشل التشفير"), 500)

        encrypted_token = enc_result.get("encrypted")
        encrypted_bytes = encrypted_token.encode("utf-8")
        logger.info("upload_encrypt: تم التشفير بنجاح")

        # ── 6. رفع على Cloudinary (اختياري — لا يوقف العملية) ────
        mime_type = file.mimetype or "application/octet-stream"
        storage_saved = False
        try:
            storage_result = upload_encrypted_file(
                encrypted_bytes=encrypted_bytes,
                original_filename=safe_name,
                uid=request.user_id,
                mime_type=mime_type,
            )
            if storage_result.get("success"):
                storage_saved = True
                logger.info("upload_encrypt: تم الرفع على Cloudinary")
                # حفظ الـ metadata في Firestore
                try:
                    db = firebase_service.get_database()
                    file_ref = db.collection("encrypted_files").document()
                    file_ref.set(
                        {
                            "uid": request.user_id,
                            "filename": safe_name,
                            "file_size": file_size,
                            "mime_type": mime_type,
                            "is_image": is_image(safe_name),
                            "created_at": firestore.SERVER_TIMESTAMP,
                            "storage": storage_result.get("storage"),
                            "url": storage_result.get("url"),
                            "public_id": storage_result.get("public_id"),
                            "storage_path": storage_result.get("storage_path"),
                        }
                    )
                    logger.info("upload_encrypt: تم حفظ الـ metadata في Firestore")
                except Exception as db_err:
                    logger.warning("upload_encrypt: فشل حفظ metadata: %s", str(db_err))
            else:
                logger.warning(
                    "upload_encrypt: Cloudinary غير متاح — %s",
                    storage_result.get("error", "unknown"),
                )
        except Exception as storage_err:
            logger.warning("upload_encrypt: خطأ في التخزين (غير حرج): %s", str(storage_err))

        # ── 7. سجّل العملية ───────────────────────────────────────
        try:
            firebase_service.log_operation(
                request.user_id,
                "file_encrypt",
                {
                    "filename": safe_name,
                    "size": file_size,
                    "storage_saved": storage_saved,
                },
            )
        except Exception as log_err:
            logger.warning("upload_encrypt: فشل تسجيل العملية: %s", str(log_err))

        # ── 8. إرجاع الملف المشفر للمستخدم ───────────────────────
        enc_filename = safe_name + ".enc"
        logger.info("upload_encrypt: ✅ إرجاع الملف المشفر: %s", enc_filename)

        return send_file(
            io.BytesIO(encrypted_bytes),
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name=enc_filename,
        )

    except Exception as e:
        logger.error("upload_encrypt: خطأ غير متوقع: %s", str(e), exc_info=True)
        return error_response("خطأ في معالجة الملف: %s" % str(e), 500)


@app.route("/api/decrypt-file", methods=["POST"])
@verify_token
@rate_limit(max_requests=10, per_seconds=60)
def decrypt_file_upload():
    """
    فك تشفير ملف .enc مرفوع مباشرة:
    المستخدم يرفع ملف .enc + مفتاح → يحمّل الملف الأصلي
    """
    try:
        if "file" not in request.files:
            return error_response("لم يتم رفع ملف", 400)

        enc_file = request.files["file"]
        key = request.form.get("key", "").strip()

        if not enc_file.filename:
            return error_response("اسم الملف فارغ", 400)
        if not key:
            return error_response("مفتاح التشفير مطلوب", 400)
        if not validate_encryption_key(key):
            return error_response("مفتاح التشفير غير صالح (44 حرف Base64)", 400)

        firebase_service = get_firebase_service()
        stored_key = firebase_service.get_user_encryption_key(request.user_id)
        if not stored_key:
            return error_response("مفتاح التشفير غير موجود في حسابك", 404)
        if key != stored_key:
            return error_response("مفتاح التشفير غير صحيح", 400, "KEY_MISMATCH")

        enc_content = enc_file.read()
        encrypted_token = enc_content.decode("utf-8").strip()

        enc = EncryptionService()
        enc.set_key(key)
        result = enc.decrypt_text(encrypted_token)
        if not result.get("success"):
            return error_response(
                result.get("error", "فشل فك التشفير — تأكد من الملف والمفتاح"), 400
            )

        original_content = base64.b64decode(result.get("decrypted"))

        original_filename = enc_file.filename
        if original_filename.endswith(".enc"):
            original_filename = original_filename[:-4]

        ext = (
            original_filename.rsplit(".", 1)[-1].lower()
            if "." in original_filename
            else ""
        )
        mime_map = {
            "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "webp": "image/webp", "bmp": "image/bmp",
            "pdf": "application/pdf",
            "doc": "application/msword",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xls": "application/vnd.ms-excel",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "ppt": "application/vnd.ms-powerpoint",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "txt": "text/plain", "zip": "application/zip",
            "rar": "application/x-rar-compressed",
            "mp3": "audio/mpeg", "mp4": "video/mp4",
        }
        mime_type = mime_map.get(ext, "application/octet-stream")

        firebase_service.log_operation(
            request.user_id, "file_decrypt", {"filename": original_filename}
        )

        return send_file(
            io.BytesIO(original_content),
            mimetype=mime_type,
            as_attachment=True,
            download_name=original_filename,
        )

    except Exception as e:
        logger.error("خطأ في decrypt_file_upload: %s", str(e))
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/files", methods=["GET"])
@verify_token
def get_files():
    try:
        firebase_service = get_firebase_service()
        db = firebase_service.get_database()
        docs = (
            db.collection("encrypted_files")
            .where("uid", "==", request.user_id)
            .limit(50)
            .stream()
        )
        files = []
        for doc in docs:
            d = doc.to_dict()
            if d:
                files.append(
                    {
                        "id": doc.id,
                        "filename": d.get("filename"),
                        "file_size": d.get("file_size"),
                        "created_at": d.get("created_at"),
                        "mime_type": d.get("mime_type"),
                        "is_image": d.get("is_image", False),
                        "storage": d.get("storage", "cloudinary"),
                        "download_url": d.get("url"),
                    }
                )
        files.sort(
            key=lambda x: (
                x.get("created_at").seconds
                if x.get("created_at") and hasattr(x.get("created_at"), "seconds")
                else 0
            ),
            reverse=True,
        )
        return success_response({"files": files}, "تم جلب الملفات", 200)
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/download-encrypted/<file_id>", methods=["GET"])
@verify_token
def download_encrypted_copy(file_id):
    """تحميل نسخة مشفرة من ملف محفوظ (من Cloudinary)"""
    try:
        firebase_service = get_firebase_service()
        db = firebase_service.get_database()
        doc = db.collection("encrypted_files").document(file_id).get()
        if not doc.exists:
            return error_response("الملف غير موجود", 404)
        file_data = doc.to_dict()
        if file_data.get("uid") != request.user_id:
            return error_response("غير مصرح", 403)

        encrypted_bytes = download_encrypted_file(file_data)
        if not encrypted_bytes:
            return error_response("فشل تحميل الملف المشفر", 500)

        enc_filename = file_data.get("filename", "file") + ".enc"
        return send_file(
            io.BytesIO(encrypted_bytes),
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name=enc_filename,
        )
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/download-decrypt/<file_id>", methods=["GET"])
@verify_token
def download_decrypt(file_id):
    """تحميل الملف الأصلي مباشرة من القائمة (بعد OTP)"""
    try:
        firebase_service = get_firebase_service()
        db = firebase_service.get_database()
        doc = db.collection("encrypted_files").document(file_id).get()
        if not doc.exists:
            return error_response("الملف غير موجود", 404)
        file_data = doc.to_dict()
        if file_data.get("uid") != request.user_id:
            return error_response("غير مصرح", 403)

        encrypted_bytes = download_encrypted_file(file_data)
        if not encrypted_bytes:
            return error_response("فشل تحميل الملف المشفر", 500)

        encryption_key = firebase_service.get_user_encryption_key(request.user_id)
        enc = EncryptionService()
        enc.set_key(encryption_key)
        encrypted_str = (
            encrypted_bytes.decode("utf-8")
            if isinstance(encrypted_bytes, bytes)
            else encrypted_bytes
        )
        result = enc.decrypt_text(encrypted_str)
        if not result.get("success"):
            return error_response(result.get("error", "فشل فك التشفير"), 400)

        original_content = base64.b64decode(result.get("decrypted"))
        filename = file_data.get("filename", "file")
        mime_type = file_data.get("mime_type", "application/octet-stream")
        firebase_service.log_operation(
            request.user_id, "file_decrypt", {"filename": filename}
        )
        return send_file(
            io.BytesIO(original_content),
            mimetype=mime_type,
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/delete-file/<file_id>", methods=["DELETE"])
@verify_token
def delete_file(file_id):
    try:
        firebase_service = get_firebase_service()
        db = firebase_service.get_database()
        ref = db.collection("encrypted_files").document(file_id)
        doc = ref.get()
        if not doc.exists:
            return error_response("الملف غير موجود", 404)
        file_data = doc.to_dict()
        if file_data.get("uid") != request.user_id:
            return error_response("غير مصرح", 403)
        delete_encrypted_file(file_data)
        ref.delete()
        firebase_service.log_operation(
            request.user_id, "file_delete", {"filename": file_data.get("filename")}
        )
        return success_response({"deleted": True}, "تم الحذف", 200)
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


# ============================================
# OTP Routes
# ============================================


@app.route("/api/request-otp", methods=["POST"])
@verify_token
@rate_limit(max_requests=5, per_seconds=300)
def request_otp():
    try:
        firebase_service = get_firebase_service()
        profile = firebase_service.get_user_profile(request.user_id)
        if not profile:
            return error_response("الملف الشخصي غير موجود", 404)
        otp_code = generate_otp(6)
        store_result = firebase_service.store_otp(
            uid=request.user_id,
            email=profile.get("email"),
            otp_code=otp_code,
            expires_in_minutes=config.OTP_EXPIRY_MINUTES,
        )
        if not store_result.get("success"):
            return error_response(store_result.get("error"), 500)
        email_result = EmailService().send_otp_email(
            profile.get("email"), otp_code, profile.get("full_name", "")
        )
        if not email_result.get("success"):
            return error_response(email_result.get("message"), 500)
        return success_response(
            {"message": "تم إرسال OTP", "email": profile.get("email")},
            "تم الإرسال",
            200,
        )
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/verify-otp", methods=["POST"])
@verify_token
@rate_limit(max_requests=10, per_seconds=60)
def verify_otp():
    try:
        data = request.get_json()
        otp = data.get("otp") if data else None
        if not otp:
            return error_response("رمز OTP مطلوب", 400)
        firebase_service = get_firebase_service()
        result = firebase_service.verify_otp(request.user_id, otp)
        if not result.get("success") or not result.get("verified"):
            return error_response(
                result.get("message", "رمز OTP غير صحيح"),
                400,
                "OTP_VERIFICATION_FAILED",
            )
        firebase_service.delete_otp(request.user_id)
        firebase_service.log_operation(request.user_id, "verify_otp", {"success": True})
        return success_response({"verified": True}, "تم التحقق", 200)
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


# ============================================
# History & Profile
# ============================================


@app.route("/api/history", methods=["GET"])
@verify_token
def get_history():
    try:
        limit = request.args.get("limit", 50, type=int)
        firebase_service = get_firebase_service()
        result = firebase_service.get_user_operation_history(request.user_id, limit)
        if not result.get("success"):
            return error_response(result.get("error", "فشل جلب السجل"), 500)
        return success_response(
            {"history": result.get("history", []), "count": result.get("count", 0)},
            "تم الجلب",
            200,
        )
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/user/profile", methods=["GET"])
@verify_token
def get_user_profile():
    try:
        firebase_service = get_firebase_service()
        profile = firebase_service.get_user_profile(request.user_id)
        if not profile:
            return error_response("الملف الشخصي غير موجود", 404)
        safe = {
            "uid": profile.get("uid"),
            "email": profile.get("email"),
            "full_name": profile.get("full_name"),
            "bio": profile.get("bio", ""),
            "created_at": profile.get("created_at"),
            "key_sent_count": profile.get("key_sent_count", 0),
            "last_key_request": profile.get("last_key_request"),
            "is_active": profile.get("is_active", True),
            "is_admin": profile.get("is_admin", False),
        }
        return success_response({"user": safe}, "تم الجلب", 200)
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


# ============================================
# Profile Edit Request Routes
# ============================================


@app.route("/api/user/request-edit", methods=["POST"])
@verify_token
def request_profile_edit():
    try:
        data = request.get_json()
        if not data:
            return error_response("البيانات غير صالحة", 400)
        full_name = data.get("full_name", "").strip()
        bio = data.get("bio", "").strip()
        if not full_name:
            return error_response("الاسم الكامل مطلوب", 400)
        firebase_service = get_firebase_service()
        profile = firebase_service.get_user_profile(request.user_id)
        if not profile:
            return error_response("المستخدم غير موجود", 404)
        db = firebase_service.get_database()
        existing = list(
            db.collection("edit_requests")
            .where("uid", "==", request.user_id)
            .where("status", "==", "pending")
            .limit(1)
            .stream()
        )
        if existing:
            return error_response("لديك طلب تعديل معلق. انتظر موافقة الإدارة.", 409)
        req_ref = db.collection("edit_requests").document()
        req_ref.set(
            {
                "uid": request.user_id,
                "email": profile.get("email"),
                "requested_data": {"full_name": full_name, "bio": bio},
                "current_data": {
                    "full_name": profile.get("full_name", ""),
                    "bio": profile.get("bio", ""),
                },
                "status": "pending",
                "created_at": firestore.SERVER_TIMESTAMP,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
        )
        firebase_service.log_operation(
            request.user_id, "request_edit", {"request_id": req_ref.id}
        )
        return success_response(
            {"request_id": req_ref.id, "message": "تم إرسال طلب التعديل للإدارة"},
            "تم الإرسال",
            201,
        )
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/user/edit-request", methods=["GET"])
@verify_token
def get_user_edit_request():
    try:
        firebase_service = get_firebase_service()
        db = firebase_service.get_database()
        docs = list(
            db.collection("edit_requests")
            .where("uid", "==", request.user_id)
            .limit(20)
            .stream()
        )
        if not docs:
            return success_response({"request": None}, "تم الجلب", 200)
        requests_list = [
            {"id": doc.id, **doc.to_dict()} for doc in docs if doc.to_dict()
        ]

        def sort_key(r):
            ts = r.get("created_at")
            return ts.seconds if ts and hasattr(ts, "seconds") else 0

        requests_list.sort(key=sort_key, reverse=True)
        return success_response(
            {"request": requests_list[0] if requests_list else None}, "تم الجلب", 200
        )
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


# ============================================
# Admin Routes
# ============================================


@app.route("/api/admin/users", methods=["GET"])
@verify_token
@require_admin
def admin_get_users():
    try:
        firebase_service = get_firebase_service()
        result = firebase_service.get_all_users()
        if not result.get("success"):
            return error_response(result.get("error", "فشل الجلب"), 500)
        return success_response(
            {"users": result.get("users", []), "total": result.get("count", 0)},
            "تم الجلب",
            200,
        )
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/admin/user/<target_uid>", methods=["GET"])
@verify_token
@require_admin
def admin_get_user_details(target_uid):
    try:
        firebase_service = get_firebase_service()
        profile = firebase_service.get_user_profile(target_uid)
        if not profile:
            return error_response("المستخدم غير موجود", 404)
        return success_response({"user": profile}, "تم الجلب", 200)
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/admin/edit-requests", methods=["GET"])
@verify_token
@require_admin
def admin_get_edit_requests():
    try:
        firebase_service = get_firebase_service()
        db = firebase_service.get_database()
        docs = list(db.collection("edit_requests").limit(100).stream())
        requests_list = [
            {"id": doc.id, **doc.to_dict()} for doc in docs if doc.to_dict()
        ]

        def sort_key(r):
            ts = r.get("created_at")
            return ts.seconds if ts and hasattr(ts, "seconds") else 0

        requests_list.sort(key=sort_key, reverse=True)
        return success_response({"requests": requests_list}, "تم الجلب", 200)
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/admin/edit-requests/<request_id>", methods=["POST"])
@verify_token
@require_admin
def admin_handle_edit_request(request_id):
    try:
        data = request.get_json()
        action = data.get("action") if data else None
        if action not in ("approve", "reject"):
            return error_response("الإجراء غير صالح", 400)
        firebase_service = get_firebase_service()
        db = firebase_service.get_database()
        req_ref = db.collection("edit_requests").document(request_id)
        req_doc = req_ref.get()
        if not req_doc.exists:
            return error_response("الطلب غير موجود", 404)
        req_data = req_doc.to_dict()
        if req_data.get("status") != "pending":
            return error_response("هذا الطلب تم معالجته بالفعل", 409)
        if action == "approve":
            uid = req_data.get("uid")
            new_data = req_data.get("requested_data", {})
            db.collection("users").document(uid).update(
                {
                    "full_name": new_data.get("full_name", ""),
                    "bio": new_data.get("bio", ""),
                    "updated_at": firestore.SERVER_TIMESTAMP,
                }
            )
            status, message = "approved", "تمت الموافقة على التعديل وتطبيقه"
        else:
            status, message = "rejected", "تم رفض طلب التعديل"
        req_ref.update(
            {
                "status": status,
                "updated_at": firestore.SERVER_TIMESTAMP,
                "reviewed_by": request.user_id,
            }
        )
        firebase_service.log_operation(
            request.user_id,
            "admin_review_edit",
            {
                "request_id": request_id,
                "action": action,
                "target_uid": req_data.get("uid"),
            },
        )
        return success_response({"action": action, "status": status}, message, 200)
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


@app.route("/api/stats", methods=["GET"])
@verify_token
def get_stats():
    try:
        firebase_service = get_firebase_service()
        result = firebase_service.get_stats()
        return success_response(result, "تم الجلب", 200)
    except Exception as e:
        return error_response("خطأ: %s" % str(e), 500)


# ============================================
# Error Handlers
# ============================================


@app.errorhandler(404)
def not_found(e):
    return error_response("الصفحة غير موجودة", 404, "NOT_FOUND")


@app.errorhandler(413)
def file_too_large(e):
    return error_response(
        "حجم الملف كبير جداً (الحد الأقصى 50MB)", 413, "FILE_TOO_LARGE"
    )


@app.errorhandler(500)
def internal_error(e):
    logger.error("خطأ داخلي: %s", str(e))
    return error_response("خطأ داخلي", 500, "INTERNAL_ERROR")


@app.errorhandler(429)
def rate_limit_error(e):
    return error_response(
        "تجاوزت الحد المسموح. انتظر قليلاً.", 429, "RATE_LIMIT_EXCEEDED"
    )


# ============================================
# Main
# ============================================

if __name__ == "__main__":
    Config.print_config()
    for w in Config.validate().get("warnings", []):
        logger.warning("⚠️ %s", w)
    port = int(os.getenv("FLASK_PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    print("\n🚀 تشغيل الخادم على %s:%d" % (host, port))
    app.run(host=host, port=port, debug=debug)