'use client';

import { useCallback, useEffect, useState } from 'react';

type Entry = { id: number; event: string; ip: string; created_at: string };
const labels: Record<string, string> = {
  admin_mfa_enabled:'تم تفعيل Microsoft Authenticator',
  admin_mfa_disabled:'تم إيقاف التحقق بخطوتين',
  admin_mfa_failed:'كود تحقق غير صحيح أو مستخدم',
  admin_mfa_recovery_used:'تم استخدام كود استرداد',
  admin_mfa_recovery_regenerated:'تم تجديد أكواد الاسترداد',
  admin_login_success: 'دخول إدارة ناجح',
  admin_login_failed: 'محاولة دخول غير ناجحة',
  admin_login_rate_limited: 'إيقاف محاولات دخول كثيرة',
  admin_password_changed: 'تم تغيير كلمة المرور',
  product_created: 'تم إنشاء صنف',
  product_updated: 'تم تعديل صنف',
  product_archived: 'تمت أرشفة صنف',
};

export default function SecurityAudit() {
  const [rows, setRows] = useState<Entry[]>([]), [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/security/audit', { cache: 'no-store' });
    if (!response.ok) return setError('تعذر تحميل سجل الحماية');
    setRows(await response.json<Entry[]>()); setError('');
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="security-card audit-card"><div className="security-title"><i>◷</i><div><h3>سجل تدقيق الأمان</h3><p>آخر عمليات الدخول وتغيير كلمة المرور. لا يتم تخزين كلمات المرور أو أكواد التحقق.</p></div><button className="secondary" onClick={() => void load()}>تحديث</button></div>{error && <div className="form-error">{error}</div>}<div className="audit-list">{!rows.length ? <small>لا توجد أحداث مسجلة بعد.</small> : rows.map((row) => <div key={row.id}><b>{labels[row.event] || row.event}</b><span dir="ltr">{row.ip}</span><small>{new Date(row.created_at).toLocaleString('ar-EG')}</small></div>)}</div></div>;
}
