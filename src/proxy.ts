import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory sliding window cache for IP requests
const ipCache = new Map<string, number[]>();

// Rate limiting thresholds
const WINDOW_SIZE_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_MINUTE = 100; // Allow 100 requests per IP per minute

const HTML_RESPONSE_BODY = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Too Many Requests - Rec Center Phayao</title>
  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    body {
      background: #0F172A;
      color: #F8FAFC;
      font-family: 'Kanit', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: rgba(30, 41, 59, 0.5);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 32px;
      padding: 48px;
      text-align: center;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #F87171;
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 24px;
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      background: #EF4444;
      border-radius: 9999px;
      animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 16px;
      color: #FFFFFF;
      letter-spacing: -0.02em;
    }
    p {
      color: #94A3B8;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 32px;
      font-weight: 400;
    }
    .timer {
      background: linear-gradient(135deg, #1E40AF, #2563EB);
      color: #FFFFFF;
      padding: 16px 32px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 15px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
    }
    @keyframes ping {
      75%, 100% {
        transform: scale(2);
        opacity: 0;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span class="badge-dot"></span>
      <span>Rate Limit Triggered</span>
    </div>
    <h1>ตรวจพบปริมาณการเรียกใช้งานสูงผิดปกติ</h1>
    <p>ระบบความปลอดภัยตรวจจับปริมาณการส่งคำขอข้อมูลจาก IP ของท่านที่ถี่เกินกว่าปกติชั่วคราว เพื่อป้องกันการโจมตีแบบ DoS กรุณารอสักครู่แล้วโหลดหน้าเว็บใหม่อีกครั้ง</p>
    <div class="timer">โปรดลองใหม่อีกครั้งใน 1 นาที</div>
  </div>
</body>
</html>`;

export function proxy(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
             request.headers.get('x-real-ip') || 
             '127.0.0.1';
  
  const { pathname } = request.nextUrl;
  
  // Skip rate limiting for Next.js internals, media, stylesheets, or icons
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/auth') || 
    pathname.endsWith('.ico') || 
    pathname.endsWith('.png') || 
    pathname.endsWith('.jpg') || 
    pathname.endsWith('.jpeg') || 
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  ) {
    return NextResponse.next();
  }

  const now = Date.now();
  let timestamps = ipCache.get(ip) || [];

  // Evict timestamps outside the active window
  timestamps = timestamps.filter(timestamp => now - timestamp < WINDOW_SIZE_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const acceptHeader = request.headers.get('accept') || '';

    // If client expects HTML, return a beautiful custom 429 page
    if (acceptHeader.includes('text/html')) {
      return new NextResponse(HTML_RESPONSE_BODY, {
        status: 429,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Retry-After': '60'
        }
      });
    }

    // Otherwise, return standard 429 JSON response
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'ระบบตรวจพบการส่งข้อมูลที่มากผิดปกติ เพื่อป้องกัน DoS กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
        code: 429
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': '60'
        }
      }
    );
  }

  // Record this request
  timestamps.push(now);
  ipCache.set(ip, timestamps);

  // Periodically clean up stale IPs (prevent memory leak)
  if (ipCache.size > 5000) {
    const cutoff = now - WINDOW_SIZE_MS;
    for (const [key, value] of ipCache.entries()) {
      const active = value.filter(ts => ts > cutoff);
      if (active.length === 0) {
        ipCache.delete(key);
      } else {
        ipCache.set(key, active);
      }
    }
  }

  return NextResponse.next();
}

// Matching paths configuration
export const config = {
  matcher: '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
};
