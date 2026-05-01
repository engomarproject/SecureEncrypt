content = """FLASK_SECRET_KEY=super_secret_omar_project_key_2025
FLASK_ENV=development
FLASK_DEBUG=1
FLASK_PORT=5000
FLASK_HOST=0.0.0.0
FIREBASE_CREDENTIALS=serviceAccountKey.json
FIREBASE_PROJECT_ID=omar-encryption-project-87055
FIREBASE_STORAGE_BUCKET=omar-encryption-project-87055.appspot.com
GMAIL_SENDER=hamdyomar589@gmail.com
GMAIL_APP_PASSWORD=kahswwgzkejmcrzr
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_TLS=True
EMAIL_DISPLAY_NAME=SecureEncrypt
FRONTEND_URL=http://localhost:5173
OTP_EXPIRY_MINUTES=5
MAX_OTP_REQUESTS_PER_HOUR=5
MAX_OTP_ATTEMPTS=3
MAX_KEY_REQUESTS_PER_DAY=10
SESSION_TIMEOUT=3600
TOKEN_EXPIRY=86400
ADMIN_EMAIL=admin_omar@gmail.com
ADMIN_UID=UP9IVetpO7WqyiRIFhhqCIkHUAk2
MAX_FILE_SIZE=52428800
CLOUDINARY_CLOUD_NAME=dxyv24kwr
CLOUDINARY_API_KEY=449345379573548
CLOUDINARY_API_SECRET=6zxliolhBVJvxRzpkBxbJR3z75E
"""

with open(".env", "w", encoding="utf-8") as f:
    f.write(content)

print("✅ تم تحديث .env بنجاح!")

# تحقق فوري
from dotenv import dotenv_values
v = dotenv_values(".env")
print("CLOUDINARY:", v.get("CLOUDINARY_CLOUD_NAME"))
print("FIREBASE:", v.get("FIREBASE_PROJECT_ID"))