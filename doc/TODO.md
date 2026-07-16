# TODO

## Spine 3.8 Vendor Runtime

- [x] Replace `vendor/spine-3.8/dist/spine-webgl-3.8.js` placeholder with a real Spine 3.8 runtime build.
- [x] Record the Spine 3.8 source branch/tag, build command, output format, and exported namespace in `doc/SPINE-3.8-VENDOR.md`.
- [x] Implement `Spine3RuntimeAdapter` session initialization after the real 3.8 runtime bundle is available.
- [x] Validate that the 3.8 bundle exposes the required runtime APIs used by the adapter.
- [x] Add real 3.x load path verification: animation switch, seek, playback rate, debug display, and reload back to 4.x.

## Version Strategy

- Implement actual `auto` fallback flow: try detected/selected runtime first, then fallback candidate when initialization fails.
- Surface version status in UI: `Detected Version`, `Runtime Version`, and `Fallback Used`.
- Add better 3.x / 4.x load error messages so users can tell whether the failure came from detection, missing runtime, or runtime initialization.

## Viewport

- Add a UI setting for the viewport max zoom limit instead of hardcoding it in `src/components/SpineCanvas.vue`.
- Current zoom range is `20%` to `1000%`.
- The setting should be exposed from `ControlPanel` and applied by `SpineCanvas`.
- `Reset View` should reset only the current view transform, not the configured zoom limit.

## Loader / UX / Validation

- Implement multi-file ordering strategy instead of relying on first matching skeleton / atlas file.
- Improve file validation and load UX for missing atlas, missing texture, unsupported extension, and incompatible version cases.
- Add a lightweight acceptance checklist document for manual regression testing.
- Update project docs after 3.8 runtime support is truly usable.

## Skeleton Tree UI

- Improve slot highlight from bone-position marker to real attachment geometry highlight when region / mesh data is available.
- Add optional auto-focus or camera centering when selecting a bone or slot from the hierarchy tree.
- Consider search/filter support for large bone / slot hierarchies.

## UIUX Improvement Priorities

### P0 - 上線前必改

- [x] 手機版改成 Canvas 常駐，不要 `Viewer / Controls` 完全互斥。
- [x] 手機 Controls 改成 bottom sheet，支援 collapsed / half / full 狀態。
- [x] 手機播放列重新設計，避免和底部導覽、安全區互相擠壓。
- [x] 手機載入入口調整：優先 `Files / Drive`，`Folder` 依瀏覽器支援顯示。
- [x] 手機觸控尺寸修正：button、slider、timeline hit area 適合手指操作。
- [x] 處理手機 safe area / dynamic viewport / 橫向短螢幕。
- [x] 處理手勢衝突：Canvas pan/pinch、sheet 拖曳、timeline scrub 不互搶。
- [x] 保持手機狀態：切 sheet、旋轉、Drive 返回後不重置動畫、時間、zoom、selection。
- [x] 載入錯誤與 `Needs Fix` 改善，明確指出缺哪個檔案。
- [x] 支援補選缺少檔案，不要求使用者整包重選。
- [x] 修掉 UI 與文件裡的亂碼。
- [x] Share 前顯示即將上傳的檔案清單、數量與有效期限。
- [x] Share 設定說明清楚，例如 watermark、clip current animation 的影響。
- [x] Share 的 `Revoke` 與 `Delete history` 語意分清楚。
- [x] Share 危險操作加確認。
- [x] Share 失敗錯誤分類：處理失敗、上傳失敗、網路錯誤、過期、已撤銷。
- [x] 手機版 Share 使用 modal 或 full-screen flow，不塞在長 accordion 裡。
- [x] 補齊 icon-only button 的 `aria-label`。
- [x] Accordion / bottom sheet / modal 補基本 accessibility：`aria-expanded`、焦點管理、返回或 Escape 行為。
- [x] P0 驗收尺寸：`360x640`、`390x844`、`430x932`、`844x390`、桌機 `1440px`。

### P1 - 高優先

- [ ] 桌機 sidebar 重新分層，不要 `Load / Animate / Inspect` 全部同時攤開。
- [ ] 桌機 playback 改成底部 dock，可收合，不遮住 Canvas 關鍵區域。
- [ ] Share 從 sidebar accordion 移出，改成 modal / wizard。
- [ ] Share 流程分步：檢查 asset -> 設定選項 -> 確認上傳 -> 建立連結 -> 複製/開啟。
- [ ] Share 成功後提供明確成功狀態與 copy button。
- [ ] Skeleton tree 加搜尋。
- [ ] Skeleton tree 的展開與選取互動分離。
- [ ] 長 animation / bone / slot / attachment 名稱可完整查看。
- [ ] 選中的 bone / slot 在 Canvas 上有更明顯回饋。
- [ ] 播放列顯示目前 animation name。
- [ ] Runtime fallback / version 狀態改成清楚提示。
- [ ] 空狀態加強說明：用 `Files / Folder / Drive` 載入 Spine asset。
- [ ] 統一 UI 語言策略：全繁中或全英文。
- [ ] 降低過小字級，改善長時間操作可讀性。
- [ ] 檢查 light theme 對比。
- [ ] 建立 accessibility audit。
- [ ] UI 字串集中管理，為 i18n 與錯誤文案修正鋪路。

### P2 - 中優先

- [ ] Debug 選項預設收合並分組。
- [ ] Sidebar 寬度增加或支援 resize。
- [ ] Viewport zoom / pan 資訊改成短暫顯示或可收合。
- [ ] Speed slider 加 `0.1x / 3x` 標示。
- [ ] 加一鍵回到 `1x`。
- [ ] `Mix`、`Premultiplied Alpha`、`Filtering` 加 tooltip 說明。
- [ ] Skeleton tree 加 expand / collapse all。
- [ ] Share history 移到獨立管理區。
- [ ] Timeline 支援鍵盤 seek。
- [ ] Slider 補 `aria-valuetext`。
- [ ] Timeline marker tooltip 做得更完整。
- [ ] Event marker 若常用於除錯，加入更清楚的事件提示與定位。

### P3 - 後續精修

- [ ] Draw calls / event markers 做成更清楚的視覺 metrics。
- [ ] Info / Privacy / Terms 收進更多選單。
- [ ] 減少 uppercase + letter-spacing 的使用頻率。
- [ ] Share history 加進階篩選、搜尋或批次清理。
- [ ] 更細緻的 light / dark theme 視覺微調。
- [ ] 為常見 Spine 載入案例建立範例或 onboarding。
