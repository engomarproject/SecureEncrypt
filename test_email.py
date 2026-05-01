"""
test_email.py - اختبار إرسال الإيميل
شغّل: python test_email.py
"""

import os
from dotenv import load_dotenv

load_dotenv()

print("=" * 50)
print("🧪 اختبار إعدادات الإيميل")
print("=" * 50)

sender = os.getenv("GMAIL_SENDER", "").strip()
password = os.getenv("GMAIL_APP_PASSWORD", "").strip()
password_no_spaces = password.replace(" ", "")

print("📧 المرسل:        ", sender)
print(
    "🔑 App Password:  ",
    "*" * len(password_no_spaces),
    "(",
    len(password_no_spaces),
    "حرف)",
)

if len(password_no_spaces) != 16:
    print("\n❌ خطأ: App Password يجب أن يكون 16 حرف بالضبط!")
    print("   عندك:", len(password_no_spaces), "حرف")
    print("   تأكد من نسخه صحيح من Google Account")
else:
    print("✅ طول الـ App Password صحيح (16 حرف)")

print("\n--- اختبار الاتصال ---")
import smtplib

try:
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(sender, password_no_spaces)
        print("✅ الاتصال بـ Gmail ناجح!")

        # إرسال إيميل تجريبي
        test_to = input("\nأدخل إيميل للاختبار (أو Enter لتخطي): ").strip()
        if test_to:
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart()
            msg["From"] = '"SecureEncrypt" <%s>' % sender
            msg["To"] = test_to
            msg["Subject"] = "✅ اختبار SecureEncrypt"
            msg.attach(
                MIMEText(
                    "إيميل تجريبي من SecureEncrypt - يعمل بشكل صحيح!", "plain", "utf-8"
                )
            )
            server.send_message(msg)
            print("✅ تم إرسال الإيميل التجريبي إلى:", test_to)

except smtplib.SMTPAuthenticationError as e:
    print("❌ خطأ مصادقة:", str(e))
    print("\nالحل:")
    print("1. روح https://myaccount.google.com/security")
    print("2. فعّل 2-Step Verification")
    print("3. ابحث عن 'App passwords'")
    print("4. أنشئ App Password جديد لـ 'Mail'")
    print("5. انسخ الـ 16 حرف بدون مسافات في .env")
except Exception as e:
    print("❌ خطأ:", str(e))

print("\n" + "=" * 50)
