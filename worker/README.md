# Worker Folder

這個資料夾放 Cloudflare Worker 相關程式碼，避免和前端 Vue 程式混在 `src/` 裡。

- `index.ts`: Worker entry，處理 share API、R2/KV 驗證與 asset 串流
