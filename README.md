# 活動企劃書產生器

南臺科技大學學生會。照著步驟填寫，一鍵匯出符合學務處課外活動組格式的活動企劃書 Word（直接套用學校原始範本）與 PDF；之前匯出的 Word 可以再匯入繼續改。

- 網站：https://stustsa.github.io/proposal/
- 安卓 App：https://github.com/STUSTSA/proposal/releases/download/apk-latest/proposal.apk （main 每次更新自動重建）
- 前身：linkmasterking/-v1（單檔版），2026-11 拆檔並移到學生會帳號。

## 結構（根目錄就是網站，GitHub Pages 原樣提供，沒有打包器）
- `index.html`：頁面與畫面樣板（`<template id="dc-tpl">`，由 `js/dc-runtime.js` 執行）
- `css/app.css`：樣式。視覺對齊學生會數位系統（STUSTSA/council 的米黃主題：米黃底、白色大圓角色塊、深藍字、學生會黃、膠囊按鈕，Jost＋Noto Sans TC），深淺色由 `js/theme.js` 切換
- `js/app.js`：步驟、欄位、預覽、匯出流程；`js/fill-docx.js` 把資料寫進學校 .docx 範本；`js/pdf.js` 排 PDF；`js/template-b64.js` 是學校範本與圖片（封面預設圖＝學生會圓章）
- `js/vendor/`：JSZip、html2canvas、jsPDF、morphdom
- `icons/`、`og.png`（分享預覽圖，原稿 `tools/og-src.html`）、`manifest.webmanifest`、`sw.js`（離線可用）
- `assets/`：原始素材（學生會圓章原檔）
- `android/`：安卓外殼（WebView），網站在建置時複製進 APK，沒網路也能填寫與匯出；匯出的檔案存到手機「下載/企劃書」

## 安卓 APK 簽章
在 repo 的 Settings → Secrets and variables → Actions 設 `APP_KEYSTORE_B64`（keystore 的 base64）與 `APP_KEYSTORE_PASSWORD`，之後每版簽章相同、可以直接覆蓋更新。沒設時用臨時簽章，裝新版前要先移除舊版。
