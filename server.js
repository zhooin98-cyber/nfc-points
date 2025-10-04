import express from "express";
import Database from "better-sqlite3";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// -------- DB (기본 경로 사용) --------
const db = new Database("./db.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, label TEXT DEFAULT '',
    balance INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, card_token TEXT NOT NULL, delta INTEGER NOT NULL, source TEXT NOT NULL,
    reason TEXT DEFAULT '', booth TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS booths (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, label TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_content ( key TEXT PRIMARY KEY, value TEXT );
`);

// DB 쿼리
const ensureCard = db.prepare("INSERT OR IGNORE INTO cards (token) VALUES (?)");
const getCard = db.prepare("SELECT * FROM cards WHERE token=?");
const listCards = db.prepare("SELECT token,label,balance,updated_at FROM cards ORDER BY token ASC");
const setLabel = db.prepare("UPDATE cards SET label=? WHERE token=?");
const setBal = db.prepare("UPDATE cards SET balance=?, updated_at=datetime('now') WHERE token=?");
const updateBal = db.prepare("UPDATE cards SET balance=balance+?, updated_at=datetime('now') WHERE token=?");
const insertTx = db.prepare("INSERT INTO transactions (card_token, delta, source, reason, booth) VALUES (?,?,?,?,?)");
const listAllTxForCard = db.prepare("SELECT card_token,delta,source,reason,booth,created_at FROM transactions WHERE card_token=? ORDER BY id DESC");
const listAllTx = db.prepare("SELECT * FROM transactions ORDER BY id ASC");
const getBoothByUser = db.prepare("SELECT * FROM booths WHERE username=?");
const listAllBooths = db.prepare("SELECT username,label FROM booths ORDER BY id ASC");
const insertBooth = db.prepare("INSERT INTO booths (username,password,label) VALUES (?,?,?)");
const updateBoothInfo = db.prepare("UPDATE booths SET label=?, password=COALESCE(NULLIF(?, ''), password) WHERE username=?");
const deleteBoothUser = db.prepare("DELETE FROM booths WHERE username=?");
const deleteCard = db.prepare("DELETE FROM cards WHERE token=?");
const deleteTx = db.prepare("DELETE FROM transactions WHERE card_token=?");
const getContent = db.prepare("SELECT value FROM site_content WHERE key=?");
const setContent = db.prepare("INSERT OR REPLACE INTO site_content (key, value) VALUES (?, ?)");

// -------- 인증 --------
function getBooth(req) {
  const raw = req.headers.cookie || "";
  const hit = raw.split(";").map(s => s.trim()).find(s => s.startsWith("booth="));
  return hit ? decodeURIComponent(hit.split("=")[1] || "") : "";
}
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "somangberlin2025";

function checkLogin(req, res, next) {
  const raw = req.headers.cookie || "";
  const isAdmin = raw.split(";").map(s => s.trim()).includes("adm=1");
  if (isAdmin) { next(); }
  else { res.redirect("/login?ref=" + encodeURIComponent(req.originalUrl)); }
}

// =================================================================
// ||      로그인 없이 접근 가능한 페이지들                       ||
// =================================================================

// -------- 새로운 홈페이지 (반응형 디자인 적용) --------
app.get("/", (req, res) => {
  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>겨자씨 청소년부 달란트 잔치</title>
<style>
:root{ --ink: #69443c; }
*{box-sizing:border-box}
body{ margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif; color:var(--ink); display:flex; justify-content:center; align-items:center; height:100vh; text-align:center; }
.bg{ position:fixed; inset:0; width:100%; height:100%; object-fit:cover; z-index:-1; }
.content{ max-width: 800px; padding: 20px; margin-top: -5vh; } /* margin-top으로 위치 살짝 위로 조정 */
.church{ font-weight: 600; font-size: 16px; opacity: .8; }
h1{ font-size: 80px; font-weight: 500; margin: 0; line-height: 1.2; letter-spacing: 0.1em; color: white; }
p{ font-size: 15px; line-height: 1.8; opacity: .8; max-width: 600px; margin: 24px auto; }
.btn{ display: inline-block; padding: 14px 32px; border-radius: 999px; background: white; color: var(--ink); text-decoration: none; font-weight: 700; box-shadow: 0 4px 20px rgba(0,0,0,.1); margin-top: 10px; }
.social{ margin-top: 40px; }
.social a{ opacity: .5; transition: opacity .2s; }
.social a:hover{ opacity: .8; }
.login-nav{ position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; }
.login-nav a { padding: 8px 16px; border-radius: 999px; background: #ffffffa6; border: 1px solid #ffffffd9; backdrop-filter: blur(8px); text-decoration: none; color: var(--ink); font-weight: 600; font-size: 14px; }

/* 모바일 디자인 (가로 768px 이하) */
@media (max-width: 768px) {
  .content { margin-top: 0; } /* 모바일에선 다시 중앙으로 */
  h1{ font-size: 48px; letter-spacing: 0.05em; }
  p{ font-size: 14px; }
  .btn{ padding: 12px 28px; }
  .social{ display: none; }
  .login-nav { flex-direction: column; top: 10px; right: 10px; }
}
</style>
</head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video>
<div class="login-nav">
    <a href="/login?ref=/dashboard">관리자 로그인</a>
    <a href="/booth/login">부스 로그인</a>
</div>
<div class="content">
  <div class="church">베를린 소망교회</div>
  <h1>겨자씨 청소년부<br>달란트 잔치</h1>
  <p>달란트 잔치는 하나님께서 우리에게 주신 재능, 시간 노력 같은 달란트를 하나님께서 주신 선물인 것을 알고,<br> 함께 나누면서 기쁨을 누리고 하나님께 영광을 돌리는 시간입니다. <br>단순히 상품을 교환하는 시간이 아닌 <br>하나님이 주신 달란트에 감사하며 믿음 안에서 서로 격려하고 나누며 기뻐하는 겨자씨 청소년부가 되길 바랍니다.</p>
  <a href="/booths-info" class="btn">부스 정보</a>
  <div class="social">
    <a href="https://www.instagram.com" target="_blank">
      <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.163c3.204 0 3.584.012 4.85.07c3.252.148 4.771 1.691 4.919 4.919c.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.849c-.149 3.225-1.664 4.771-4.919 4.919c-1.266.058-1.644.07-4.85.07s-3.584-.012-4.849-.07c-3.26-.149-4.771-1.699-4.919-4.92c-.058-1.265-.07-1.644-.07-4.849s.012-3.584.07-4.849C2.164 3.931 3.69 2.38 6.918 2.232C8.183 2.175 8.563 2.163 12 2.163m0-2.163C8.442 0 8.053.012 6.786.068C3.129.236.241 3.129.068 6.786C.012 8.053 0 8.442 0 12s.012 3.947.068 5.214c.173 3.656 3.064 6.549 6.718 6.718C8.053 23.988 8.441 24 12 24s3.947-.012 5.214-.068c3.656-.173 6.549-3.064 6.718-6.718C23.988 15.947 24 15.559 24 12s-.012-3.947-.068-5.214c-.173-3.656-3.064-6.549-6.718-6.718C15.947.012 15.559 0 12 0m0 5.838a6.162 6.162 0 1 0 0 12.324a6.162 6.162 0 0 0 0-12.324M12 16a4 4 0 1 1 0-8a4 4 0 0 1 0 8m6.406-11.845a1.44 1.44 0 1 1 2.88 0a1.44 1.44 0 0 1-2.88 0"/></svg>
    </a>
  </div>
</div>
</body></html>`);
});

// -------- 새로운 '부스 정보' 페이지 --------
app.get("/booths-info", (req, res) => {
  const defaultBooths = `부스 이름 1\n부스 담당자 1\n여기에 부스 설명을 적어주세요. 관리자 페이지에서 수정할 수 있습니다.\n---\n부스 이름 2\n부스 담당자 2\n설명을 적어주세요.\n---`;
  const boothsText = getContent.get('booths_info')?.value || defaultBooths;
  const booths = boothsText.split('---').map(b => {
    const lines = b.trim().split('\n');
    return { name: lines[0] || '', teacher: lines[1] || '', desc: lines.slice(2).join('<br>') || '' };
  });

  let boothsHtml = "";
  booths.forEach(b => {
    boothsHtml += `<div class="booth-card">
      <h3>${b.name}</h3>
      <div class="teacher">${b.teacher}</div>
      <p>${b.desc}</p>
    </div>`;
  });

  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>부스 정보</title>
<style>
:root{--glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb;}
*{box-sizing:border-box} html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink)}
.bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}
.shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.2));z-index:-1}
.wrap{max-width:900px;margin:0 auto;padding:28px 16px 80px}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.brand{font-weight:900;font-size:28px; color:white;}
.nav a{padding:10px 16px;border-radius:999px;background:var(--glass);border:1px solid var(--glass-brd);backdrop-filter:blur(8px);text-decoration:none;color:var(--ink);font-weight:700}
.booths-grid{display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;}
.booth-card{background:var(--glass);border:1px solid var(--glass-brd);border-radius:24px;padding:24px;backdrop-filter:blur(12px);box-shadow:0 12px 44px rgba(0,0,0,.10);}
.booth-card h3{margin:0 0 4px; font-size:22px;}
.booth-card .teacher{font-weight:600; color:var(--muted); margin-bottom:12px;}
.booth-card p{line-height:1.6; font-size:15px;}
</style>
</head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video>
<div class="shade"></div>
<div class="wrap">
  <div class="header">
    <div class="brand">부스 정보</div>
    <div class="nav"><a href="/">홈으로</a></div>
  </div>
  <div class="booths-grid">${boothsHtml}</div>
</div>
</body></html>`);
});

// ====== 개인 카드 확인 페이지 (심플 버전) ======
app.get("/c/:token", (req, res) => {
  const token = req.params.token;
  ensureCard.run(token);
  const c = getCard.get(token);

  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${c.label || token}님 달란트 현황</title>
<style>
:root{--glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb;}
*{box-sizing:border-box}
html,body{height:100vh;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink); text-align:center; display:flex; flex-direction:column; justify-content:center; align-items:center;}
video.bg{position:fixed;inset:0;min-width:100%;min-height:100%;object-fit:cover;z-index:-2}
.shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.2));z-index:-1}
.booth-link{position:fixed; top:20px; right:20px; padding:8px 14px; border-radius:999px; background:var(--glass); border:1px solid var(--glass-brd); backdrop-filter:blur(8px); text-decoration:none; color:var(--ink); font-weight:600; font-size:14px;}
.main-title{font-size:20px; font-weight:700; color:white; opacity:0.8;}
.name{font-size:28px; font-weight:900; color:white; margin-top:12px;}
.balance-box{margin:12px 0 24px;}
.balance-label{font-size:48px; font-weight:600; color:white; opacity:0.9;}
.balance-amount{font-size:120px; font-weight:900; color:white; line-height:1;}
.footer-text{font-size:16px; color:white; opacity:0.8; max-width:300px; margin:0 auto;}
</style>
</head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video><div class="shade"></div>
<a href="/b/${token}" class="booth-link">부스 관리자용</a>

<div class="content">
  <div class="main-title">겨자씨 청소년부 달란트 잔치</div>
  <div class="name">${c.label || token} 님</div>
  <div class="balance-box">
    <span class="balance-label">달란트</span>
    <div class="balance-amount">${c.balance}</div>
  </div>
  <p class="footer-text">여러분이 최선을 다해 모은 달란트를 잘 활용해보세요.</p>
</div>
</body></html>`);
});

// -------- 라우트: 로그인/로그아웃 --------
app.get("/login", (req, res) => {
  const ref = req.query.ref || "/dashboard";
  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>로그인</title>
<style>
:root{--glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb;}
*{box-sizing:border-box} html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink)} video.bg{position:fixed;inset:0;min-width:100%;min-height:100%;object-fit:cover;z-index:-2} .shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,.35));z-index:-1} .wrap{max-width:480px;margin:0 auto;padding:80px 16px;height:100%;display:flex;flex-direction:column;justify-content:center} .panel{background:var(--glass);border:1px solid var(--glass-brd);border-radius:24px;padding:32px;backdrop-filter:blur(12px);box-shadow:0 12px 44px rgba(0,0,0,.10)} .panel h2{margin:0 0 20px;text-align:center;font-size:28px} .form-group{margin-bottom:16px} input{width:100%;padding:14px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffffd9;font-size:16px} button{width:100%;padding:14px 16px;border:none;border-radius:12px;background:var(--accent);color:#fff;cursor:pointer;font-weight:700;font-size:16px}
</style>
</head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video><div class="shade"></div>
<div class="wrap">
  <div class="panel">
    <h2>관리자 로그인</h2>
    <form method="post" action="/login">
      <div class="form-group">
        <input type="password" name="password" placeholder="비밀번호" autofocus/>
      </div>
      <input type="hidden" name="ref" value="${ref}"/>
      <button type="submit">로그인</button>
    </form>
  </div>
</div>
</body></html>`);
});

app.post("/login", (req, res) => {
  const { password, ref } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    res.setHeader("Set-Cookie", "adm=1; Path=/; HttpOnly; SameSite=Lax");
    return res.redirect(ref || "/dashboard");
  }
  res.send('비밀번호 오류. <a href="/login?ref='+encodeURIComponent(ref||"/dashboard")+'">다시</a>');
});

app.get("/logout", (req, res) => {
  res.setHeader("Set-Cookie", "adm=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  res.redirect("/");
});

app.get("/booth/login", (req, res) => {
  const ref = req.query.ref || "/";
  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>부스 로그인</title>
<style>
:root{--glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb;}
*{box-sizing:border-box} html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink)} video.bg{position:fixed;inset:0;min-width:100%;min-height:100%;object-fit:cover;z-index:-2} .shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,.35));z-index:-1} .wrap{max-width:480px;margin:0 auto;padding:80px 16px;height:100%;display:flex;flex-direction:column;justify-content:center} .panel{background:var(--glass);border:1px solid var(--glass-brd);border-radius:24px;padding:32px;backdrop-filter:blur(12px);box-shadow:0 12px 44px rgba(0,0,0,.10)} .panel h2{margin:0 0 20px;text-align:center;font-size:28px} .form-group{margin-bottom:16px} input{width:100%;padding:14px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffffd9;font-size:16px} button{width:100%;padding:14px 16px;border:none;border-radius:12px;background:var(--accent);color:#fff;cursor:pointer;font-weight:700;font-size:16px}
</style>
</head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video><div class="shade"></div>
<div class="wrap">
  <div class="panel">
    <h2>부스 로그인</h2>
    <form method="post" action="/booth/login">
      <div class="form-group"><input name="username" placeholder="부스 아이디" autofocus/></div>
      <div class="form-group"><input type="password" name="password" placeholder="비밀번호" /></div>
      <input type="hidden" name="ref" value="${ref}"/>
      <button type="submit">로그인</button>
    </form>
  </div>
</div>
</body></html>`);
});

app.post("/booth/login", (req, res) => {
  const { username, password, ref } = req.body || {};
  const b = getBoothByUser.get(username||"");
  if (b && b.password === password) {
    res.setHeader("Set-Cookie", "booth="+encodeURIComponent(b.username)+"; Path=/; HttpOnly; SameSite=Lax");
    return res.redirect(ref || "/");
  }
  res.send('부스 로그인 실패. <a href="/booth/login?ref='+encodeURIComponent(ref||"/")+'">다시</a>');
});

app.get("/booth/logout", (req, res) => {
  res.setHeader("Set-Cookie", "booth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  res.redirect("/");
});

// -------- 부스 사용 페이지 (부스 로그인 필요) --------
app.get("/b/:token", (req, res) => {
  const token = req.params.token;
  ensureCard.run(token);
  const c = getCard.get(token);
  const boothUser = getBooth(req);
  const txs = listAllTxForCard.all(token);
  let txHtml = "";
  txs.forEach(t=>{
    txHtml += `<tr>
      <td>${t.created_at.substring(2, 16).replace('T', ' ')}</td>
      <td class="${t.delta>=0?'plus':'minus'}">${t.delta>=0?'+':''}${t.delta}</td>
      <td>${t.source}</td>
      <td>${t.booth||''}</td>
      <td>${t.reason||''}</td>
    </tr>`;
  });

  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>${token} · 부스 사용</title>
<style>
:root{ --glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb; }
*{box-sizing:border-box} html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink)} video.bg{position:fixed;inset:0;min-width:100%;min-height:100%;object-fit:cover;z-index:-2} .shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,.35));z-index:-1} .wrap{max-width:900px;margin:0 auto;padding:28px 16px 80px} .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px} .brand{font-weight:900;font-size:26px;background:linear-gradient(90deg,#111,#334155,#64748b);-webkit-background-clip:text;background-clip:text;color:transparent} .nav{display:flex;gap:8px;flex-wrap:wrap} .nav a{padding:8px 12px;border-radius:999px;background:var(--glass);border:1px solid var(--glass-brd);backdrop-filter:blur(8px);text-decoration:none;color:var(--ink);font-weight:600} .grid{display:grid;grid-template-columns:1fr;gap:14px} @media (min-width:860px){ .grid{grid-template-columns:1fr 1fr} } .card{background:var(--glass);border:1px solid var(--glass-brd);border-radius:18px;padding:16px;backdrop-filter:blur(12px);box-shadow:0 12px 44px rgba(0,0,0,.10)} h2,h3{margin:0 0 10px} .sub{color:#64748b;font-size:13px} .badge{display:inline-block;padding:6px 12px;border-radius:999px;background:#eef2ff;border:1px solid #dbeafe;color:#1e3a8a;font-weight:700} .balance{display:flex;align-items:baseline;gap:10px;margin:8px 0 12px} .balance .num{font-size:44px;font-weight:900} .actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 12px} .btn{padding:10px 14px;border:none;border-radius:10px;background:#111;color:#fff;cursor:pointer;font-weight:700} .btn.primary{background:var(--accent)} .btn.danger{background:#ef4444} .row{display:grid;grid-template-columns:1fr auto;gap:8px} input,textarea{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffffd9} .notice{padding:10px 12px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;margin-bottom:10px} .tableWrap{background:var(--glass);border:1px solid var(--glass-brd);border-radius:18px;padding:8px;backdrop-filter:blur(12px);box-shadow:0 14px 48px rgba(0,0,0,.12)} table{width:100%;border-collapse:separate;border-spacing:0;border-radius:14px;overflow:hidden} th,td{padding:12px 10px;border-bottom:1px solid #e2e8f0;background:#ffffffcc} th{background:#f8fafc;font-weight:800} tr:last-child td{border-bottom:none} .plus{color:#16a34a;font-weight:900} .minus{color:#dc2626;font-weight:900} .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
</style></head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video><div class="shade"></div>
<div class="wrap">
  <div class="header"><div class="brand">부스 사용</div><div class="nav"><a href="/booth/login?ref=${encodeURIComponent("/b/"+token)}">${boothUser ? "부스 전환" : "부스 로그인"}</a>${boothUser ? `<span class="mono" style="padding:8px 10px;border-radius:10px;background:#ffffffb8;border:1px solid #e2e8f0">현재부스: ${boothUser}</span>` : ''}</div></div>
  <div class="grid">
    <div class="card"><h2>${token} <span class="badge">잔액</span></h2><div class="balance"><div class="num" id="bal">${c.balance}</div><div class="sub">point</div></div>${boothUser ? '' : '<div class="notice">부스 로그인이 필요합니다. 오른쪽 상단의 “부스 로그인”을 눌러 로그인하세요.</div>'}<div class="actions"><button class="btn" onclick="dec(1)" ${boothUser?'':'disabled'}>-1</button><button class="btn" onclick="dec(5)" ${boothUser?'':'disabled'}>-5</button><button class="btn" onclick="dec(10)" ${boothUser?'':'disabled'}>-10</button></div><div class="row"><input id="n" type="number" min="1" placeholder="차감할 수량 (예: 3)" ${boothUser?'':'disabled'}><button class="btn primary" onclick="bulk()" ${boothUser?'':'disabled'}>차감</button></div><div class="row" style="margin-top:8px"><input id="reason" type="text" placeholder="사유/메모 (선택)" ${boothUser?'':'disabled'}></div><div class="sub" style="margin-top:8px">부스는 <b>차감만</b> 가능하며, 추가/잔액설정은 관리자 페이지에서 수행하세요.</div></div>
    <div class="card"><h3>최근 내역</h3><div class="tableWrap" style="margin-top:8px"><table><thead><tr><th>시간</th><th>변동</th><th>출처</th><th>부스</th><th>사유</th></tr></thead><tbody id="tx">${txHtml}</tbody></table></div></div>
  </div>
</div>
<script>
(function(){
  async function apply(delta, reason){
    const r = await fetch("/api/booth-apply", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ token: "${token}", delta: delta, reason: reason }) });
    const j = await r.json();
    if(!j.ok){ alert(j.msg||"실패"); return null; }
    return j.balance;
  }
  window.dec = async function(n){ const bal = await apply(-Math.abs(parseInt(n,10)||1), document.getElementById("reason").value||""); if(bal==null) return; document.getElementById("bal").textContent = bal; location.reload(); };
  window.bulk = async function(){ const v = parseInt(document.getElementById("n").value||"0",10); if(!v || v<1){ alert("1 이상 입력하세요"); return; } const reason = document.getElementById("reason").value||""; const bal = await apply(-v, reason); if(bal==null) return; document.getElementById("n").value=""; document.getElementById("bal").textContent = bal; location.reload(); };
})();
</script></body></html>`);
});

// -------- 부스 API (부스 로그인 필요) --------
app.post("/api/booth-apply", (req, res) => {
  const { token, delta, reason } = req.body || {};
  if (!token || !Number.isInteger(delta)) return res.status(400).json({ ok:false, msg:"bad params" });
  if (delta >= 0) return res.status(400).json({ ok:false, msg:"부스는 차감만" });
  const boothUser = getBooth(req);
  if (!boothUser) return res.status(401).json({ ok:false, msg:"부스 로그인 필요" });
  insertTx.run(token, delta, "booth", reason||"", boothUser);
  updateBal.run(delta, token);
  const card = getCard.get(token);
  res.json({ ok:true, balance: card.balance });
});


// =================================================================
// ||      지금부터 나오는 모든 페이지는 관리자 로그인이 필요     ||
// =================================================================
app.use(checkLogin);


// -------- 대시보드(전체 카드 목록) --------
app.get("/dashboard", (req, res) => {
  const rows = listCards.all();
  let rowsHtml = "";
  rows.forEach((r, i) => {
    rowsHtml += `<tr data-token="${r.token.toLowerCase()}" data-label="${(r.label||'').toLowerCase()}" data-balance="${r.balance}">
      <td class="idx">${i+1}</td>
      <td class="tok"><span>${r.token}</span></td>
      <td>${r.label||''}</td>
      <td class="bal">${r.balance}</td>
      <td class="actions"><a href="/cards/${r.token}">관리</a> · <a href="/b/${r.token}">부스 사용</a></td>
    </tr>`;
  });

  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>달란트 대시보드</title>
<style>
:root{--glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb;}
*{box-sizing:border-box} html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink)} video.bg{position:fixed;inset:0;min-width:100%;min-height:100%;object-fit:cover;z-index:-2} .shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,.35));z-index:-1} .wrap{max-width:1100px;margin:0 auto;padding:28px 16px 80px} .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px} .brand{font-weight:900;font-size:26px;background:linear-gradient(90deg,#111,#334155,#64748b);-webkit-background-clip:text;background-clip:text;color:transparent} .nav{display:flex;gap:8px;flex-wrap:wrap} .nav a{padding:8px 12px;border-radius:999px;background:var(--glass);border:1px solid var(--glass-brd);backdrop-filter:blur(8px);text-decoration:none;color:var(--ink);font-weight:600} .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0} .metric{background:var(--glass);border:1px solid var(--glass-brd);border-radius:16px;padding:14px;backdrop-filter:blur(10px);box-shadow:0 10px 40px rgba(0,0,0,.08)} .metric .lbl{font-size:12px;color:var(--muted)} .metric .num{font-size:28px;font-weight:900} .panel{background:var(--glass);border:1px solid var(--glass-brd);border-radius:18px;padding:16px;backdrop-filter:blur(12px);box-shadow:0 12px 44px rgba(0,0,0,.10)} .toolbar{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-bottom:14px} .input{display:flex;align-items:center;gap:8px;background:#ffffffc7;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px} .input input{border:0;outline:none;background:transparent;width:100%;font-size:15px} .segment{display:inline-flex;gap:6px;padding:4px;background:#fff;border:1px solid #e2e8f0;border-radius:14px} .segment button{padding:9px 14px;border:0;background:transparent;cursor:pointer;font-weight:700;color:#64748b;border-radius:10px} .segment button.active{background:#111;color:#fff} .tableWrap{background:var(--glass);border:1px solid var(--glass-brd);border-radius:24px;padding:8px;backdrop-filter:blur(12px);box-shadow:0 14px 48px rgba(0,0,0,.12)} table{width:100%;border-collapse:separate;border-spacing:0;border-radius:16px;overflow:hidden;table-layout:fixed} th,td{padding:14px 12px;border-bottom:1px solid #e2e8f0;background:#ffffffcc;text-align:center} th{background:#f8fafc;font-weight:800} tr:last-child td{border-bottom:none} tbody tr:hover td{background:#fff} th:nth-child(2), td:nth-child(2){text-align:left} th:first-child,td:first-child{padding-left:12px} th:last-child, td:last-child{padding-right:12px} .idx{color:#94a3b8;font-weight:700} .tok span{padding:6px 12px;border-radius:999px;background:#eef2ff;border:1px solid #dbeafe;color:#1e3a8a;font-weight:700} .bal{font-weight:900;font-variant-numeric:tabular-nums} .actions a{color:var(--accent);text-decoration:none}
</style></head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video><div class="shade"></div>
<div class="wrap">
  <div class="header"><div class="brand">달란트 대시보드</div><div class="nav"><a href="/cards">카드 관리</a><a href="/booths">부스 계정 관리</a><a href="/settings">부스 정보 관리</a><a href="/download-tx">거래내역 다운로드</a><a href="/logout">로그아웃</a></div></div>
  <div class="metrics"><div class="metric"><div class="lbl">등록 인원</div><div class="num" id="m-count">${rows.length}</div></div><div class="metric"><div class="lbl">총 잔액 합</div><div class="num" id="m-sum">0</div></div><div class="metric"><div class="lbl">평균 잔액</div><div class="num" id="m-avg">0</div></div></div>
  <div class="panel">
    <div class="toolbar"><label class="input"><input id="q" placeholder="이름/라벨 검색 (예: 홍길동)"></label><div class="segment"><button class="active" data-sort="idx">기본순</button><button data-sort="name">이름순</button><button data-sort="bal-desc">잔액↓</button><button data-sort="bal-asc">잔액↑</button></div></div>
    <div class="tableWrap"><table id="tbl" aria-label="카드 목록"><colgroup><col style="width:64px"><col style="width:30%"><col style="width:26%"><col style="width:14%"><col style="width:18%"></colgroup><thead><tr><th>#</th><th>이름</th><th>라벨</th><th>잔액</th><th>열기</th></tr></thead><tbody id="tb">${rowsHtml}</tbody></table></div>
  </div>
</div>
<script>
(function(){
  const tb=document.getElementById('tb');
  function metrics(){
    const rows=[...tb.querySelectorAll('tr')].filter(r=>r.style.display!=='none');
    const sum=rows.reduce((a,r)=>a+parseInt(r.getAttribute('data-balance')||'0',10),0);
    const avg=rows.length?Math.round(sum/rows.length):0;
    document.getElementById('m-sum').textContent=sum;
    document.getElementById('m-avg').textContent=avg;
    document.getElementById('m-count').textContent=rows.length;
  } metrics();
  document.getElementById('q').addEventListener('input',e=>{
    const term=(e.target.value||'').toLowerCase().trim();
    tb.querySelectorAll('tr').forEach(tr=>{
      const t=tr.getAttribute('data-token')||'';
      const l=tr.getAttribute('data-label')||'';
      tr.style.display=(t.includes(term)||l.includes(term))?'':'none';
    });
    renumber(); metrics();
  });
  const tabs=document.querySelectorAll('.segment button');
  tabs.forEach(b=>b.addEventListener('click',()=>{
    tabs.forEach(x=>x.classList.remove('active')); b.classList.add('active');
    sort(b.dataset.sort); renumber();
  }));
  function sort(mode){
    const visible=[...tb.querySelectorAll('tr')].filter(r=>r.style.display!=='none');
    const hidden=[...tb.querySelectorAll('tr')].filter(r=>r.style.display==='none');
    if(mode==='name'){ visible.sort((a,b)=>a.getAttribute('data-token').localeCompare(b.getAttribute('data-token'),'ko')); }
    else if(mode==='bal-desc'){ visible.sort((a,b)=>parseInt(b.dataset.balance)-parseInt(a.dataset.balance)); }
    else if(mode==='bal-asc'){ visible.sort((a,b)=>parseInt(a.dataset.balance)-parseInt(b.dataset.balance)); }
    else { visible.sort((a,b)=>parseInt(a.querySelector('.idx').textContent)-parseInt(b.querySelector('.idx').textContent)); }
    tb.innerHTML=''; visible.forEach(tr=>tb.appendChild(tr)); hidden.forEach(tr=>tb.appendChild(tr));
  }
  function renumber(){ let i=1; tb.querySelectorAll('tr').forEach(tr=>{ if(tr.style.display==='none') return; tr.querySelector('.idx').textContent=i++; }); }
})();
</script></body></html>`);
});

// ====== 홈페이지 관리 페이지 (신설) ======
app.get("/settings", (req, res) => {
  const defaultBooths = `ㆍ라떼는 말이야\nㆍ담당: 정다운 선생님\nㆍ맛있는 분식을 즐겨보세요!\n---\nㆍ올리브 올드\nㆍ담당: 나찬민 전도사님\nㆍ각종 뷰티템과 악세사리가 가득!\n---\nㆍ인생한컷\nㆍ담당: 임하람 선생님\nㆍ친구와 함께 잊지 못할 추억을 남겨보세요.`;
  const boothsInfo = getContent.get('booths_info')?.value || defaultBooths;

  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>부스 정보 관리</title>
<style>
:root{ --glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb; }
*{box-sizing:border-box} html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink)} 
.bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}
.shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.2));z-index:-1}
.wrap{max-width:1100px;margin:0 auto;padding:28px 16px 80px} .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px} .brand{font-weight:900;font-size:26px; color:white;} .nav{display:flex;gap:8px;flex-wrap:wrap} .nav a{padding:8px 12px;border-radius:999px;background:var(--glass);border:1px solid var(--glass-brd);backdrop-filter:blur(8px);text-decoration:none;color:var(--ink);font-weight:600} .panel{background:var(--glass);border:1px solid var(--glass-brd);border-radius:18px;padding:16px;backdrop-filter:blur(12px);box-shadow:0 12px 44px rgba(0,0,0,.10);margin-bottom:16px} label{display:block; font-weight:600; margin-bottom:8px;} textarea{width:100%; height: 350px; padding:12px; border-radius:12px; border:1px solid var(--glass-brd); font-family:inherit; font-size:15px; line-height:1.6;} .btn-wrap{display:flex;justify-content:flex-end; margin-top:16px;} .btn{padding:10px 20px;border:none;border-radius:10px;background:var(--accent);color:#fff;cursor:pointer;font-weight:700; font-size:16px;}
.desc{font-size:14px; color: var(--muted); margin-bottom:16px; padding-bottom:16px; border-bottom: 1px solid var(--glass-brd);}
</style>
</head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video>
<div class="shade"></div>
<div class="wrap">
  <div class="header"><div class="brand">부스 정보 관리</div><div class="nav"><a href="/dashboard">대시보드</a><a href="/logout">로그아웃</a></div></div>
  <form method="post" action="/settings/update">
    <div class="panel">
      <label for="booths_info">✨ 부스 정보</label>
      <div class="desc">부스 별로 이름, 담당자, 설명을 적고 구분선(---)으로 나눠주세요.</div>
      <textarea id="booths_info" name="booths_info">${boothsInfo}</textarea>
      <div class="btn-wrap">
        <button class="btn" type="submit">저장하기</button>
      </div>
    </div>
  </form>
</div>
</body></html>`);
});

app.post("/settings/update", (req, res) => {
  const { booths_info } = req.body;
  if (booths_info != null) setContent.run('booths_info', booths_info);
  res.redirect("/settings");
});

// ====== 부스 계정 관리 ======
app.get("/booths", (req, res) => {
  const rows = listAllBooths.all();
  let rowsHtml = "";
  rows.forEach((b, i) => {
    rowsHtml += `<tr data-user="${b.username.toLowerCase()}" data-label="${(b.label||'').toLowerCase()}">
      <td class="idx">${i+1}</td>
      <td class="tok"><span>${b.username}</span></td>
      <td>${b.label||''}</td>
      <td class="actions">
        <form method="post" action="/booth/update" class="inline">
          <input type="hidden" name="username" value="${b.username}"/>
          <input name="label" placeholder="표시명" value="${b.label||''}"/>
          <input type="password" name="password" placeholder="새 비밀번호(선택)"/>
          <button class="btn" type="submit">저장</button>
        </form>
        <form method="post" action="/booth/delete" class="inline" onsubmit="return confirm('삭제할까요?')">
          <input type="hidden" name="username" value="${b.username}"/>
          <button class="btn danger" type="submit">삭제</button>
        </form>
      </td>
    </tr>`;
  });

  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>부스 관리</title>
<style>
:root{ --glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb; }
*{box-sizing:border-box} html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink)} video.bg{position:fixed;inset:0;min-width:100%;min-height:100%;object-fit:cover;z-index:-2} .shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,.35));z-index:-1} .wrap{max-width:1100px;margin:0 auto;padding:28px 16px 80px} .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px} .brand{font-weight:900;font-size:26px;background:linear-gradient(90deg,#111,#334155,#64748b);-webkit-background-clip:text;background-clip:text;color:transparent} .nav{display:flex;gap:8px;flex-wrap:wrap} .nav a{padding:8px 12px;border-radius:999px;background:var(--glass);border:1px solid var(--glass-brd);backdrop-filter:blur(8px);text-decoration:none;color:var(--ink);font-weight:600} .panel{background:var(--glass);border:1px solid var(--glass-brd);border-radius:18px;padding:16px;backdrop-filter:blur(12px);box-shadow:0 12px 44px rgba(0,0,0,.10);margin-bottom:16px} .grid{display:grid;grid-template-columns:1fr;gap:12px} @media (min-width:860px){ .grid{grid-template-columns:1fr 1fr} } label.small{display:block;font-size:12px;color:var(--muted);margin-bottom:6px} .row{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px} .inputRow{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px} input,textarea{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffffd9} .btn{padding:10px 14px;border:none;border-radius:10px;background:var(--accent);color:#fff;cursor:pointer} .btn.danger{background:#ef4444} .inline{display:inline-flex;gap:8px;flex-wrap:wrap;align-items:center} .toolbar{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-bottom:14px} .inputSearch{display:flex;align-items:center;gap:8px;background:#ffffffc7;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px} .inputSearch input{border:0;outline:none;background:transparent;width:100%;font-size:15px} .tableWrap{background:var(--glass);border:1px solid var(--glass-brd);border-radius:24px;padding:8px;backdrop-filter:blur(12px);box-shadow:0 14px 48px rgba(0,0,0,.12)} table{width:100%;border-collapse:separate;border-spacing:0;border-radius:16px;overflow:hidden} th,td{padding:14px 12px;border-bottom:1px solid #e2e8f0;background:#ffffffcc} th{background:#f8fafc;font-weight:800} tr:last-child td{border-bottom:none} tbody tr:hover td{background:#fff} .idx{color:#94a3b8;font-weight:700} .tok span{padding:6px 12px;border-radius:999px;background:#eef2ff;border:1px solid #dbeafe;color:#1e3a8a;font-weight:700} .actions{display:flex;gap:10px;flex-wrap:wrap}
</style></head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video><div class="shade"></div>
<div class="wrap">
  <div class="header"><div class="brand">부스 관리</div><div class="nav"><a href="/dashboard">대시보드</a><a href="/cards">카드 관리</a><a href="/logout">로그아웃</a></div></div>
  <div class="panel"><label class="small">새 부스 추가</label><form method="post" action="/booth/create" class="inputRow"><input name="username" placeholder="아이디 (예: booth1)" required><input name="label" placeholder="표시명 (예: 1번 부스)" required><input type="password" name="password" placeholder="비밀번호 (예: 1111)" required><button class="btn" type="submit">추가</button></form></div>
  <div class="panel"><div class="toolbar"><label class="inputSearch"><input id="q" placeholder="아이디/표시명 검색"></label><div style="opacity:.8;color:#64748b">총 ${rows.length}개 부스</div></div><div class="tableWrap"><table aria-label="부스 목록"><thead><tr><th>#</th><th>아이디</th><th>표시명</th><th>작업</th></tr></thead><tbody id="tb">${rowsHtml}</tbody></table></div></div>
</div>
<script>
(function(){
  const tb = document.getElementById('tb'); const q = document.getElementById('q');
  q.addEventListener('input', function(){
    const term = (q.value||'').toLowerCase().trim();
    tb.querySelectorAll('tr').forEach(tr=>{
      const u = tr.getAttribute('data-user')||'';
      const l = tr.getAttribute('data-label')||'';
      tr.style.display = (u.includes(term) || l.includes(term)) ? '' : 'none';
    });
    renumber();
  });
  function renumber(){ let i=1; [...tb.querySelectorAll('tr')].forEach(tr=>{ if(tr.style.display==='none') return; const idx = tr.querySelector('.idx'); if(idx) idx.textContent = i++; }); }
})();
</script></body></html>`);
});

// ====== 카드(사람) 관리 ======
app.get("/cards", (req, res) => {
  const rows = listCards.all();
  let rowsHtml = "";
  rows.forEach((r, i) => {
    rowsHtml += `<tr data-token="${r.token.toLowerCase()}" data-label="${(r.label||'').toLowerCase()}" data-balance="${r.balance}">
      <td class="idx">${i+1}</td>
      <td class="tok"><span>${r.token}</span></td>
      <td>${r.label||''}</td>
      <td class="bal">${r.balance}</td>
      <td class="actions">
        <a href="/cards/${r.token}">관리</a> · 
        <form method="post" action="/card/delete" style="display:inline" onsubmit="return confirm('삭제할까요?');">
          <input type="hidden" name="token" value="${r.token}"/>
          <button style="background:none;border:none;color:#dc2626;cursor:pointer">삭제</button>
        </form>
      </td>
    </tr>`;
  });

  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>카드 관리</title>
<style>
:root{ --glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb; }
*{box-sizing:border-box} html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink)} video.bg{position:fixed;inset:0;min-width:100%;min-height:100%;object-fit:cover;z-index:-2} .shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,.35));z-index:-1} .wrap{max-width:1100px;margin:0 auto;padding:28px 16px 80px} .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px} .brand{font-weight:900;font-size:26px;background:linear-gradient(90deg,#111,#334155,#64748b);-webkit-background-clip:text;background-clip:text;color:transparent} .nav{display:flex;gap:8px;flex-wrap:wrap} .nav a{padding:8px 12px;border-radius:999px;background:var(--glass);border:1px solid var(--glass-brd);backdrop-filter:blur(8px);text-decoration:none;color:var(--ink);font-weight:600} .panel{background:var(--glass);border:1px solid var(--glass-brd);border-radius:18px;padding:16px;backdrop-filter:blur(12px);box-shadow:0 12px 44px rgba(0,0,0,.10);margin-bottom:16px} .grid{display:grid;grid-template-columns:1fr;gap:12px} @media (min-width:860px){ .grid{grid-template-columns:1fr 1fr} } label.small{display:block;font-size:12px;color:var(--muted);margin-bottom:6px} .row{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px} textarea{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffffd9; font-family:inherit; font-size:15px; line-height:1.6;} input[type="text"],input[type="number"]{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffffd9} .btn{padding:10px 14px;border:none;border-radius:10px;background:var(--accent);color:#fff;cursor:pointer;font-weight:700} .toolbar{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-bottom:14px} .input{display:flex;align-items:center;gap:8px;background:#ffffffc7;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px} .input input{border:0;outline:none;background:transparent;width:100%;font-size:15px} .segment{display:inline-flex;gap:6px;padding:4px;background:#fff;border:1px solid #e2e8f0;border-radius:14px} .segment button{padding:9px 14px;border:0;background:transparent;cursor:pointer;font-weight:700;color:#64748b;border-radius:10px} .segment button.active{background:#111;color:#fff} .tableWrap{background:var(--glass);border:1px solid var(--glass-brd);border-radius:24px;padding:8px;backdrop-filter:blur(12px);box-shadow:0 14px 48px rgba(0,0,0,.12)} table{width:100%;border-collapse:separate;border-spacing:0;border-radius:16px;overflow:hidden;table-layout:fixed} th,td{padding:14px 12px;border-bottom:1px solid #e2e8f0;background:#ffffffcc;text-align:center} th{background:#f8fafc;font-weight:800} tr:last-child td{border-bottom:none} tbody tr:hover td{background:#fff} th:nth-child(2), td:nth-child(2){text-align:left} th:first-child,td:first-child{padding-left:12px} th:last-child, td:last-child{padding-right:12px} .idx{color:#94a3b8;font-weight:700} .tok span{padding:6px 12px;border-radius:999px;background:#eef2ff;border:1px solid #dbeafe;color:#1e3a8a;font-weight:700} .bal{font-weight:900;font-variant-numeric:tabular-nums} .actions a{color:var(--accent);text-decoration:none}
</style></head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video><div class="shade"></div>
<div class="wrap">
  <div class="header"><div class="brand">카드(사람) 관리</div><div class="nav"><a href="/dashboard">대시보드</a><a href="/booths">부스 관리</a><a href="/logout">로그아웃</a></div></div>
  <div class="panel"><div class="grid"><div><label class="small">단일 추가/수정</label><form method="post" action="/card/upsert" class="row"><input name="token" placeholder="이름/토큰 (예: hong01)" required><input name="label" placeholder="라벨(선택, 예: 홍길동)"><input type="number" name="balance" placeholder="초기 잔액(예: 300)" required><button class="btn" type="submit">저장</button></form></div><div><label class="small">일괄 등록/수정 (한 줄에 한 명 — <code>이름/토큰,초기잔액,라벨</code>)</label><form method="post" action="/card/bulk"><textarea name="bulk" rows="7" placeholder="김주인,100,Ju-in Kim\n이하나,150,Hana Lee"></textarea><div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="submit">일괄 적용</button></div></form></div></div></div>
  <div class="panel"><div class="toolbar"><label class="input"><input id="q" placeholder="이름/라벨 검색"></label><div class="segment" role="tablist" aria-label="정렬"><button class="active" data-sort="idx">기본순</button><button data-sort="name">이름순</button><button data-sort="bal-desc">잔액↓</button><button data-sort="bal-asc">잔액↑</button></div></div><div class="tableWrap"><table aria-label="카드 목록"><colgroup><col style="width:64px"><col style="width:30%"><col style="width:26%"><col style="width:14%"><col style="width:18%"></colgroup><thead><tr><th>#</th><th>이름/토큰</th><th>라벨</th><th>잔액</th><th>작업</th></tr></thead><tbody id="tb">${rowsHtml}</tbody></table></div></div>
</div>
<script>
(function(){
  const tb = document.getElementById('tb'); const q = document.getElementById('q');
  const buttons = document.querySelectorAll('[data-sort]'); let currentSort = "idx";
  buttons.forEach(btn=>{ btn.addEventListener("click", ()=>{ buttons.forEach(b=>b.classList.remove("active")); btn.classList.add("active"); currentSort = btn.getAttribute("data-sort"); filterAndSort(); }); });
  q.addEventListener('input', filterAndSort);
  function filterAndSort(){
    const term = (q.value||'').toLowerCase().trim();
    const rows = [...tb.querySelectorAll('tr')];
    let filtered = rows.filter(tr=>{ const t = tr.getAttribute('data-token')||''; const l = tr.getAttribute('data-label')||''; return (!term || t.includes(term) || l.includes(term)); });
    if(currentSort==="name"){ filtered.sort((a,b)=> (a.getAttribute('data-token')||"").localeCompare(b.getAttribute('data-token')||"",'ko')); }
    else if(currentSort==="bal-desc"){ filtered.sort((a,b)=> parseInt(b.getAttribute('data-balance')||'0') - parseInt(a.getAttribute('data-balance')||'0')); }
    else if(currentSort==="bal-asc"){ filtered.sort((a,b)=> parseInt(a.getAttribute('data-balance')||'0') - parseInt(b.getAttribute('data-balance')||'0')); }
    else { filtered.sort((a,b)=> parseInt(a.querySelector('.idx').textContent) - parseInt(b.querySelector('.idx').textContent)); }
    tb.innerHTML = ""; let i=1; filtered.forEach(tr=>{ tr.querySelector('.idx').textContent = i++; tb.appendChild(tr); });
  }
  filterAndSort();
})();
</script></body></html>`);
});

// ====== 개별 카드 수정 페이지 (분리됨) ======
app.get("/cards/:token", (req, res) => {
  const token = req.params.token;
  ensureCard.run(token);
  const c = getCard.get(token);

  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>${token} · 카드 관리</title>
<style>
:root{ --glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb; }
*{box-sizing:border-box} html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink)} video.bg{position:fixed;inset:0;min-width:100%;min-height:100%;object-fit:cover;z-index:-2} .shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,.35));z-index:-1} .wrap{max-width:900px;margin:0 auto;padding:28px 16px 80px} .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px} .brand{font-weight:900;font-size:26px;background:linear-gradient(90deg,#111,#334155,#64748b);-webkit-background-clip:text;background-clip:text;color:transparent} .nav{display:flex;gap:8px;flex-wrap:wrap} .nav a{padding:8px 12px;border-radius:999px;background:var(--glass);border:1px solid var(--glass-brd);backdrop-filter:blur(8px);text-decoration:none;color:var(--ink);font-weight:600} .card{background:var(--glass);border:1px solid var(--glass-brd);border-radius:18px;padding:16px;backdrop-filter:blur(12px);box-shadow:0 12px 44px rgba(0,0,0,.10);margin-top:16px} h2,h3{margin:0 0 10px} .sub{color:#64748b;font-size:13px} .balance{display:flex;align-items:baseline;gap:12px;margin-bottom:12px} .balance .num{font-size:48px;font-weight:900;letter-spacing:.3px} .badge{display:inline-block;padding:6px 12px;border-radius:999px;background:#eef2ff;border:1px solid #dbeafe;color:#1e3a8a;font-weight:700} .actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 12px} .btn{padding:10px 14px;border:none;border-radius:10px;background:var(--accent);color:#fff;cursor:pointer;font-weight:700} .btn.gray{background:#64748b} .btn.ghost{background:#475569} .btn.danger{background:#ef4444} .row{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:6px} input,textarea{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffffd9}
</style></head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video><div class="shade"></div>
<div class="wrap">
  <div class="header"><div class="brand">개별 카드 관리</div><div class="nav"><a href="/dashboard">대시보드</a><a href="/cards">카드 목록</a><a href="/logout">로그아웃</a></div></div>
  <div class="card">
    <h2>${token} <span class="badge">${c.label || "라벨 없음"}</span></h2><div class="sub">토큰(이름) · 라벨 · 현재 잔액을 관리합니다.</div><div class="balance"><div class="num" id="bal">${c.balance}</div><div class="sub">현재 잔액</div></div><div class="actions"><button class="btn" onclick="adj( 1)">+1</button><button class="btn" onclick="adj( 5)">+5</button><button class="btn" onclick="adj(10)">+10</button><button class="btn gray" onclick="adj(-1)">-1</button><button class="btn gray" onclick="adj(-5)">-5</button><button class="btn gray" onclick="adj(-10)">-10</button></div><div class="row"><input id="custom" type="number" placeholder="임의 증감 (예:+250 / -30)"><button class="btn" onclick="custom()">적용</button></div><div class="row"><input id="setv" type="number" placeholder="잔액을 특정 값으로 설정 (예: 280)"><button class="btn ghost" onclick="applySet()">잔액 설정</button></div><div class="row"><input id="label" type="text" value="${c.label||''}" placeholder="라벨 변경 (예: 2학년)"><button class="btn" onclick="saveLabel()">라벨 저장</button></div>
    <div style="margin-top:24px"><a href="/cards/${token}/history" class="btn gray">거래 내역 전체 보기</a></div>
  </div>
</div>
<script>
(async function(){
  async function api(path, body){
    const r = await fetch(path, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    return r.json();
  }
  window.adj = async function(delta){
    const res = await api("/api/admin-apply", { token:"${token}", delta, reason:"관리자 수정" });
    if(res.ok) { document.getElementById('bal').textContent = res.balance; } else { alert("실패"); }
  };
  window.custom = async function(){
    const delta = parseInt(document.getElementById('custom').value || "0");
    if(!delta) return;
    const res = await api("/api/admin-apply", { token:"${token}", delta, reason:"관리자 수정" });
    if(res.ok) { document.getElementById('bal').textContent = res.balance; } else { alert("실패"); }
  };
  window.applySet = async function(){
    const value = parseInt(document.getElementById('setv').value);
    if(!Number.isInteger(value)) return;
    const res = await api("/api/admin-set-balance", { token:"${token}", value });
    if(res.ok) { document.getElementById('bal').textContent = res.balance; } else { alert("실패"); }
  };
  window.saveLabel = async function(){
    const label = document.getElementById('label').value;
    const res = await api("/api/label", { token:"${token}", label });
    if(res.ok) { location.reload(); } else { alert("실패"); }
  };
})();
</script></body></html>`);
});

// ====== 거래 내역 페이지 (신설) ======
app.get("/cards/:token/history", (req, res) => {
  const token = req.params.token;
  const c = getCard.get(token);
  const txs = listAllTxForCard.all(token);
  let txHtml = "";
  txs.forEach(t=>{
    txHtml += `<tr>
      <td>${t.created_at.substring(2, 16).replace('T', ' ')}</td>
      <td class="${t.delta>=0?'plus':'minus'}">${t.delta>=0?'+':''}${t.delta}</td>
      <td>${t.booth||t.source}</td>
      <td>${t.reason||''}</td>
    </tr>`;
  });

  res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>${token} · 거래 내역</title>
<style>
:root{ --glass:#ffffffa6; --glass-brd:#ffffffd9; --ink:#0f172a; --muted:#475569; --accent:#2563eb; }
*{box-sizing:border-box} html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:var(--ink)} video.bg{position:fixed;inset:0;min-width:100%;min-height:100%;object-fit:cover;z-index:-2} .shade{position:fixed;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,.35));z-index:-1} .wrap{max-width:1100px;margin:0 auto;padding:28px 16px 80px} .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px} .brand{font-weight:900;font-size:26px;} .brand .token{font-weight:400; color:var(--muted)} .nav{display:flex;gap:8px;flex-wrap:wrap} .nav a{padding:8px 12px;border-radius:999px;background:var(--glass);border:1px solid var(--glass-brd);backdrop-filter:blur(8px);text-decoration:none;color:var(--ink);font-weight:600} .tableWrap{background:var(--glass);border:1px solid var(--glass-brd);border-radius:24px;padding:8px;backdrop-filter:blur(12px);box-shadow:0 14px 48px rgba(0,0,0,.12)} table{width:100%;border-collapse:separate;border-spacing:0;border-radius:16px;overflow:hidden;} th,td{padding:14px 12px;border-bottom:1px solid #e2e8f0;background:#ffffffcc;text-align:left} th{background:#f8fafc;font-weight:800;font-size:14px; text-align:left;} tr:last-child td{border-bottom:none} .plus{color:#16a34a;font-weight:700} .minus{color:#dc2626;font-weight:700}
</style></head><body>
<video autoplay muted loop playsinline class="bg"><source src="/bg.mp4" type="video/mp4"></video><div class="shade"></div>
<div class="wrap">
  <div class="header"><div class="brand">${c.label||token} <span class="token">님의 거래 내역</span></div><div class="nav"><a href="/dashboard">대시보드</a><a href="/cards/${token}">카드 수정</a><a href="/logout">로그아웃</a></div></div>
  <div class="tableWrap">
    <table>
      <thead><tr><th>시간</th><th>변동</th><th>사용처</th><th>사유</th></tr></thead>
      <tbody>${txHtml}</tbody>
    </table>
  </div>
</div>
</body></html>`);
});


// -------- 관리자 API --------
app.post("/api/admin-apply", (req, res) => {
  const { token, delta, reason } = req.body || {};
  if (!token || !Number.isInteger(delta)) return res.status(400).json({ ok:false });
  insertTx.run(token, delta, "admin", reason||"", "");
  updateBal.run(delta, token);
  const card = getCard.get(token);
  res.json({ ok:true, balance: card.balance });
});
app.post("/api/admin-set-balance", (req, res) => {
  const { token, value } = req.body || {};
  if (!token || !Number.isInteger(value)) return res.status(400).json({ ok:false });
  const before = getCard.get(token)?.balance ?? 0;
  const delta = value - before;
  insertTx.run(token, delta, "admin", "set-balance", "");
  setBal.run(value, token);
  const card = getCard.get(token);
  res.json({ ok:true, balance: card.balance });
});
app.post("/api/label", (req, res) => {
  const { token, label } = req.body || {};
  if (!token) return res.status(400).json({ ok:false });
  setLabel.run(label||"", token);
  res.json({ ok:true });
});

// 카드 CRUD
app.post("/card/bulk", (req, res) => {
  const lines = (req.body?.bulk||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const tx = db.transaction(arr=>{
    arr.forEach(line=>{
      const parts = line.split(",").map(s=>s.trim());
      const token = parts[0];
      const bal = parseInt(parts[1]||"0",10);
      const label = parts[2]||"";
      if(!token || !Number.isInteger(bal)) return;
      db.prepare("INSERT INTO cards (token,label,balance) VALUES (?,?,?) ON CONFLICT(token) DO UPDATE SET label=excluded.label, balance=excluded.balance, updated_at=datetime('now')").run(token,label,bal);
    });
  });
  tx(lines);
  res.redirect("/cards");
});
app.post("/card/upsert", (req, res) => {
  const { token, label, balance } = req.body || {};
  const bal = parseInt(balance, 10);
  if (!token || !Number.isInteger(bal)) return res.status(400).send("bad params");
  db.prepare(`
    INSERT INTO cards (token, label, balance)
    VALUES (?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET
      label=excluded.label,
      balance=excluded.balance,
      updated_at=datetime('now')
  `).run(token.trim(), (label||"").trim(), bal);
  res.redirect("/cards");
});
app.post("/card/delete", (req, res) => {
  const { token } = req.body || {};
  if (token) {
    deleteTx.run(token);
    deleteCard.run(token);
  }
  res.redirect("/cards");
});

// 부스 CRUD
app.post("/booth/create", (req, res) => {
  const { username, label, password } = req.body || {};
  if (!username || !label || !password) return res.status(400).send("bad params");
  try { insertBooth.run(username.trim(), password, label.trim()); res.redirect("/booths"); }
  catch { res.status(400).send("이미 존재"); }
});
app.post("/booth/update", (req, res) => {
  const { username, label, password } = req.body || {};
  if (!username) return res.status(400).send("bad params");
  updateBoothInfo.run(label?.trim()||"", (password||"").trim(), username.trim());
  res.redirect("/booths");
});
app.post("/booth/delete", (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).send("bad params");
  deleteBoothUser.run(username.trim());
  res.redirect("/booths");
});

// 거래내역 다운로드 (CSV)
app.get("/download-tx", (req, res) => {
  const rows = listAllTx.all();
  // CSV 헤더 (엑셀에서 한글 깨짐 방지 - BOM 추가)
  const BOM = "\uFEFF";
  let csv = BOM + "ID,카드토큰,라벨,변동량,출처,사유,부스,시간\n";
  
  const allCards = listCards.all();
  const cardLabelMap = new Map(allCards.map(c => [c.token, c.label]));

  rows.forEach(r => {
    const label = cardLabelMap.get(r.card_token) || '';
    const reason = `"${(r.reason||'').replace(/"/g, '""')}"`;
    const booth = `"${(r.booth||'').replace(/"/g, '""')}"`;
    csv += [r.id, r.card_token, label, r.delta, r.source, reason, booth, r.created_at].join(",") + "\n";
  });
  
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="transactions-' + new Date().toISOString().substring(0,10) + '.csv"');
  res.send(csv);
});


// -------- 서버 시작 --------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("listening on http://0.0.0.0:" + PORT));

