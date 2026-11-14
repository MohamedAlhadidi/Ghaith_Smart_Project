# RESUME — آخر تحديث 2026-11-14 (الدورة 1)

## Current objective
شريحة عمودية أولى من المنهج إلى اللعب: رياضيات ف1، الوحدة 1أ، الدرس 1 «لوحة المائة» (ص4)، مع جرد كامل للكتب وقائمة مهام ذرية.

## Last verified commit
انظر `git log -1` على الفرع `claude/dazzling-feynman-3x2f6x`. كل الاختبارات أدناه نُفذت على شجرة العمل قبل هذا الالتزام.

## Task status and evidence
| المهمة | الحالة | الدليل |
|---|---|---|
| PM-001 فحص البيئة | done | node 22.23.4، python 3.13، Claude Code 2.1.325؛ لا dotnet؛ Docker لا يعمل؛ لا bwrap/socat |
| PM-002 تفكيك المهام | done | `tasks/queue.json` فيه 147 مهمة؛ `queue_tool validate` بلا مشاكل |
| RUN-FIX-PREFLIGHT | done | الفحص المسبق كان يفشل مع CLI الحقيقي؛ أُصلح مع 4 اختبارات |
| REL-FIX-SEMESTER-WAIVER | done | 4 اختبارات؛ الإعفاء من زوج مادة/فصل لا يقبله إلا baseline معتمد |
| CUR-INV-DOWNLOAD | done | 27/27 ملفًا، وبصمات SHA-256 كلها مطابقة (`fetch_books --verify`) |
| CUR-MATH-S1-STU-TOC-EXTRACT | done | 40 درسًا (1أ:14، 1ب:4، 1ج:9، 2أ:13)، والفرق بين صفحة PDF والرقم المطبوع +11 متحقق منه |
| CUR-MATH-S1-U1A-L01-EXTRACT | done | `content/games/math/s1/MATH-S1-U1A-L01.json` (مسودة، غير معتمدة) |
| TEC-GAMECORE | done | vitest 29/29، tsc نظيف |
| TEC-WEB-SCAFFOLD | done | vitest 13/13، vite build ناجح |
| GME-…-L01-{FRAGMENT,LOCATE,PATH}-IMPLEMENT/TEST | done | e2e 42/42 على تابلت/هاتف/حاسوب (`reports/e2e/smoke-report.json`) |
| GME-…-L01-*-APPROVE | pending | تحتاج إنسانًا؛ لم تحدث أي مراجعة بشرية |

## أنواع الاختبار (لا خلط بينها)
- **runner tests (أدوات الإدارة):** 38/38 (`python3 -m unittest discover -s tests`).
- **application tests:** game-core 29/29، web 13/13، browser e2e 42/42.
- **curriculum review:** لم تحدث. كل المحتوى في حالة `extracted` أو `draft_needs_human_review`.
- **child usability test:** لم يحدث.

## Commands actually executed + exit codes
| الأمر | رمز الخروج | النتيجة |
|---|---|---|
| `python3 scripts/fetch_books.py --jobs 4` | 0 | 27/27 downloaded |
| `python3 scripts/fetch_books.py --verify` | 0 | 27/27 match |
| `python3 -m unittest discover -s tests` | 0 | 38 tests OK |
| `npm test` (workspaces) | 0 | 29 + 13 passed |
| `npm run typecheck` | 0 | بلا أخطاء |
| `npm run build --workspace @ghaith/web` | 0 | JS بحجم ~251 kB |
| `node src/web/e2e/smoke.mjs` | 0 | 42/42 checks |
| `python3 scripts/queue_tool.py validate` | 0 | 147 tasks, 0 problems |
| `python3 scripts/check_release.py --root .` | 1 | متوقع: لا يوجد manifest، والمشروع غير مكتمل |

## Changed files (هذه الدورة)
`scripts/pm_runner.py`، `scripts/check_release.py`، `scripts/fetch_books.py`، `scripts/queue_tool.py`، `docs/BOOK_SOURCES.json`، `docs/BOOK_INVENTORY.csv`، `docs/CURRICULUM_MATRIX.csv`، `tasks/queue.json`، `content/games/math/s1/MATH-S1-U1A-L01.json`، `src/games/core/**`، `src/web/**`، `tests/test_v4_fixes.py`، `tests/test_queue_tool.py`، `reports/e2e/**`، ونقل `.claude/settings.json` إلى `config/claude-settings.local-runner.json`.

## Blockers and required human action
1. **تأكيد الطبعة (25 كتابًا):** يطابق ولي الأمر غلاف الكتاب وصفحتين منه مع الكتاب الورقي. كتب الفصل الثاني وكتاب نشاط الرياضيات ف1 أُنشئت بين 2020 و2025، فقد تكون طبعات سابقة.
2. **تقنية المعلومات بلا مصدر في الفصلين:** ملف الفصل الأول صفحة Word بيضاء، والفصل الثاني غير مدرج في الموقع. المطلوب الكتاب من المدرسة أو تأكيد أنه لا يوجد كتاب.
3. **مراجعة قائمة دروس رياضيات ف1 (40 درسًا):** ثلاثة بنود غير مؤكدة في ص9 وص28 وص42.
4. **مراجعة أهداف الدرس L01 وألعابه الثلاث.**
5. **تأكيد حقوق الاستخدام الشخصي للكتب.**

## Next ready task + first command
- **التالي (P0، الإنجليزية):** `CUR-ENG-S1-CB-TOC-EXTRACT`. أول أمر: `pdftoppm -r 50 -png sources/books/ENG-S1-CB.pdf <scratch>/eng_cb/p`، ثم قراءة صفحة المحتويات.
- بالتوازي في الرياضيات: `CUR-MATH-S1-U1A-L02-EXTRACT` ثم `GME-MATH-S1-U1A-L02-IMPLEMENT`، و`UI-REVIEW-SCREEN` لتسهيل المراجعة البشرية.
- الكتب ليست في Git. على جهاز جديد يجب تشغيل `python3 scripts/fetch_books.py` أولًا، ثم `--verify`.
