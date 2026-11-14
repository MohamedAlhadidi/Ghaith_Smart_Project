# البرومبت 03 — التأسيس المعماري وقاعدة البيانات | ARCHITECTURE + DATABASE

أنت معماري برمجيات ومطور Full Stack وخبير SQL Server. أنشئ مشروعًا احترافيًا قابلًا للتشغيل والصيانة والتوسع، لا واجهة Mockup. استخدم **ASP.NET Core 10 + EF Core 10 + SQL Server** للخدمات وقاعدة البيانات، و**React + TypeScript + Vite + Tailwind** للواجهة. تحقق من الإصدارات المتاحة والمتوافقة قبل تثبيت الحزم. اختر Modular Monolith في البداية، ووثّق أسباب أي فصل لخدمات إضافية.

## المطلوب
- مستودع منظّم: `src/api`, `src/web`, `src/games`, `src/content`, `tests`, `docs`, `scripts`, `deploy`، أو بنية مكافئة واضحة.
- مشروع API طبقي ذو فصل منطقي بين Domain وApplication وInfrastructure وAPI؛ حدود وحدات واضحة للمحتوى، كتب PDF، الألعاب، الطالب، المهارات، التقارير، الإدارة، الوسائط.
- EF Core migrations مع seed للأقسام العامة فقط، دون بيانات مناهج مزيفة. SQL Server بإعدادات Development منفصلة عن Production، secrets خارج Git، إعداد اتصالات موثوق، فهارس وقيود مفاتيح وعلاقات ومعالجة عمليات متزامنة.
- نموذج بيانات يضم Users/Parents/StudentProfiles/AcademicYears/Semesters/Subjects/BookVersions/Units/Lessons/Pages/Objectives/Skills/Prerequisites/Activities/GameTemplates/GameInstances/QuestionBanks/Answers/Attempts/Mastery/ReviewSchedules/Media/Approvals/AuditLogs وإصدارات المحتوى، مع تسمية متسقة ومخطط علاقات موثق.
- Identity ومبدأ أقل صلاحيات: Admin, ContentReviewer, Parent, Child، حساب الطفل لا يسمح بإدارة النظام. التحضير لتسجيل دخول Google إن كان متاحًا وفق الضوابط الرسمية؛ لا تفترض تكامل Family Link API.
- REST API موثق OpenAPI، validation، معالجة أخطاء، logging خالٍ من أسرار الطفل، pagination، API tests، الصحة والجاهزية، تحكم في معدلات الطلبات عند الحاجة.
- Docker Compose اختياري لتشغيل محلي أو على Linux، مع دعم تشغيل بيئة Windows حيث يصلح، وبدون اشتراط Azure أو خدمات AI سحابية أو Ollama.
- أنشئ أوامر bootstrap/build/test/start، وبيانات اختبار fixture منفصلة عن أي كتاب رسمي. تحقّق من تشغيل الواجهة وAPI وقاعدة البيانات فعليًا حيث تتوفر البيئة.

## قبول المرحلة
لا تعتبر التأسيس مكتملًا دون نجاح بناء فعلي، تطبيق migration على قاعدة اختبار، API health endpoint واختبار تدفق أولي من الواجهة إلى API إلى SQL Server. إذا لم تتوفر SQL Server، أنشئ ملف إعداد وإجراء اختبار قابل للتنفيذ، وسجل `blocked` بدل ادعاء النجاح، واستمر في باقي الأنشطة المستقلة.
