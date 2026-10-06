import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok (UTC+7, no DST)

function getAdminDb() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getFirestore();
}

/** Returns UTC Date range covering "tomorrow" in Bangkok time, plus labels. */
function getTomorrowRangeBangkok(now = new Date()) {
  const bkkNow = new Date(now.getTime() + TZ_OFFSET_MS);
  const y = bkkNow.getUTCFullYear();
  const m = bkkNow.getUTCMonth();
  const d = bkkNow.getUTCDate() + 1;
  const start = new Date(Date.UTC(y, m, d) - TZ_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const label = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(start);
  return { start, end, label };
}

const fmtTime = (date: Date) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);

const esc = (s: unknown) =>
  String(s ?? "-").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function buildEmailHtml(label: string, bookings: any[]) {
  const rows = bookings.map((b, i) => {
    const attendees = (b.attendees || [])
      .map((a: any) => `${esc(a.name)} (${esc(a.phone)})`).join("<br/>");
    const group = b.groupName ? `${esc(b.groupType)}: ${esc(b.groupName)}` : esc(b.groupType);
    return `<tr>
      <td style="padding:8px;border:1px solid #e2e8f0;text-align:center">${i + 1}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;white-space:nowrap"><b>${fmtTime(b.start)} - ${fmtTime(b.end)}</b></td>
      <td style="padding:8px;border:1px solid #e2e8f0">${esc(b.userName)}<br/><small style="color:#64748b">${esc(b.memberId)}</small></td>
      <td style="padding:8px;border:1px solid #e2e8f0">${group}</td>
      <td style="padding:8px;border:1px solid #e2e8f0">${attendees || "-"}</td>
      <td style="padding:8px;border:1px solid #e2e8f0">${esc(b.status)}</td>
    </tr>`;
  }).join("");

  const body = bookings.length
    ? `<table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead><tr style="background:#1d4ed8;color:#fff">
          <th style="padding:8px">#</th><th style="padding:8px">เวลา</th><th style="padding:8px">ผู้จอง</th>
          <th style="padding:8px">กลุ่ม</th><th style="padding:8px">ผู้เข้าใช้ / เบอร์โทร</th><th style="padding:8px">สถานะ</th>
        </tr></thead><tbody>${rows}</tbody></table>`
    : `<p style="padding:16px;background:#f1f5f9;border-radius:8px">ไม่มีการจองห้องในวันพรุ่งนี้</p>`;

  return `<div style="font-family:Tahoma,sans-serif;max-width:800px;margin:auto;color:#0f172a">
    <h2 style="color:#1d4ed8">ตารางการจองห้องนันทนาการ — ${esc(label)}</h2>
    <p>จำนวนการจองทั้งหมด: <b>${bookings.length}</b> รายการ</p>
    ${body}
    <p style="color:#64748b;font-size:12px;margin-top:24px">
      หากห้องไม่พร้อมใช้งานหรือมีการใช้งานด่วน กรุณาติดต่อผู้จองตามเบอร์โทรด้านบนเพื่อประสานงานยกเลิกหรือเลื่อนการจอง<br/>
      อีเมลนี้ส่งอัตโนมัติทุกวันเวลา 20.00 น. — ศูนย์นันทนาการ อบจ.พะเยา
    </p></div>`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const { start, end, label } = getTomorrowRangeBangkok();

    const [bookingSnap, adminSnap] = await Promise.all([
      db.collection("bookings")
        .where("startTime", ">=", Timestamp.fromDate(start))
        .where("startTime", "<", Timestamp.fromDate(end))
        .get(),
      db.collection("users").where("role", "==", "admin").get(),
    ]);

    const bookings = bookingSnap.docs
      .map((d) => {
        const data = d.data();
        return { id: d.id, ...data, start: data.startTime.toDate(), end: data.endTime.toDate() };
      })
      .filter((b: any) => b.status !== "cancelled")
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const recipients = [...new Set(adminSnap.docs.map((d) => d.data().email).filter(Boolean))] as string[];
    if (!recipients.length) {
      return Response.json({ ok: false, error: "No admin emails found" }, { status: 500 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Rec Center Phayao <onboarding@resend.dev>",
        to: recipients,
        subject: `[ตารางจองห้อง] ${label} — ${bookings.length} รายการ`,
        html: buildEmailHtml(label, bookings),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Resend error:", detail);
      return Response.json({ ok: false, error: "Email send failed", detail }, { status: 502 });
    }

    return Response.json({ ok: true, date: label, bookings: bookings.length, recipients: recipients.length });
  } catch (error: any) {
    console.error("Daily booking email error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
