# 陽光故事學園

完整靜態網站，首頁、地圖、遊戲及圖片、動畫、音樂均由同一個 GitHub Pages 網站提供。訪客毋須 ChatGPT 或 GitHub 帳戶。

## 網站路線

首頁 → 忍者數學冒險 → 四方城堡 → 四個遊戲。全部同一分頁開啟。

- `index.html`：學園首頁，左邊忍者卡片連去地圖。
- `ninja-math/index.html`：忍者地圖，四方城堡木牌連去選關頁。
- `ninja-math/square-castle/index.html`：四張縮圖，按第一至第四關排列成 2×2。
- `games/`：每個遊戲獨立子資料夾，保留原有玩法及素材。
- `assets/`：首頁、地圖、縮圖及共用樣式。
- `catalog.json`：世界、章節、遊戲名稱、縮圖及路徑。

## 日後加遊戲

1. 將完整遊戲放入 `games/新遊戲名稱/`，入口為 `index.html`。遊戲內素材用相對路徑。
2. 將縮圖放入 `assets/`。
3. 在 `catalog.json` 對應章節的 `games` 陣列新增 `title`、`thumbnail`、`path`。
4. 執行 `python3 scripts/build-pages.py`，提交更新後的頁面及新素材。選關頁會自動增加卡片。

新增世界或章節時可沿用上述結構，另按新地圖設定點擊區位置。現有遊戲的資料夾互相獨立。

## GitHub Pages

Repository Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save。

本網站不需要 npm、後端、資料庫、登入服務或 ChatGPT Sites 轉址。

## 本機預覽

在 repository 根目錄執行 `python3 -m http.server 8000`，開啟 `http://localhost:8000`。

## 移植來源

四倍太鼓取自數學版本 `e2049536e842aaa60e47595d3d8bd0175e0f90dd`；忍者跑酷取自數學版本 `ef87f1fb587531776b3201471ede321bbe42207a`。兩者的後續來源版本已改為成語／心字部，故本網站保留對應四倍數縮圖的數學版本。

岩漿石陣：`0365a4afd302d0c88f9a16e987b30aae9fb951fc`。終極三選一：`bf3bc5a88b6219f655b3209cbd82c3d5f26ebf90`。
