"""
============================================
مشروع أداة التشفير وفك التشفير الآمنة
الطالب: عمر حمدي عبد العزيز - 22510462
الملف: encryption_service.py - خدمة التشفير بـ Fernet
============================================

الوظيفة:
- توليد مفاتيح تشفير Fernet آمنة
- تشفير النصوص والملفات باستخدام Fernet
- فك تشفير النصوص والملفات
- التحقق من صحة المفاتيح
- معالجة الأخطاء بشكل آمن
- ضمان سرية وسلامة البيانات (Confidentiality & Integrity)

الخوارزمية المستخدمة:
- Fernet (Symmetric Encryption)
- Built on: AES-128-CBC + HMAC-SHA256
- Library: cryptography.fernet
"""

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
import time
from typing import Optional, Tuple, Dict, Any
from datetime import datetime, timedelta


class EncryptionService:
    """
    خدمة التشفير وفك التشفير باستخدام خوارزمية Fernet
    
    Fernet توفر:
    1. سرية البيانات (Confidentiality) - عبر AES-128
    2. سلامة البيانات (Integrity) - عبر HMAC-SHA256
    3. منع التلاعب - أي تعديل على النص المشفر يسبب فشل فك التشفير
    """
    
    def __init__(self):
        """
        تهيئة خدمة التشفير
        """
        self.fernet = None
        self.key = None
    
    # ============================================
    # 1. إدارة المفاتيح (Key Management)
    # ============================================
    
    @staticmethod
    def generate_key() -> str:
        """
        توليد مفتاح Fernet جديد آمن
        
        Returns:
            str: مفتاح Fernet مشفر بصيغة Base64 (44 حرف)
        
        Example:
            >>> key = EncryptionService.generate_key()
            >>> print(key)
            'gAAAAABkX...'
        """
        key = Fernet.generate_key()
        return key.decode('utf-8')
    
    @staticmethod
    def validate_key(key: str) -> bool:
        """
        التحقق من صحة مفتاح Fernet
        
        Args:
            key (str): مفتاح Fernet للتحقق
        
        Returns:
            bool: True إذا كان المفتاح صالح، False otherwise
        
        Security Notes:
        - المفتاح يجب أن يكون 32-byte URL-safe Base64-encoded
        - يجب أن يحتوي على توقيع صالح
        """
        try:
            if not key or len(key) != 44:
                return False
            
            # محاولة إنشاء instance من Fernet للتحقق
            Fernet(key.encode('utf-8'))
            return True
        except Exception:
            return False
    
    @staticmethod
    def derive_key_from_password(password: str, salt: Optional[bytes] = None) -> Tuple[str, bytes]:
        """
        اشتقاق مفتاح Fernet من كلمة مرور (للاستخدام المتقدم)
        
        Args:
            password (str): كلمة المرور
            salt (bytes, optional): Salt للتشفير. إذا لم يتم تحديده، يتم توليد واحد جديد
        
        Returns:
            tuple: (مفتاح Fernet, salt المستخدم)
        
        Security Notes:
        - يستخدم PBKDF2HMAC مع SHA256
        - 100,000 iteration للتقوية
        - salt عشوائي 16-byte
        """
        if salt is None:
            salt = os.urandom(16)
        
        # اشتقاق المفتاح باستخدام PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        
        key = base64.urlsafe_b64encode(kdf.derive(password.encode('utf-8')))
        return key.decode('utf-8'), salt
    
    def set_key(self, key: str) -> bool:
        """
        تعيين مفتاح التشفير للخدمة
        
        Args:
            key (str): مفتاح Fernet
        
        Returns:
            bool: True إذا تم التعيين بنجاح، False إذا كان المفتاح غير صالح
        """
        if not self.validate_key(key):
            return False
        
        self.key = key
        self.fernet = Fernet(key.encode('utf-8'))
        return True
    
    # ============================================
    # 2. تشفير النصوص (Text Encryption)
    # ============================================
    
    def encrypt_text(self, plaintext: str) -> Dict[str, Any]:
        """
        تشفير نص باستخدام Fernet
        
        Args:
            plaintext (str): النص الأصلي المراد تشفيره
        
        Returns:
            dict: {
                'success': bool,
                'encrypted': str (النص المشفر),
                'message': str,
                'timestamp': str
            }
        
        Security Features:
        - AES-128-CBC للتشفير
        - HMAC-SHA256 للسلامة
        - Timestamp مدمج في التوكن
        """
        try:
            if not self.fernet:
                return {
                    'success': False,
                    'error': 'لم يتم تعيين مفتاح التشفير',
                    'encrypted': None
                }
            
            if not plaintext:
                return {
                    'success': False,
                    'error': 'النص المراد تشفيره فارغ',
                    'encrypted': None
                }
            
            # تحويل النص إلى bytes وتشفيره
            encrypted_bytes = self.fernet.encrypt(plaintext.encode('utf-8'))
            encrypted_text = encrypted_bytes.decode('utf-8')
            
            return {
                'success': True,
                'encrypted': encrypted_text,
                'message': 'تم التشفير بنجاح',
                'timestamp': datetime.now().isoformat(),
                'algorithm': 'Fernet (AES-128-CBC + HMAC-SHA256)'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'فشل التشفير: {str(e)}',
                'encrypted': None
            }
    
    def decrypt_text(self, ciphertext: str) -> Dict[str, Any]:
        """
        فك تشفير نص باستخدام Fernet
        
        Args:
            ciphertext (str): النص المشفر المراد فك تشفيره
        
        Returns:
            dict: {
                'success': bool,
                'decrypted': str (النص الأصلي),
                'message': str,
                'timestamp': str
            }
        
        Security Features:
        - التحقق من HMAC قبل فك التشفير
        - رفض التوكنات المعدلة
        - التحقق من timestamp (اختياري)
        """
        try:
            if not self.fernet:
                return {
                    'success': False,
                    'error': 'لم يتم تعيين مفتاح التشفير',
                    'decrypted': None
                }
            
            if not ciphertext:
                return {
                    'success': False,
                    'error': 'النص المشفر فارغ',
                    'decrypted': None
                }
            
            # فك التشفير مع التحقق التلقائي من HMAC
            decrypted_bytes = self.fernet.decrypt(ciphertext.encode('utf-8'))
            decrypted_text = decrypted_bytes.decode('utf-8')
            
            return {
                'success': True,
                'decrypted': decrypted_text,
                'message': 'تم فك التشفير بنجاح',
                'timestamp': datetime.now().isoformat(),
                'algorithm': 'Fernet (AES-128-CBC + HMAC-SHA256)'
            }
            
        except InvalidToken:
            return {
                'success': False,
                'error': 'المفتاح غير صحيح أو النص المشفر تم التلاعب به',
                'decrypted': None,
                'error_code': 'INVALID_TOKEN'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'فشل فك التشفير: {str(e)}',
                'decrypted': None
            }
    
    # ============================================
    # 3. تشفير الملفات (File Encryption)
    # ============================================
    
    def encrypt_file(self, input_path: str, output_path: Optional[str] = None) -> Dict[str, Any]:
        """
        تشفير ملف باستخدام Fernet
        
        Args:
            input_path (str): مسار الملف الأصلي
            output_path (str, optional): مسار الملف المشفر. إذا لم يتم تحديده، يتم إضافة .encrypted
        
        Returns:
            dict: {
                'success': bool,
                'output_path': str,
                'message': str,
                'file_size': int,
                'timestamp': str
            }
        
        Security Features:
        - تشفير كامل للملف بايت ببايت
        - الحفاظ على سلامة الملف الأصلي
        - إضافة امتداد .encrypted للملف المشفر
        """
        try:
            if not self.fernet:
                return {
                    'success': False,
                    'error': 'لم يتم تعيين مفتاح التشفير'
                }
            
            if not os.path.exists(input_path):
                return {
                    'success': False,
                    'error': 'الملف غير موجود'
                }
            
            # تحديد مسار الإخراج
            if output_path is None:
                output_path = input_path + '.encrypted'
            
            # قراءة الملف الأصلي وتشفيره
            with open(input_path, 'rb') as f:
                file_data = f.read()
            
            encrypted_data = self.fernet.encrypt(file_data)
            
            # كتابة الملف المشفر
            with open(output_path, 'wb') as f:
                f.write(encrypted_data)
            
            return {
                'success': True,
                'output_path': output_path,
                'message': 'تم تشفير الملف بنجاح',
                'original_size': os.path.getsize(input_path),
                'encrypted_size': os.path.getsize(output_path),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'فشل تشفير الملف: {str(e)}'
            }
    
    def decrypt_file(self, input_path: str, output_path: Optional[str] = None) -> Dict[str, Any]:
        """
        فك تشفير ملف باستخدام Fernet
        
        Args:
            input_path (str): مسار الملف المشفر
            output_path (str, optional): مسار الملف الأصلي بعد فك التشفير
        
        Returns:
            dict: {
                'success': bool,
                'output_path': str,
                'message': str,
                'file_size': int,
                'timestamp': str
            }
        """
        try:
            if not self.fernet:
                return {
                    'success': False,
                    'error': 'لم يتم تعيين مفتاح التشفير'
                }
            
            if not os.path.exists(input_path):
                return {
                    'success': False,
                    'error': 'الملف غير موجود'
                }
            
            # تحديد مسار الإخراج
            if output_path is None:
                output_path = input_path.replace('.encrypted', '')
                if output_path == input_path:
                    output_path = input_path + '.decrypted'
            
            # قراءة الملف المشفر وفك التشفير
            with open(input_path, 'rb') as f:
                encrypted_data = f.read()
            
            decrypted_data = self.fernet.decrypt(encrypted_data)
            
            # كتابة الملف الأصلي
            with open(output_path, 'wb') as f:
                f.write(decrypted_data)
            
            return {
                'success': True,
                'output_path': output_path,
                'message': 'تم فك تشفير الملف بنجاح',
                'encrypted_size': os.path.getsize(input_path),
                'decrypted_size': os.path.getsize(output_path),
                'timestamp': datetime.now().isoformat()
            }
            
        except InvalidToken:
            return {
                'success': False,
                'error': 'المفتاح غير صحيح أو الملف تم التلاعب به',
                'error_code': 'INVALID_TOKEN'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'فشل فك تشفير الملف: {str(e)}'
            }
    
    # ============================================
    # 4. تشفير مع وقت انتهاء صلاحية (TTL Encryption)
    # ============================================
    
    def encrypt_with_ttl(self, plaintext: str, ttl_seconds: int = 3600) -> Dict[str, Any]:
        """
        تشفير نص مع وقت انتهاء صلاحية
        
        Args:
            plaintext (str): النص المراد تشفيره
            ttl_seconds (int): وقت الصلاحية بالثواني (افتراضي: ساعة واحدة)
        
        Returns:
            dict: {
                'success': bool,
                'encrypted': str,
                'expires_at': str,
                'message': str
            }
        
        Security Features:
        - Fernet tokens تحتوي على timestamp مدمج
        - يمكن التحقق من عمر التوكن عند فك التشفير
        """
        try:
            if not self.fernet:
                return {
                    'success': False,
                    'error': 'لم يتم تعيين مفتاح التشفير'
                }
            
            encrypted_bytes = self.fernet.encrypt(plaintext.encode('utf-8'))
            expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
            
            return {
                'success': True,
                'encrypted': encrypted_bytes.decode('utf-8'),
                'expires_at': expires_at.isoformat(),
                'ttl_seconds': ttl_seconds,
                'message': 'تم التشفير مع وقت انتهاء صلاحية'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'فشل التشفير: {str(e)}'
            }
    
    def decrypt_with_ttl(self, ciphertext: str, max_age: Optional[int] = None) -> Dict[str, Any]:
        """
        فك تشفير نص مع التحقق من وقت الصلاحية
        
        Args:
            ciphertext (str): النص المشفر
            max_age (int, optional): أقصى عمر للتوكن بالثواني
        
        Returns:
            dict: {
                'success': bool,
                'decrypted': str,
                'message': str,
                'token_age': int
            }
        """
        try:
            if not self.fernet:
                return {
                    'success': False,
                    'error': 'لم يتم تعيين مفتاح التشفير'
                }
            
            if max_age:
                # فك التشفير مع التحقق من العمر
                decrypted_bytes = self.fernet.decrypt(
                    ciphertext.encode('utf-8'),
                    ttl=max_age
                )
            else:
                decrypted_bytes = self.fernet.decrypt(ciphertext.encode('utf-8'))
            
            decrypted_text = decrypted_bytes.decode('utf-8')
            
            return {
                'success': True,
                'decrypted': decrypted_text,
                'message': 'تم فك التشفير بنجاح',
                'token_verified': True
            }
            
        except InvalidToken as e:
            if 'ttl' in str(e).lower():
                return {
                    'success': False,
                    'error': 'انتهت صلاحية التوكن',
                    'error_code': 'TOKEN_EXPIRED'
                }
            return {
                'success': False,
                'error': 'المفتاح غير صحيح أو التوكن تم التلاعب به',
                'error_code': 'INVALID_TOKEN'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'فشل فك التشفير: {str(e)}'
            }
    
    # ============================================
    # 5. دوال مساعدة (Utility Functions)
    # ============================================
    
    @staticmethod
    def get_key_info(key: str) -> Dict[str, Any]:
        """
        الحصول على معلومات عن مفتاح Fernet
        
        Args:
            key (str): مفتاح Fernet
        
        Returns:
            dict: معلومات عن المفتاح
        """
        try:
            key_bytes = key.encode('utf-8')
            
            return {
                'valid': EncryptionService.validate_key(key),
                'length': len(key),
                'format': 'Base64 URL-safe',
                'algorithm': 'Fernet (AES-128-CBC + HMAC-SHA256)',
                'key_size': '32 bytes (256 bits)',
                'encryption_strength': '128-bit AES'
            }
        except Exception as e:
            return {
                'valid': False,
                'error': str(e)
            }
    
    @staticmethod
    def rotate_key(old_key: str, plaintext: str) -> Dict[str, Any]:
        """
        تدوير المفتاح (إعادة تشفير البيانات بمفتاح جديد)
        
        Args:
            old_key (str): المفتاح القديم
            plaintext (str): النص الأصلي
        
        Returns:
            dict: {
                'success': bool,
                'new_key': str,
                'new_encrypted': str,
                'message': str
            }
        
        Security Notes:
        - يُستخدم عند الاشتباه في تسريب المفتاح
        - يجب تخزين المفتاح الجديد بأمان
        """
        try:
            # توليد مفتاح جديد
            new_key = EncryptionService.generate_key()
            new_fernet = Fernet(new_key.encode('utf-8'))
            
            # إعادة تشفير البيانات
            new_encrypted = new_fernet.encrypt(plaintext.encode('utf-8')).decode('utf-8')
            
            return {
                'success': True,
                'new_key': new_key,
                'new_encrypted': new_encrypted,
                'message': 'تم تدوير المفتاح وإعادة التشفير بنجاح',
                'warning': 'احفظ المفتاح الجديد في مكان آمن واحذف القديم'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'فشل تدوير المفتاح: {str(e)}'
            }
    
    def clear_key(self):
        """
        مسح المفتاح من الذاكرة (للأمان)
        """
        self.key = None
        self.fernet = None


# ============================================
# دوال واجهة برمجية مبسطة (Simplified API)
# ============================================

def quick_encrypt(plaintext: str, key: str) -> Dict[str, Any]:
    """
    دالة سريعة للتشفير
    
    Args:
        plaintext (str): النص المراد تشفيره
        key (str): مفتاح Fernet
    
    Returns:
        dict: نتيجة التشفير
    """
    service = EncryptionService()
    if not service.set_key(key):
        return {
            'success': False,
            'error': 'مفتاح غير صالح'
        }
    return service.encrypt_text(plaintext)


def quick_decrypt(ciphertext: str, key: str) -> Dict[str, Any]:
    """
    دالة سريعة لفك التشفير
    
    Args:
        ciphertext (str): النص المشفر
        key (str): مفتاح Fernet
    
    Returns:
        dict: نتيجة فك التشفير
    """
    service = EncryptionService()
    if not service.set_key(key):
        return {
            'success': False,
            'error': 'مفتاح غير صالح'
        }
    return service.decrypt_text(ciphertext)


def generate_new_key() -> str:
    """
    دالة سريعة لتوليد مفتاح جديد
    
    Returns:
        str: مفتاح Fernet جديد
    """
    return EncryptionService.generate_key()


def validate_encryption_key(key: str) -> bool:
    """
    دالة سريعة للتحقق من المفتاح
    
    Args:
        key (str): مفتاح Fernet
    
    Returns:
        bool: True إذا كان المفتاح صالح
    """
    return EncryptionService.validate_key(key)