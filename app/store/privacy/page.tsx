export const metadata = { title:'Visitor analytics privacy | Neo Coffee Store', alternates:{canonical:'/store/privacy'} };
export default function PrivacyPage() {
  return <main className="store-information analytics-privacy">
    <a href="/store">← المتجر / Back to store</a>
    <section dir="rtl"><h1>خصوصية إحصائيات الزيارات</h1>
      <p>بموافقتك، يستخدم نيو كافي Google Analytics لقياس الصفحات التي تزورها، والجلسات، ووقت التفاعل، والبلد التقريبي، ونوع الجهاز، والتفاعل مع المنتجات والسلة.</p>
      <p>تستخدم الخدمة ملفات تعريف ارتباط لتمييز المتصفحات. لا نرسل من نماذج الطلب اسمك أو بريدك أو رقم هاتفك أو عنوان التوصيل. Google تتلقى بيانات تقنية لتقديم الإحصائيات. لا نفعّل تخصيص الإعلانات أو Google Signals.</p>
      <p>يمكنك الرفض دون التأثير على الشراء، وتغيير اختيارك من زر «الخصوصية» في المتجر. هذا الاختيار يخص الإحصائيات؛ ملفات الدخول والسلة اللازمة لتشغيل المتجر منفصلة.</p>
    </section>
    <section lang="en"><h2>Visitor analytics privacy</h2>
      <p>With your permission, Neo Coffee uses Google Analytics to measure pages, sessions, active engagement time, approximate country, device type and interactions with products and the cart.</p>
      <p>Analytics uses cookies to distinguish browsers. We do not send your name, email, phone number or delivery address from checkout forms. Google receives technical data to provide analytics. Advertising personalization and Google Signals are disabled.</p>
      <p>You can decline and continue shopping, or change your choice using Privacy settings. Essential login and cart storage are separate.</p>
    </section>
    <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>
  </main>;
}
