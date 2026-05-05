# Share Feature Plan

## Goal

讓使用者可以把目前載入的 Spine 資產上傳到 Cloudflare R2，產生一條可分享連結，讓收件者在 **24 小時內**直接開啟檢視，不需登入。

本功能的目標是：

- 讓分享流程可用且順手
- 資產不公開暴露在 public bucket
- 連結在 24 小時後失效
- 提高複製與外流成本

本功能**不是**真正 DRM，也**不能**保證資產無法被擷取。

## Locked Decisions

- 收件者 **不需要 login**
- 分享連結 **24 小時內有效**
- R2 bucket 維持 **private**
- 分享連結 **不能直接暴露 R2 URL**
- 所有 manifest 與 asset 存取都必須經過 **Cloudflare Worker 驗證**
- texture 會在分享流程中轉成 **WebP**
- texture 會在轉檔後加入 **靜態浮水印**
- viewer 額外再疊一層 **動態浮水印**

## Non-Goals

- 不處理永久分享連結
- 不處理登入保護或指定 email 才能開啟
- 不保證防止 DevTools、截圖、錄影、封包攔截
- 不在第一版重構本機載入流程
- 不在第一版做後台管理介面

## User Flow

### Sender

1. 使用者在 viewer 內載入一組 Spine 檔案
2. 點擊 `Share`
3. 前端把 skeleton、atlas、texture 上傳到 Worker
4. Worker 轉檔 texture：
   - 保持原始尺寸
   - 轉成 WebP
   - 烤入靜態浮水印
5. Worker 把處理後檔案寫入 R2
6. Worker 在 KV 建立 share token，TTL 為 24 小時
7. 前端取得分享連結 `/s/:token`

### Recipient

1. 收件者打開 `/s/:token`
2. Worker 驗證 token 是否存在且未過期
3. Viewer 頁面載入 manifest
4. Viewer 透過 Worker 逐一抓取 skeleton、atlas、processed textures
5. 前端組成 `File[]` 或等價資源後載入現有 Spine runtime
6. Viewer 顯示動態浮水印

## Architecture

### Storage

- `R2`
  - 儲存分享用資產
  - 不對外公開
- `KV`
  - 儲存 share token 與到期資訊
  - 用 `expirationTtl = 86400`

### Routing

- `POST /api/share/upload`
  - 建立分享
- `GET /s/:token`
  - 分享頁入口
- `GET /api/share/:token/manifest`
  - 取得分享描述
- `GET /api/share/:token/object/:name`
  - 取得單一檔案內容
- `POST /api/share/:token/session`
  - 可選，簽發短時效 viewer session

### R2 Key Layout

- `share/{shareId}/manifest.json`
- `share/{shareId}/skeleton/{originalName}`
- `share/{shareId}/atlas/{originalName}`
- `share/{shareId}/textures/{logicalName}.webp`

### KV Layout

- key: `share:{token}`
- value:

```json
{
  "shareId": "uuid-or-random-id",
  "createdAt": "2026-05-05T10:30:00.000Z",
  "expiresAt": "2026-05-06T10:30:00.000Z",
  "fileList": {
    "skeleton": "character.json",
    "atlas": "character.atlas",
    "textures": [
      {
        "logicalName": "character.png",
        "storedName": "character.webp"
      }
    ]
  },
  "viewCount": 0,
  "maxViews": null,
  "revokedAt": null
}
```

## Manifest Shape

manifest 用來描述如何還原分享內容，建議如下：

```json
{
  "shareId": "share_xxx",
  "createdAt": "2026-05-05T10:30:00.000Z",
  "expiresAt": "2026-05-06T10:30:00.000Z",
  "files": {
    "skeleton": {
      "name": "character.json",
      "mimeType": "application/json"
    },
    "atlas": {
      "name": "character.atlas",
      "mimeType": "text/plain"
    },
    "textures": [
      {
        "logicalName": "character.png",
        "storedName": "character.webp",
        "mimeType": "image/webp",
        "width": 2048,
        "height": 2048
      }
    ]
  },
  "watermark": {
    "mode": "tiled-diagonal",
    "label": "SHARE 8F3K-21"
  }
}
```

`logicalName` 是 atlas 與 runtime 仍會認得的名稱，`storedName` 是 R2 實際檔名。

## WebP Strategy

### Why

將分享資產中的 texture 預先處理成 WebP，可以：

- 降低直接復用原始檔的價值
- 讓靜態浮水印烤進圖檔本體
- 降低部分檔案體積

### Rules

- 保持原始像素尺寸完全一致
- 第一版預設使用 **lossless WebP**
- 保留 alpha channel
- 不做任何 resize
- 不在第一版改 skeleton JSON

### Atlas Compatibility

第一版不主動改 atlas page 的邏輯名稱，而是：

- atlas 內仍使用原本 page 名稱，例如 `character.png`
- manifest 記錄 `character.png -> character.webp`
- Worker 或前端資源組裝層，將 `character.webp` 對應回 runtime 期待的邏輯名稱

這樣可以避免第一版大改 `versionDetection` 與 atlas parsing 流程。

## Watermark Strategy

### Static Watermark

靜態浮水印直接烤進每張 texture page。

建議樣式：

- 模式：`diagonal tiled text`
- 透明度：`4% ~ 10%`
- 字串內容：
  - `SHARE {shortCode}`
  - `VIEW ONLY`
  - `EXP {YYYY-MM-DD HH:mm}`

### Dynamic Watermark

viewer 上再疊一層動態浮水印，降低截圖與錄影匿名外流的便利性。

建議內容：

- `SHARE {shortCode}`
- `EXPIRES {local time}`
- `VIEW ONLY`

建議行為：

- 低透明度
- 固定在畫面安全區
- 每隔 10 到 20 秒小幅變動位置或透明度

### Anti-Copy Boundary

可達成：

- 無 public asset URL
- 連結過期立即失效
- texture 本體帶浮水印
- viewer 畫面再疊浮水印

不可保證：

- 無法攔截 DevTools 抓包
- 無法阻止截圖
- 無法阻止螢幕錄影
- 無法阻止有心人重建資產

## API Contract

### `POST /api/share/upload`

Request:

- `multipart/form-data`
- fields:
  - `skeleton`
  - `atlas`
  - `textures[]`

Response:

```json
{
  "shareUrl": "https://example.com/s/abc123",
  "token": "abc123",
  "expiresAt": "2026-05-06T10:30:00.000Z"
}
```

### `GET /api/share/:token/manifest`

Response:

- 驗證 token 成功才回傳 manifest
- `Cache-Control: no-store`

### `GET /api/share/:token/object/:name`

Behavior:

- 驗證 token
- 依 manifest 找到對應 R2 object
- 串流回傳內容
- `Cache-Control: no-store`
- 避免回應可長時間快取

## Security Rules

- R2 bucket 不公開
- 不使用 R2 presigned URL 當最終分享連結
- Worker 每次取檔都驗 token
- 所有分享 API 回應加上 `Cache-Control: no-store`
- 可考慮補：
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY`
  - 嚴格 CSP

## Cleanup Strategy

授權失效與垃圾清理要分開看：

- **授權失效**
  - 靠 KV `expirationTtl = 86400`
  - 到期後立即拒絕存取
- **檔案清理**
  - R2 lifecycle 設 `2 ~ 3 days`
  - 或補 scheduled cleanup 主動刪除 `share/` prefix

第一版可先接受：

- token 到期立刻失效
- R2 實體檔案稍晚才被清掉

## Frontend Changes

### New UI

- 在載入成功後顯示 `Share` 按鈕
- 顯示：
  - share link
  - `Expires in 24 hours`
  - anti-copy 說明

### New States

- `isSharing`
- `shareUrl`
- `shareExpiresAt`
- `shareError`

### Share Page Boot Flow

- App 啟動時偵測是否為 `/s/:token` 模式
- 如果是：
  - 抓 manifest
  - 下載分享檔案
  - 重組為可載入資源
  - 顯示動態浮水印

## Code Impact

### Worker / Backend

- `wrangler.jsonc`
  - 新增 `r2_buckets`
  - 新增 `kv_namespaces`
- 新增 Worker route handlers
- 新增 share token service
- 新增 R2 upload / read helpers
- 新增 image processing pipeline

### Frontend

- [src/App.vue](/abs/path/C:/project_home/spine_viewer/spine-viewer/src/App.vue)
  - 整合分享入口與分享頁啟動流程
- [src/components/LoadFilesPanel.vue](/abs/path/C:/project_home/spine_viewer/spine-viewer/src/components/LoadFilesPanel.vue)
  - 現有檔案來源可沿用，不需先大改
- [src/components/SpineCanvas.vue](/abs/path/C:/project_home/spine_viewer/spine-viewer/src/components/SpineCanvas.vue)
  - 增加動態浮水印 overlay
- `src/composables/`
  - 新增 share upload / share load composable
- `src/lib/spine/`
  - 新增 share asset resource resolver

## Risks

- WebP + alpha 在某些素材上可能出現邊緣 artifact
- 浮水印如果太重，角色與特效會明顯髒掉
- atlas 與 texture 邏輯名稱映射如果做不好，runtime 會載入失敗
- 大檔案上傳與轉檔可能造成 Worker 執行時間壓力
- 多張 texture atlas 的處理時間與成本要留意

## Recommended Phase Split

### Phase 1

- Share upload
- Private R2 storage
- KV token with 24h TTL
- Share page
- Static watermark
- Dynamic watermark
- No login

### Phase 2

- Revoke link
- Max view count
- Short-lived viewer session token
- Better audit trail
- Optional Google login / email gate
- Optional admin cleanup tooling

## Acceptance Checklist

- 可以用本機載入的一組 Spine 檔案建立分享
- 成功產生 `/s/:token`
- 收件者不用登入即可開啟
- 超過 24 小時後連結失效
- R2 bucket 沒有 public 直連
- texture 實際為 processed WebP
- 靜態浮水印可見但不嚴重破壞可讀性
- viewer 上有動態浮水印
- Spine 3.x / 4.x 都能正常載入分享資產
- `npm run build` 通過
