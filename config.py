"""
SecureEncrypt - config.py
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:

    # ── Flask ──────────────────────────────────────────────────────
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-key-change-in-production")
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = os.getenv("FLASK_DEBUG", "1") == "1"
    PORT = int(os.getenv("FLASK_PORT", 5000))
    HOST = os.getenv("FLASK_HOST", "0.0.0.0")

    # ── Security ───────────────────────────────────────────────────
    SESSION_TIMEOUT = int(os.getenv("SESSION_TIMEOUT", 3600))
    TOKEN_EXPIRY = int(os.getenv("TOKEN_EXPIRY", 86400))
    OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", 5))
    MAX_OTP_REQUESTS_PER_HOUR = int(os.getenv("MAX_OTP_REQUESTS_PER_HOUR", 5))
    MAX_OTP_ATTEMPTS = int(os.getenv("MAX_OTP_ATTEMPTS", 3))
    MAX_KEY_REQUESTS_PER_DAY = int(os.getenv("MAX_KEY_REQUESTS_PER_DAY", 10))

    # ── Firebase ───────────────────────────────────────────────────
    FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS", "serviceAccountKey.json")
    FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "omar-encryption-project-87055")
    FIREBASE_STORAGE_BUCKET = os.getenv(
        "FIREBASE_STORAGE_BUCKET",
        "%s.appspot.com" % os.getenv("FIREBASE_PROJECT_ID", "omar-encryption-project-87055"),
    )

    # ── Cloudinary ─────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

    # ── Email ──────────────────────────────────────────────────────
    SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    GMAIL_SENDER = os.getenv("GMAIL_SENDER", "")
    GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "True") == "True"

    # ── CORS ───────────────────────────────────────────────────────
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", FRONTEND_URL).split(",")
    CORS_SUPPORTS_CREDENTIALS = True

    # ── Files ──────────────────────────────────────────────────────
    MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 50 * 1024 * 1024))

    # امتدادات الملفات العادية
    ALLOWED_FILE_EXTENSIONS = {
        "txt",
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
        "zip",
        "rar",
        "7z",
        "mp3",
        "mp4",
        "avi",
        "mkv",
    }

    # امتدادات الصور
    IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"}

    # كل الامتدادات المسموحة
    ALL_ALLOWED_EXTENSIONS = ALLOWED_FILE_EXTENSIONS | IMAGE_EXTENSIONS

    # ── Logging ────────────────────────────────────────────────────
    LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG")
    LOG_FILE = os.getenv("LOG_FILE", "logs/app.log")
    LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # ── Firestore Collections ──────────────────────────────────────
    USERS_COLLECTION = "users"
    OPERATIONS_COLLECTION = "operation_logs"
    OTP_COLLECTION = "otp_verification"
    FILES_COLLECTION = "encrypted_files"

    # ── Performance ────────────────────────────────────────────────
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", 30))
    RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", 60))

    @staticmethod
    def is_development():
        return Config.FLASK_ENV == "development"

    @staticmethod
    def is_production():
        return Config.FLASK_ENV == "production"

    @staticmethod
    def validate():
        errors, warnings = [], []
        if Config.SECRET_KEY == "dev-key-change-in-production":
            warnings.append("SECRET_KEY is using default value.")
        if not os.path.exists(Config.FIREBASE_CREDENTIALS):
            errors.append(
                "Firebase credentials file not found: %s" % Config.FIREBASE_CREDENTIALS
            )
        if not Config.GMAIL_SENDER:
            warnings.append("GMAIL_SENDER not configured.")
        if not Config.CLOUDINARY_CLOUD_NAME:
            warnings.append(
                "CLOUDINARY not configured — images will use Firebase Storage."
            )
        return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}

    @staticmethod
    def print_config():
        print("\n" + "=" * 50)
        print("📋 تطبيق إعدادات التكوين")
        print("=" * 50)
        print("🌍 البيئة: %s" % Config.FLASK_ENV)
        print("🐛 وضع التصحيح: %s" % Config.DEBUG)
        print("🔑 المفتاح السري: %s" % ("*" * 20))
        print("🔥 Firebase Project: %s" % Config.FIREBASE_PROJECT_ID)
        print("📧 البريد المرسل: %s" % (Config.GMAIL_SENDER or "غير مُعدّد"))
        print("🌐 Frontend URL: %s" % Config.FRONTEND_URL)
        print("⏱️ OTP Expiry: %s دقائق" % Config.OTP_EXPIRY_MINUTES)
        print("📁 الحد الأقصى للملف: %.1f MB" % (Config.MAX_FILE_SIZE / (1024 * 1024)))
        print("☁️ Cloudinary: %s" % (Config.CLOUDINARY_CLOUD_NAME or "غير مُعدّد"))
        print("=" * 50 + "\n")


class DevelopmentConfig(Config):
    DEBUG = True
    LOG_LEVEL = "DEBUG"


class ProductionConfig(Config):
    DEBUG = False
    LOG_LEVEL = "WARNING"


class TestingConfig(Config):
    DEBUG = True
    TESTING = True


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}


def get_config():
    return config_by_name.get(os.getenv("FLASK_ENV", "development"), DevelopmentConfig)