"""
============================================
مشروع أداة التشفير وفك التشفير الآمنة
الطالب: عمر حمدي عبد العزيز - 22510462
الملف: utils.py - الدوال المساعدة والأدوات
============================================

الوظيفة:
- دوال مساعدة مشتركة لجميع مكونات الباك إند
- معالجة الاستجابات بشكل موحد
- التحقق من صحة البيانات
- تنسيق التواريخ والأوقات
- توليد رموز عشوائية آمنة
- تسجيل السجلات بشكل منظم
"""

import os
import re
import random
import string
import logging
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g
from typing import Optional, Dict, Any, Callable
import hashlib
import hmac
import time

# ============================================
# 1. إعدادات تسجيل السجلات (Logging Setup)
# ============================================


def setup_logger(
    name: str, log_file: Optional[str] = None, level: int = logging.INFO
) -> logging.Logger:
    """
    إعداد مسجل سجلات مخصص

    Args:
        name (str): اسم المسجل
        log_file (str, optional): مسار ملف السجلات
        level (int): مستوى السجلات

    Returns:
        logging.Logger: مسجل السجلات
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # إنشاء formatter
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # إضافة handler للـ console
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # إضافة handler للملف (إذا تم تحديده)
    if log_file:
        # إنشاء مجلد السجلات إذا لم يكن موجوداً
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)

        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


# إنشاء مسجل سجلات عام
logger = setup_logger("EncryptionTool", "logs/app.log")


# ============================================
# 2. دوال معالجة الاستجابات (Response Helpers)
# ============================================


def success_response(
    data: Any = None, message: str = "تمت العملية بنجاح", status_code: int = 200
) -> tuple:
    """
    إنشاء استجابة نجاح موحدة

    Args:
        data (Any): البيانات المراد إرجاعها
        message (str): رسالة النجاح
        status_code (int): رمز حالة HTTP

    Returns:
        tuple: (response_json, status_code)
    """
    response = {
        "success": True,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat(),
    }
    return jsonify(response), status_code


def error_response(
    message: str = "حدث خطأ", status_code: int = 400, error_code: Optional[str] = None
) -> tuple:
    """
    إنشاء استجابة خطأ موحدة

    Args:
        message (str): رسالة الخطأ
        status_code (int): رمز حالة HTTP
        error_code (str, optional): كود الخطأ الداخلي

    Returns:
        tuple: (response_json, status_code)
    """
    response = {
        "success": False,
        "message": message,
        "error_code": error_code,
        "timestamp": datetime.now().isoformat(),
    }
    return jsonify(response), status_code


def validation_error(errors: Dict[str, str]) -> tuple:
    """
    إنشاء استجابة خطأ تحقق من صحة البيانات

    Args:
        errors (dict): قاموس بأخطاء التحقق {field: message}

    Returns:
        tuple: (response_json, status_code)
    """
    response = {
        "success": False,
        "message": "خطأ في التحقق من البيانات",
        "errors": errors,
        "timestamp": datetime.now().isoformat(),
    }
    return jsonify(response), 422


# ============================================
# 3. دوال التحقق من صحة البيانات (Validation Helpers)
# ============================================


def validate_email(email: str) -> bool:
    """
    التحقق من صحة عنوان البريد الإلكتروني

    Args:
        email (str): البريد الإلكتروني للتحقق

    Returns:
        bool: True إذا كان البريد صالح
    """
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def validate_password(password: str, min_length: int = 8) -> Dict[str, Any]:
    """
    التحقق من قوة كلمة المرور

    Args:
        password (str): كلمة المرور للتحقق
        min_length (int): الحد الأدنى للطول

    Returns:
        dict: {
            'valid': bool,
            'errors': list,
            'strength': str (weak/medium/strong)
        }
    """
    errors = []
    strength_score = 0

    # التحقق من الطول
    if len(password) < min_length:
        errors.append(f"كلمة المرور يجب أن تكون {min_length} أحرف على الأقل")
    else:
        strength_score += 1

    # التحقق من الأحرف الصغيرة
    if re.search(r"[a-z]", password):
        strength_score += 1
    else:
        errors.append("كلمة المرور يجب أن تحتوي على أحرف صغيرة")

    # التحقق من الأحرف الكبيرة
    if re.search(r"[A-Z]", password):
        strength_score += 1
    else:
        errors.append("كلمة المرور يجب أن تحتوي على أحرف كبيرة")

    # التحقق من الأرقام
    if re.search(r"\d", password):
        strength_score += 1
    else:
        errors.append("كلمة المرور يجب أن تحتوي على أرقام")

    # التحقق من الرموز الخاصة
    if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        strength_score += 1
    else:
        errors.append("كلمة المرور يجب أن تحتوي على رموز خاصة")

    # تحديد قوة كلمة المرور
    if strength_score <= 2:
        strength = "weak"
    elif strength_score <= 4:
        strength = "medium"
    else:
        strength = "strong"

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "strength": strength,
        "score": strength_score,
    }


def validate_encryption_key(key: str) -> bool:
    """
    التحقق من صحة مفتاح التشفير Fernet

    Args:
        key (str): مفتاح التشفير للتحقق

    Returns:
        bool: True إذا كان المفتاح صالح
    """
    # مفتاح Fernet يجب أن يكون 44 حرف Base64
    if not key or len(key) != 44:
        return False

    # التحقق من تنسيق Base64
    try:
        import base64

        base64.urlsafe_b64decode(key)
        return True
    except Exception:
        return False


def sanitize_input(text: str) -> str:
    """
    تنظيف المدخلات من الأحرف الخطرة

    Args:
        text (str): النص المراد تنظيفه

    Returns:
        str: النص المنظف
    """
    if not text:
        return ""

    # إزالة الأحرف غير الصالحة
    text = text.strip()

    # منع حقن الأكواد
    dangerous_patterns = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe[^>]*>",
    ]

    for pattern in dangerous_patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE | re.DOTALL)

    return text


# ============================================
# 4. دوال التوقيت والتاريخ (Time & Date Helpers)
# ============================================


def get_current_timestamp() -> str:
    """
    الحصول على الطابع الزمني الحالي

    Returns:
        str: الطابع الزمني بصيغة ISO
    """
    return datetime.now().isoformat()


def get_expiry_timestamp(minutes: int = 5) -> datetime:
    """
    الحصول على وقت الانتهاء

    Args:
        minutes (int): عدد الدقائق من الآن

    Returns:
        datetime: وقت الانتهاء
    """
    return datetime.now() + timedelta(minutes=minutes)


def is_expired(timestamp: datetime) -> bool:
    """
    التحقق من انتهاء الصلاحية

    Args:
        timestamp (datetime): وقت الانتهاء للتحقق

    Returns:
        bool: True إذا انتهى الوقت
    """
    return datetime.now() > timestamp


def format_timestamp(timestamp: datetime, format_str: str = "%Y-%m-%d %H:%M:%S") -> str:
    """
    تنسيق الطابع الزمني

    Args:
        timestamp (datetime): الطابع الزمني
        format_str (str): تنسيق الإخراج

    Returns:
        str: الطابع الزمني المنسق
    """
    return timestamp.strftime(format_str)


def get_time_remaining(timestamp: datetime) -> Dict[str, int]:
    """
    الحصول على الوقت المتبقي حتى الانتهاء

    Args:
        timestamp (datetime): وقت الانتهاء

    Returns:
        dict: {
            'minutes': int,
            'seconds': int,
            'total_seconds': int
        }
    """
    now = datetime.now()
    if timestamp <= now:
        return {"minutes": 0, "seconds": 0, "total_seconds": 0}

    remaining = timestamp - now
    total_seconds = int(remaining.total_seconds())

    return {
        "minutes": total_seconds // 60,
        "seconds": total_seconds % 60,
        "total_seconds": total_seconds,
    }


# ============================================
# 5. دوال التوليد العشوائي (Random Generation Helpers)
# ============================================


def generate_otp(length: int = 6) -> str:
    """
    توليد رمز OTP عشوائي

    Args:
        length (int): طول الرمز

    Returns:
        str: رمز OTP
    """
    return "".join(random.choices(string.digits, k=length))


def generate_secure_token(length: int = 32) -> str:
    """
    توليد رمز أمني عشوائي آمن

    Args:
        length (int): طول الرمز

    Returns:
        str: رمز أمني
    """
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def generate_session_id() -> str:
    """
    توليد معرف جلسة فريد

    Returns:
        str: معرف الجلسة
    """
    import uuid

    return str(uuid.uuid4())


def generate_hash(data: str, salt: Optional[str] = None) -> str:
    """
    توليد hash آمن للبيانات

    Args:
        data (str): البيانات للـ hash
        salt (str, optional): salt للـ hash

    Returns:
        str: الـ hash بصيغة hex
    """
    if salt:
        data = data + salt

    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def verify_hash(data: str, hash_value: str, salt: Optional[str] = None) -> bool:
    """
    التحقق من صحة hash

    Args:
        data (str): البيانات الأصلية
        hash_value (str): الـ hash المخزن
        salt (str, optional): salt المستخدم

    Returns:
        bool: True إذا كان الـ hash صحيح
    """
    generated_hash = generate_hash(data, salt)
    return hmac.compare_digest(generated_hash, hash_value)


# ============================================
# 6. دوال معالجة الملفات (File Handling Helpers)
# ============================================


def allowed_file(filename: str, allowed_extensions: set) -> bool:
    """
    التحقق من امتداد الملف المسموح

    Args:
        filename (str): اسم الملف
        allowed_extensions (set): الامتدادات المسموحة

    Returns:
        bool: True إذا كان الامتداد مسموح
    """
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions


def get_file_size(file_path: str) -> int:
    """
    الحصول على حجم الملف بالبايت

    Args:
        file_path (str): مسار الملف

    Returns:
        int: حجم الملف
    """
    return os.path.getsize(file_path)


def format_file_size(size_bytes: int) -> str:
    """
    تنسيق حجم الملف بشكل مقروء

    Args:
        size_bytes (int): الحجم بالبايت

    Returns:
        str: الحجم منسق (KB, MB, GB)
    """
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def secure_filename(filename: str) -> str:
    """
    تنظيف اسم الملف من الأحرف الخطرة

    Args:
        filename (str): اسم الملف الأصلي

    Returns:
        str: اسم الملف الآمن
    """
    # إزالة الأحرف الخاصة
    filename = re.sub(r"[^\w\s.-]", "", filename)

    # إزالة المسافات الزائدة
    filename = filename.strip()

    # استبدال المسافات بشرطات سفلية
    filename = filename.replace(" ", "_")

    # منع أسماء الملفات المحظورة
    forbidden_names = [".", "..", "con", "prn", "aux", "nul", "com1", "com2"]
    if filename.lower() in forbidden_names:
        filename = "file_" + filename

    return filename


# ============================================
# 7. Decorators للمصادقة والتحقق (Auth Decorators)
# ============================================


def rate_limit(max_requests: int = 60, per_seconds: int = 60):
    """
    Decorator للحد من معدل الطلبات (Rate Limiting)

    Args:
        max_requests (int): الحد الأقصى للطلبات
        per_seconds (int): الفترة الزمنية بالثواني

    Returns:
        function: decorator
    """
    request_history = {}

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapped(*args, **kwargs):
            client_ip = request.remote_addr
            current_time = time.time()

            # تنظيف السجلات القديمة
            if client_ip in request_history:
                request_history[client_ip] = [
                    t
                    for t in request_history[client_ip]
                    if current_time - t < per_seconds
                ]
            else:
                request_history[client_ip] = []

            # التحقق من الحد
            if len(request_history[client_ip]) >= max_requests:
                return error_response(
                    "تجاوزت الحد المسموح للطلبات. يرجى الانتظار.",
                    429,
                    "RATE_LIMIT_EXCEEDED",
                )

            # تسجيل الطلب
            request_history[client_ip].append(current_time)

            return f(*args, **kwargs)

        return wrapped

    return decorator


def log_operation(operation_type: str):
    """
    Decorator لتسجيل العمليات

    Args:
        operation_type (str): نوع العملية

    Returns:
        function: decorator
    """

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapped(*args, **kwargs):
            start_time = time.time()

            try:
                result = f(*args, **kwargs)

                # تسجيل العملية الناجحة
                duration = time.time() - start_time
                logger.info(
                    f"Operation: {operation_type} | "
                    f"Status: Success | "
                    f"Duration: {duration:.2f}s | "
                    f"IP: {request.remote_addr}"
                )

                return result

            except Exception as e:
                # تسجيل العملية الفاشلة
                logger.error(
                    f"Operation: {operation_type} | "
                    f"Status: Failed | "
                    f"Error: {str(e)} | "
                    f"IP: {request.remote_addr}"
                )
                raise

        return wrapped

    return decorator


# ============================================
# 8. دوال مساعدة إضافية (Additional Helpers)
# ============================================


def get_client_ip() -> str:
    """
    الحصول على عنوان IP للعميل

    Returns:
        str: عنوان IP
    """
    if request.headers.get("X-Forwarded-For"):
        return request.headers.get("X-Forwarded-For").split(",")[0].strip()
    return request.remote_addr or "unknown"


def get_user_agent() -> str:
    """
    الحصول على معلومات متصفح المستخدم

    Returns:
        str: User Agent string
    """
    return request.headers.get("User-Agent", "unknown")


def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """
    اختصار النص إذا كان طويلاً جداً

    Args:
        text (str): النص الأصلي
        max_length (int): الحد الأقصى للطول
        suffix (str): اللاحقة للإضافة

    Returns:
        str: النص المختصر
    """
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix


def mask_sensitive_data(data: str, visible_chars: int = 4) -> str:
    """
    إخفاء البيانات الحساسة للعرض

    Args:
        data (str): البيانات الحساسة
        visible_chars (int): عدد الأحرف الظاهرة

    Returns:
        str: البيانات маскиة
    """
    if len(data) <= visible_chars:
        return "*" * len(data)

    return data[:visible_chars] + "*" * (len(data) - visible_chars)


# ============================================
# 9. فئة مساعدة شاملة (Utility Class)
# ============================================


class Utils:
    """
    فئة تجمع جميع الدوال المساعدة للاستخدام السهل
    """

    @staticmethod
    def success(data=None, message="تمت العملية بنجاح", status_code=200):
        return success_response(data, message, status_code)

    @staticmethod
    def error(message="حدث خطأ", status_code=400, error_code=None):
        return error_response(message, status_code, error_code)

    @staticmethod
    def validate_email(email):
        return validate_email(email)

    @staticmethod
    def validate_password(password, min_length=8):
        return validate_password(password, min_length)

    @staticmethod
    def generate_otp(length=6):
        return generate_otp(length)

    @staticmethod
    def get_timestamp():
        return get_current_timestamp()

    @staticmethod
    def log(message, level="info"):
        if level == "info":
            logger.info(message)
        elif level == "warning":
            logger.warning(message)
        elif level == "error":
            logger.error(message)
        elif level == "debug":
            logger.debug(message)
