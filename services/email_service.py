"""
SecureEncrypt - Email Service
"""

import os
import random
import string
import logging
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("EmailService")


class EmailService:

    def __init__(self):
        # ✅ strip() لإزالة أي مسافات أو أسطر جديدة من القيم
        self.sender_email = (os.getenv("GMAIL_SENDER") or "").strip()
        self.sender_password = (os.getenv("GMAIL_APP_PASSWORD") or "").strip()
        self.smtp_server = (os.getenv("SMTP_SERVER", "smtp.gmail.com")).strip()
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.display_name = (os.getenv("EMAIL_DISPLAY_NAME", "SecureEncrypt")).strip()

        if not self.sender_email:
            raise ValueError("GMAIL_SENDER غير موجود في .env")
        if not self.sender_password:
            raise ValueError("GMAIL_APP_PASSWORD غير موجود في .env")

        logger.info("✅ EmailService initialized: %s", self.sender_email)

    def generate_otp(self, length=6):
        return "".join(random.choices(string.digits, k=length))

    def _from_header(self):
        """SecureEncrypt <email@gmail.com>"""
        return '"%s" <%s>' % (self.display_name, self.sender_email)

    def _send(self, msg):
        """
        ✅ إرسال الإيميل مع retry واحدة لو فشل الاتصال
        """
        for attempt in range(2):
            try:
                with smtplib.SMTP(
                    self.smtp_server, self.smtp_port, timeout=30
                ) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    # ✅ إزالة المسافات من الـ password عند الاستخدام
                    password = self.sender_password.replace(" ", "")
                    server.login(self.sender_email, password)
                    server.send_message(msg)
                    logger.info("✅ إيميل أُرسل إلى: %s", msg["To"])
                    return True
            except smtplib.SMTPAuthenticationError as e:
                logger.error("❌ خطأ مصادقة SMTP: %s", str(e))
                raise Exception(
                    "فشل تسجيل الدخول لـ Gmail. تأكد من:\n"
                    "1. App Password صحيح (16 حرف بدون مسافات)\n"
                    "2. تفعيل 2-Step Verification على الحساب\n"
                    "3. إنشاء App Password من myaccount.google.com/security"
                )
            except smtplib.SMTPException as e:
                if attempt == 0:
                    logger.warning("محاولة إعادة الإرسال... %s", str(e))
                    continue
                raise Exception("فشل SMTP: %s" % str(e))
            except Exception as e:
                if attempt == 0:
                    logger.warning("محاولة إعادة الإرسال... %s", str(e))
                    continue
                raise
        return False

    # ================================================================ #
    # مفتاح التشفير
    # ================================================================ #

    def send_encryption_key_email(
        self, recipient_email, encryption_key, user_name=None
    ):
        try:
            name = (user_name or "").strip() or "عزيزي المستخدم"
            year = datetime.now().year

            msg = MIMEMultipart("alternative")
            msg["From"] = self._from_header()
            msg["To"] = recipient_email
            msg["Subject"] = "🔐 مفتاح التشفير الخاص بك - SecureEncrypt"

            # Plain text
            text = (
                "مرحباً %s،\n\n"
                "مفتاح التشفير الخاص بك:\n%s\n\n"
                "⚠️ احتفظ به في مكان آمن ولا تشاركه مع أحد.\n\n"
                "SecureEncrypt"
            ) % (name, encryption_key)

            # HTML
            html = """<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6fb;direction:rtl;text-align:right;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#2563eb,#1e40af);padding:28px;border-radius:12px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">🔐 SecureEncrypt</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">أداة التشفير الآمنة</p>
  </div>
  <div style="background:#fff;padding:28px;border-radius:12px;margin-top:16px;border:1px solid #e2e8f0;">
    <h2 style="color:#0f1728;font-size:18px;">مرحباً %s</h2>
    <p style="color:#555;line-height:1.8;font-size:14px;">هذا هو مفتاح التشفير الخاص بحسابك. احتفظ به في مكان آمن.</p>
    <div style="background:#eff6ff;border:2px dashed #2563eb;padding:20px;border-radius:10px;margin:20px 0;">
      <p style="color:#2563eb;font-weight:bold;margin:0 0 10px;font-size:13px;">مفتاح التشفير:</p>
      <code style="background:#dbeafe;padding:12px;border-radius:6px;word-break:break-all;display:block;font-size:13px;color:#1e3a5f;line-height:1.7;">%s</code>
    </div>
    <div style="background:#fefce8;border:1px solid #d97706;padding:16px;border-radius:8px;margin:20px 0;">
      <p style="color:#b45309;font-weight:bold;margin:0 0 8px;font-size:14px;">⚠️ تحذيرات أمنية</p>
      <ul style="color:#555;font-size:13px;line-height:2;margin:0;padding-right:18px;">
        <li>لا تشارك هذا المفتاح مع أي شخص</li>
        <li>احفظه في مكان آمن</li>
        <li>من يملك هذا المفتاح يمكنه فك تشفير بياناتك</li>
        <li>يمكنك طلبه مجدداً من حسابك الشخصي</li>
      </ul>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">© %s SecureEncrypt. جميع الحقوق محفوظة.</p>
</div>
</body>
</html>""" % (
                name,
                encryption_key,
                year,
            )

            msg.attach(MIMEText(text, "plain", "utf-8"))
            msg.attach(MIMEText(html, "html", "utf-8"))

            self._send(msg)
            return {
                "success": True,
                "message": "تم إرسال مفتاح التشفير إلى بريدك الإلكتروني",
            }

        except Exception as e:
            logger.error("فشل إرسال مفتاح التشفير: %s", str(e))
            return {"success": False, "message": str(e)}

    # ================================================================ #
    # OTP
    # ================================================================ #

    def send_otp_email(self, recipient_email, otp_code, user_name=None):
        try:
            name = (user_name or "").strip() or "عزيزي المستخدم"
            expiry = datetime.now() + timedelta(minutes=5)
            expiry_str = expiry.strftime("%I:%M %p")
            year = datetime.now().year

            msg = MIMEMultipart("alternative")
            msg["From"] = self._from_header()
            msg["To"] = recipient_email
            msg["Subject"] = "🔒 رمز التحقق (OTP) - SecureEncrypt"

            text = (
                "مرحباً %s،\n\n"
                "رمز التحقق: %s\n\n"
                "صالح لمدة 5 دقائق (حتى %s).\n"
                "لا تشاركه مع أحد.\n\n"
                "SecureEncrypt"
            ) % (name, otp_code, expiry_str)

            html = """<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6fb;direction:rtl;text-align:right;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#2563eb,#1e40af);padding:28px;border-radius:12px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">🔒 رمز التحقق</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">SecureEncrypt</p>
  </div>
  <div style="background:#fff;padding:28px;border-radius:12px;margin-top:16px;border:1px solid #e2e8f0;">
    <h2 style="color:#0f1728;font-size:18px;">مرحباً %s</h2>
    <p style="color:#555;line-height:1.8;font-size:14px;">رمز التحقق الخاص بك لإتمام العملية:</p>
    <div style="background:#eff6ff;border:2px solid #2563eb;padding:24px;border-radius:12px;margin:24px 0;text-align:center;">
      <span style="font-size:40px;font-weight:900;color:#2563eb;letter-spacing:14px;font-family:monospace;">%s</span>
    </div>
    <div style="background:#fefce8;border:1px solid #d97706;padding:16px;border-radius:8px;">
      <ul style="color:#555;font-size:13px;line-height:2;margin:0;padding-right:18px;">
        <li>صالح لمدة <strong>5 دقائق</strong> فقط</li>
        <li>ينتهي عند: <strong>%s</strong></li>
        <li>لا تشاركه مع أي شخص</li>
        <li>إذا لم تطلبه، تجاهل هذا الإيميل</li>
      </ul>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">© %s SecureEncrypt. جميع الحقوق محفوظة.</p>
</div>
</body>
</html>""" % (
                name,
                otp_code,
                expiry_str,
                year,
            )

            msg.attach(MIMEText(text, "plain", "utf-8"))
            msg.attach(MIMEText(html, "html", "utf-8"))

            self._send(msg)
            return {
                "success": True,
                "message": "تم إرسال رمز OTP إلى بريدك الإلكتروني",
                "otp": otp_code,
                "expires_at": expiry.isoformat(),
            }

        except Exception as e:
            logger.error("فشل إرسال OTP: %s", str(e))
            return {"success": False, "message": str(e)}

    # ================================================================ #
    # Welcome
    # ================================================================ #

    def send_welcome_email(self, recipient_email, user_name=None):
        try:
            name = (user_name or "").strip() or "عزيزي المستخدم"
            year = datetime.now().year

            msg = MIMEMultipart("alternative")
            msg["From"] = self._from_header()
            msg["To"] = recipient_email
            msg["Subject"] = "🎉 مرحباً بك في SecureEncrypt!"

            html = """<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6fb;direction:rtl;text-align:right;margin:0;padding:0;">
<div style="max-width:600px;margin:30px auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#059669,#047857);padding:28px;border-radius:12px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">🎉 مرحباً بك!</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">SecureEncrypt</p>
  </div>
  <div style="background:#fff;padding:28px;border-radius:12px;margin-top:16px;border:1px solid #e2e8f0;">
    <h2 style="color:#0f1728;font-size:18px;">مرحباً %s</h2>
    <p style="color:#555;line-height:1.8;font-size:14px;">شكراً لانضمامك! تم إنشاء حسابك وتوليد مفتاح تشفير خاص بك.</p>
    <div style="background:#ecfdf5;border:1px solid #059669;padding:16px;border-radius:8px;margin:20px 0;">
      <p style="color:#047857;font-weight:bold;margin:0 0 8px;font-size:14px;">✅ الخطوات التالية</p>
      <ul style="color:#555;font-size:13px;line-height:2;margin:0;padding-right:18px;">
        <li>احفظ مفتاح التشفير في مكان آمن</li>
        <li>ابدأ في تشفير بياناتك الحساسة</li>
      </ul>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">© %s SecureEncrypt. جميع الحقوق محفوظة.</p>
</div>
</body>
</html>""" % (
                name,
                year,
            )

            msg.attach(MIMEText(html, "html", "utf-8"))
            self._send(msg)
            return {"success": True, "message": "تم إرسال الإيميل الترحيبي"}

        except Exception as e:
            logger.error("فشل الإيميل الترحيبي: %s", str(e))
            return {"success": False, "message": str(e)}


# ================================================================ #
# Helpers
# ================================================================ #


def get_email_service():
    return EmailService()


def send_key_email(recipient_email, encryption_key, user_name=None):
    return EmailService().send_encryption_key_email(
        recipient_email, encryption_key, user_name
    )


def send_otp_email(recipient_email, user_name=None):
    svc = EmailService()
    otp = svc.generate_otp()
    return svc.send_otp_email(recipient_email, otp, user_name)
