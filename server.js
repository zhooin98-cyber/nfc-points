import express from "express";
import Database from "better-sqlite3";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// -------- DB --------
const db = new Database("/data/db.sqlite");

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
:root{ --ink: #3a3a3a; }
*{box-sizing:border-box}
body{ margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif; color:var(--ink); display:flex; justify-content:center; align-items:center; height:100vh; text-align:center; }
.bg{ position:fixed; inset:0; width:100%; height:100%; object-fit:cover; z-index:-1; }
.content{ max-width: 800px; padding: 20px; }
.church{ font-weight: 600; font-size: 16px; opacity: .8; }
h1{ font-size: 80px; font-weight: 500; margin: 0; line-height: 1.2; letter-spacing: 0.1em; }
p{ font-size: 15px; line-height: 1.8; opacity: .8; max-width: 600px; margin: 24px auto; }
.btn{ display: inline-block; padding: 14px 32px; border-radius: 999px; background: white; color: var(--ink); text-decoration: none; font-weight: 700; box-shadow: 0 4px 20px rgba(0,0,0,.1); margin-top: 10px; }
.social{ margin-top: 40px; }
.social a{ opacity: .5; transition: opacity .2s; }
.social a:hover{ opacity: .8; }

/* 모바일 디자인 (가로 768px 이하) */
@media (max-width: 768px) {
  h1{ font-size: 48px; letter-spacing: 0.05em; }
  p{ font-size: 14px; }
  .btn{ padding: 12px 28px; }
  .social{ display: none; } /* 모바일에서는 인스타그램 아이콘 숨김 */
}
</style>
</head><body>
<img src="/bg.jpg" class="bg" alt="배경">
<div class="content">
  <div class="church">베를린 소망교회</div>
  <h1>겨자씨 청소년부<br>달란트 잔치</h1>
  <p>달란트 잔치는 하나님께서 우리에게 주신 재능, 시간 노력 같은 달란트를 하나님께서 주신 선물인 것을 알고, 함께 나누면서 기쁨을 누리고 하나님께 영광을 돌리는 시간입니다. 단순히 상품을 교환하는 시간이 아닌 하나님이 주신 달란트에 감사하며 믿음 안에서 서로 격려하고 나누며 기뻐하는 겨자씨 청소년부가 되길 바랍니다.</p>
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
<img src="/bg.jpg" class="bg" alt="배경">
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

// ... (이하 로그인, 로그아웃, 개인 카드 확인(/c/:token), 부스 사용(/b/:token) 페이지는 이전과 동일)

// =================================================================
// ||      지금부터 나오는 모든 페이지는 관리자 로그인이 필요     ||
// =================================================================
app.use(checkLogin);

// -------- 대시보드 --------
app.get("/dashboard", (req, res) => {
  // ...
  // 네비게이션에 '부스 정보 관리' 링크 추가
  res.send(`... <div class="nav"><a href="/cards">카드 관리</a><a href="/booths-admin">부스 계정 관리</a><a href="/settings">부스 정보 관리</a><a href="/download-tx">거래내역 다운로드</a><a href="/logout">로그아웃</a></div> ...`);
});

// ====== 새로운 '부스 정보 관리' 페이지 ======
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
<img src="/bg.jpg" class="bg" alt="배경">
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


// ... (이하 /cards, /booths-admin(구/booths), 각종 API 등 나머지 코드는 이전과 동일) ...

// -------- 서버 시작 --------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("listening on http://0.0.0.0:" + PORT));