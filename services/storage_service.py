"""
SecureEncrypt - Storage Service
كل الملفات → Cloudinary (مجاني 25GB، يدعم كل أنواع الملفات)
"""

import io
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"}

_cloudinary_ready = False


def _init_cloudinary() -> bool:
    global _cloudinary_ready
    if _cloudinary_ready:
        return True
    try:
        import cloudinary

        cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
        if not cloud_name:
            raise Exception("CLOUDINARY_CLOUD_NAME missing in .env")
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=os.getenv("CLOUDINARY_API_KEY", ""),
            api_secret=os.getenv("CLOUDINARY_API_SECRET", ""),
            secure=True,
        )
        _cloudinary_ready = True
        print("✅ Cloudinary جاهز: %s" % cloud_name)
        return True
    except ImportError:
        print("⚠️  cloudinary غير مثبّت — شغّل: pip install cloudinary")
        return False
    except Exception as e:
        print("❌ Cloudinary init error: %s" % str(e))
        return False


def is_image(filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in IMAGE_EXTENSIONS


# ================================================================ #
# رفع ملف مشفر
# ================================================================ #


def upload_encrypted_file(
    encrypted_bytes: bytes,
    original_filename: str,
    uid: str,
    mime_type: str = "application/octet-stream",
) -> dict:
    """
    ✅ كل الملفات ترفع على Cloudinary كـ raw resource
    الصور والملفات الأخرى — نفس المعاملة (raw) عشان المحتوى مشفر
    """
    if not _init_cloudinary():
        return {
            "success": False,
            "error": "Cloudinary غير مهيأ — تأكد من CLOUDINARY_CLOUD_NAME في .env",
            "storage": None,
            "url": None,
            "storage_path": None,
            "public_id": None,
        }

    try:
        import cloudinary.uploader

        # اسم الملف بدون امتداد + .enc للدلالة على التشفير
        base_name = (
            original_filename.rsplit(".", 1)[0]
            if "." in original_filename
            else original_filename
        )
        public_id = "secureencrypt/%s/%s.enc" % (uid, base_name)

        result = cloudinary.uploader.upload(
            io.BytesIO(encrypted_bytes),
            resource_type="raw",  # ✅ يدعم كل أنواع الملفات
            public_id=public_id,
            overwrite=True,
        )

        url = result.get("secure_url")
        print(
            "✅ Cloudinary upload: %s (%s)"
            % (original_filename, _human_size(len(encrypted_bytes)))
        )

        return {
            "success": True,
            "storage": "cloudinary",
            "url": url,
            "public_id": result.get("public_id"),
            "storage_path": None,
        }

    except Exception as e:
        print("❌ Cloudinary upload error: %s" % str(e))
        return {
            "success": False,
            "error": "Cloudinary: %s" % str(e),
            "storage": None,
            "url": None,
            "storage_path": None,
            "public_id": None,
        }


# ================================================================ #
# تحميل ملف مشفر
# ================================================================ #


def download_encrypted_file(file_record: dict) -> Optional[bytes]:
    """يجيب bytes الملف المشفر من Cloudinary أو inline (قديم)."""
    storage = file_record.get("storage", "inline")

    try:
        if storage == "cloudinary":
            url = file_record.get("url")
            if not url:
                print("❌ Cloudinary URL مفقود")
                return None
            return _download_from_url(url)

        else:
            # inline قديم (ملفات صغيرة جداً < 1MB كانت متخزنة في Firestore)
            import base64

            data = file_record.get("inline_data") or file_record.get(
                "encrypted_content"
            )
            if not data:
                return None
            try:
                return base64.b64decode(data)
            except Exception:
                return data.encode("utf-8") if isinstance(data, str) else data

    except Exception as e:
        print("❌ download_encrypted_file [%s]: %s" % (storage, str(e)))
        return None


def _download_from_url(url: str) -> Optional[bytes]:
    if not url:
        return None
    try:
        import urllib.request

        req = urllib.request.Request(url, headers={"User-Agent": "SecureEncrypt/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        print("✅ Downloaded %s from Cloudinary" % _human_size(len(data)))
        return data
    except Exception as e:
        print("❌ _download_from_url: %s" % str(e))
        return None


# ================================================================ #
# حذف ملف
# ================================================================ #


def delete_encrypted_file(file_record: dict) -> bool:
    storage = file_record.get("storage", "inline")
    try:
        if storage == "cloudinary" and _init_cloudinary():
            import cloudinary.uploader

            pid = file_record.get("public_id", "")
            if pid:
                cloudinary.uploader.destroy(pid, resource_type="raw")
                print("✅ Cloudinary delete: %s" % pid)
        return True
    except Exception as e:
        print("⚠️ delete_encrypted_file: %s" % str(e))
        return False


# ================================================================ #
# Helper
# ================================================================ #


def _human_size(b: int) -> str:
    if b < 1024:
        return "%d B" % b
    if b < 1024**2:
        return "%.1f KB" % (b / 1024)
    return "%.1f MB" % (b / 1024**2)