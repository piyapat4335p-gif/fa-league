# FA League

แอปบันทึกลีก eFootball สำหรับเพื่อน ๆ ใช้ Next.js + TypeScript + Tailwind CSS + Supabase รองรับมือถือ 360–430px และเดสก์ท็อป

## เปิดบนคอม

ใช้ Node.js 24 (กำหนดไว้ใน `.nvmrc` และ `package.json`)

```sh
npm ci
npm run dev
```

เปิด http://localhost:3000 ถ้ายังไม่ได้ตั้งค่า Supabase แอปจะเป็น **โหมดทดลอง** มี 7 ผู้เล่นและ 30 แมตช์ ทดลองเพิ่ม/แก้ไข/ลบข้อมูลได้ ข้อมูลทดลองอยู่ในหน่วยความจำของแท็บและจะรีเซ็ตเมื่อโหลดหน้าใหม่ ไม่ปะปนกับฐานข้อมูลจริง

## ตั้งค่า Supabase (Free Plan)

1. สร้างโปรเจ็กต์ Supabase ใหม่
2. เปิด SQL Editor และรัน `supabase/schema.sql` **หนึ่งครั้ง** สคริปต์นี้สร้างตาราง trigger และ RLS ทั้งหมด สำหรับฐานข้อมูลใหม่ ไม่ใช่ migration ของระบบเก่า
3. หากต้องการข้อมูลตัวอย่าง ให้รัน `supabase/seed.sql` ต่อ (7 ผู้เล่น, 30 แมตช์) หากจะเริ่มลีกจริงจากศูนย์ ข้าม seed ได้
4. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าจากหน้า API ของ Supabase:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

ใช้ public anon/publishable key เท่านั้น ห้ามใส่ service_role หรือ secret key ในตัวแปร `NEXT_PUBLIC_*` อย่า commit `.env.local`

5. รีสตาร์ต `npm run dev` โหมดทดลองจะหายไป และแอปจะแสดงเฉพาะข้อมูลจริงจาก Supabase
6. ใน Authentication → URL Configuration ตั้ง Site URL เป็น URL เว็บจริง และเพิ่ม `http://localhost:3000` รวมทั้ง URL Vercel ใน Redirect URLs ตามสภาพแวดล้อมที่ใช้
7. เปิด Email/Password sign-in ผู้เล่นสมัครผ่านเมนู **ตั้งค่า** และยืนยันอีเมลก่อนเข้าสู่ระบบ หรือผู้ดูแลสร้างบัญชีให้ใน Supabase Authentication ผู้ใช้ใหม่ได้สิทธิ์ `player` เสมอ

## ผู้ดูแลลีกคนแรก

สร้างบัญชีผ่านแอปหรือ Supabase Authentication จากนั้นใช้ **SQL Editor** รัน (เปลี่ยนอีเมลให้ตรงกับบัญชีคุณ):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

ออกจากระบบแล้วเข้าใหม่ ผู้ดูแลจะเพิ่ม/แก้ไข/ลบผู้เล่น สร้างและเปิดใช้ฤดูกาล รวมถึงแก้ไข/ลบผลแข่งได้

ผู้เล่นที่มีผลแข่งอยู่แล้วจะลบไม่ได้ เพื่อรักษาประวัติ ปรับชื่อได้แทน หากต้องการลบจริงต้องลบแมตช์ที่เกี่ยวข้องก่อน ระบบไม่ลบประวัติแบบต่อเนื่องอัตโนมัติ

## เพิ่มผู้ดูแลลีก

หลังตั้งผู้ดูแลคนแรกแล้ว ให้รัน `supabase/admin-management.sql` ใน SQL Editor หนึ่งครั้ง จากนั้นผู้ดูแลเปิดหน้า **ตั้งค่า** จะเห็นรายชื่อสมาชิกที่สมัครและยืนยันอีเมลแล้ว สามารถแต่งตั้งหรือถอดสิทธิ์ผู้ดูแลของสมาชิกคนอื่นได้จากหน้านั้น ระบบไม่อนุญาตให้บัญชีเปลี่ยนสิทธิ์ของตนเอง

## สิทธิ์และข้อมูล

- ผู้เยี่ยมชม: ดูฤดูกาล ผู้เล่น ตารางคะแนน ผลแข่ง และสถิติ
- สมาชิกที่เข้าสู่ระบบ: เพิ่มผลแข่งโดยบันทึกผู้ส่งเป็นบัญชีของตนเอง
- ผู้ดูแล: จัดการผู้เล่นและฤดูกาล แก้ไข/ลบผลแข่ง
- สมาชิกแก้ role ตนเองไม่ได้ การกำหนด admin ทำผ่าน SQL Editor เท่านั้น
- ตาราง matches ป้องกันสกอร์ติดลบ/เกิน 99 ผู้เล่นซ้ำ และผู้เล่นข้ามฤดูกาล ด้วย constraints ในฐานข้อมูล
- ตารางคะแนนคำนวณจากแมตช์ ไม่เก็บยอดสะสมแยก ใช้แต้ม → ผลต่างประตู → ประตูได้ หากเท่ากันทั้งหมดใช้ชื่อเพื่อเรียงให้คงที่
- การยืนยันก่อนบันทึก พร้อมปิดปุ่มระหว่างส่ง และใช้ UUID เดิมสำหรับการส่งซ้ำ ช่วยป้องกันดับเบิลคลิก
- กราฟแสดงแต้มสะสมตามจำนวนแมตช์ของแต่ละคน ตัวเลขทั้งหมดมาจากผลแข่ง จึงไม่คัดลอกตัวเลขที่ไม่สอดคล้องกันในภาพต้นแบบ
- ดึงข้อมูลเป็นหน้า หน้าละ 1,000 แถว เพื่อไม่ตัดประวัติที่เกินขีดจำกัดเริ่มต้นของ API สำหรับลีกขนาดเล็กโหลดทุกฤดูกาลในหน้าเดียว เมื่อข้อมูลโตมากควรเปลี่ยนเป็น query แยกฤดูกาล/aggregate ฝั่งฐานข้อมูล
- หลังบันทึกข้อมูลของตนเองจะแสดงทันที ข้อมูลที่เพื่อนเพิ่มจะอัปเดตเมื่อกลับมายังแท็บ หรือกดรีเฟรชในประวัติ ไม่ได้ใช้ Realtime
- รายงานพิมพ์ได้จากหน้าแรก ปุ่มพิมพ์รายงานใช้หน้าต่างพิมพ์ของเบราว์เซอร์

## Deploy ไป Vercel

1. นำ **ไฟล์ภายในโฟลเดอร์ FA-League** ขึ้น GitHub โดยให้ `package.json` อยู่ราก repo (หรือถ้าเก็บทั้งโฟลเดอร์ ให้ตั้ง Root Directory เป็น `FA-League`)
2. Import repo เข้า Vercel แล้วเลือก Next.js
3. เพิ่ม environment variables สองตัวด้านบนใน Production และ Preview ตามต้องการ
4. Deploy แล้วนำ URL ไปใส่ Site URL / Redirect URLs ใน Supabase
5. หากเปลี่ยน environment variables ต้อง redeploy เพื่อให้ Next.js รวมค่าใหม่ลงใน client build
6. ทดสอบบัญชีผู้เยี่ยมชม ผู้เล่น และผู้ดูแลกับโปรเจ็กต์จริงก่อนชวนเพื่อน

ไม่ได้เก็บรหัสผ่านหรือ service_role ในโค้ด ไม่จำเป็นต้องใช้บริการเสียเงินสำหรับ MVP (ขึ้นอยู่กับโควตาและเงื่อนไขของบัญชีที่ใช้)

## ตรวจสอบโค้ด

```sh
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
```

`test:db` รัน schema และ seed บน PostgreSQL ผ่าน PGlite พร้อมจำลอง auth.uid และ roles ของ Supabase เพื่อทดสอบ RLS โดยไม่แตะข้อมูลจริง ยังต้องทดสอบการยืนยันอีเมล/การเชื่อมต่อกับ Supabase จริงหลังตั้งค่าบัญชี

`npm run test:ui` ทดสอบโหมดทดลองบนเว็บที่รันพอร์ต 3000 ใช้ Chrome ที่ติดตั้งใน Windows หรือระบุ `CHROME_PATH` / `BASE_URL` ตามเครื่อง ผลภาพอยู่ใน `test-results/`

## โครงสร้าง

- `app/`: หน้าเว็บ metadata และรูปแบบ responsive
- `components/league-app.tsx`: หน้าลีก ฟอร์ม Auth และการจัดการ
- `components/ui.tsx`: ตาราง ผลแข่ง กราฟ และ dialog
- `lib/standings.ts`: คำนวณอันดับ กราฟ และตรวจสกอร์
- `lib/supabase.ts`: Supabase browser client ใช้ public key และ RLS
- `supabase/`: schema + ข้อมูลตัวอย่าง
- `tests/`: สูตรคะแนน สิทธิ์ฐานข้อมูล และ browser flows

อ้างอิง: [Next.js](https://nextjs.org/docs), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
