import { NFC } from "nfc-pcsc";
import { exec } from "child_process";

const nfc = new NFC();

nfc.on("reader", reader => {
  console.log(`${reader.reader.name} 연결됨`);

  reader.on("card", card => {
    const uid = card.uid;
    console.log("카드 UID:", uid);

    // 부스 페이지 URL 자동 열기
    exec(`open "http://localhost:3000/b/${uid}"`);
  });

  reader.on("error", err => {
    console.error("리더기 에러:", err);
  });

  reader.on("end", () => {
    console.log("리더기 연결 해제");
  });
});

nfc.on("error", err => {
  console.error("NFC 전체 에러:", err);
});
