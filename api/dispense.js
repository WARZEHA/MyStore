// api/dispense.js : รับคำขอขายยา แล้วเรียกฟังก์ชัน sell_drug ใน Supabase ด้วย secret key
// secret key อยู่ใน Vercel เท่านั้น ห้ามอยู่ใน repo ห้ามอยู่ในหน้าเว็บ
// (ตรงกับแม่แบบภาคผนวก ก.7 วันที่ 2 ต่างเพียงแก้เครื่องหมาย || ที่ docx แสดงเป็น ││)
// เพิ่ม: ต้องส่งรหัสทาง header x-admin-code ให้ตรงกับ ADMIN_CODE ใน Vercel (แบบเดียวกับ api/admin.js)
//   เพราะเว็บเปิดสาธารณะแล้ว ถ้าไม่ตรวจ ใครรู้ลิงก์ก็ส่งคำขอขายยาตัดสต็อกได้
//   GET ยังตอบ 405 ก่อนตรวจรหัส ไฟดวงที่ 3 ใน status.html จึงยังผ่าน
const crypto = require('crypto');

function sameCode(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'ใช้ได้เฉพาะ POST' });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const code = process.env.ADMIN_CODE;
  if (!url || !key || !code) {
    return res.status(500).json({ ok: false, message: 'ยังไม่ได้ตั้ง SUPABASE_URL, SUPABASE_SECRET_KEY หรือ ADMIN_CODE ใน Vercel' });
  }
  // รหัสส่งทาง header ไม่ใส่ใน URL หรือ body
  if (!sameCode(req.headers['x-admin-code'] || '', code)) {
    return res.status(401).json({ ok: false, message: 'รหัสไม่ถูกต้อง' });
  }
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  const sku = String(b.sku ?? '').trim();
  const qty = Number(b.qty);
  const patient = String(b.patient_code ?? '').trim();
  const pharmacist = String(b.pharmacist_code ?? '').trim();
  if (!sku || !Number.isInteger(qty) || qty <= 0 || !patient || !pharmacist) {
    return res.status(400).json({ ok: false, message: 'ข้อมูลไม่ครบ: ต้องมียา จำนวนเต็มมากกว่า 0 รหัสผู้ป่วย และรหัสเภสัชกร' });
  }
  try {
    const r = await fetch(`${url}/rest/v1/rpc/sell_drug`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_sku: sku, p_qty: qty, p_patient_code: patient, p_pharmacist_code: pharmacist }),
    });
    const data = await r.json().catch(() => null);
    if (r.ok) return res.status(200).json(data);
    // P0001 = ข้อความที่ฟังก์ชัน raise เอง (เหตุผลทางธุรกิจ) ส่งต่อให้ผู้ใช้ได้
    if (data && data.code === 'P0001') return res.status(400).json({ ok: false, message: data.message });
    return res.status(502).json({ ok: false, message: 'ฐานข้อมูลตอบผิดปกติ ตรวจ key และชื่อฟังก์ชัน' });
  } catch (e) {
    return res.status(502).json({ ok: false, message: 'เชื่อมฐานข้อมูลไม่ได้' });
  }
};
