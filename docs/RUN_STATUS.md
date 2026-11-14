# حالة التسليم — Package QA

تتكون هذه الحزمة من وكيل إداري وقواعد وملفات تشغيل واستئناف **فقط**؛ لم يتم تشغيلها على جهاز المستخدم أو بدء بناء تطبيق غيث.

أوامر الاختبار التي تُنفذ محليًا على ملفات الحزمة:

```bash
python3 -m unittest discover -s tests -v
python3 -m py_compile scripts/pm_runner.py scripts/check_release.py
python3 scripts/pm_runner.py --project . --dry-run
python3 scripts/check_release.py --root .  # متوقع أن يفشل لأن المشروع غير مكتمل
```

يُمنع الانتقال من «حزمة إعداد» إلى «منتج مكتمل» دون قراءة الكتب الصحيحة والتحقق من الألعاب والاختبارات والنشر الفعلي.

**V4 status:** 16 local harness tests planned/executed in the audit environment; CLI and application e2e have not run on user machine. See `reviews/V3_TO_V4_DEEP_AUDIT_AR.md`.
