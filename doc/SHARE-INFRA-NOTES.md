# Share Infra Notes

## R2 lifecycle

分享檔案的背景清理由 R2 bucket lifecycle 處理，不再由 Worker `scheduled` cleanup 負責。

建議設定：

- Bucket: `spine-viewer-share`
- Prefix: `share/`
- Action: `Expire objects`
- Expire after: `2 days`

說明：

- 分享連結本身在 24 小時後就會失效
- R2 lifecycle 不需要精準到 24 小時，只負責後續清理殘留物件
- Cloudflare R2 lifecycle 刪除通常不是立即發生，可能在到期後一段時間內完成

## KV TTL

KV TTL 不需要另外在 Cloudflare 後台手動設定。

目前程式會在 Worker 寫入 share record 時直接帶入 TTL：

- 建立分享：`expirationTtl: SHARE_TTL_SECONDS`
- 撤銷分享後重寫：`expirationTtl: SHARE_TTL_SECONDS`

目前 `SHARE_TTL_SECONDS` 為 24 小時，所以：

- KV 記錄會自動過期
- 分享授權失效主要靠 KV TTL 與 `expiresAt` / `revokedAt` 驗證

## 分工

- KV TTL：控制分享連結何時失效
- Worker 驗證：每次請求檢查 `expiresAt` / `revokedAt`
- R2 lifecycle：清理 `share/` 底下過期資產
