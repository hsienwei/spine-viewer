# spine-viewer MVP 任務清單

## 目前達成率（2026-04-14 檢查）
- 嚴格以「已完成」計算：4 / 10（40%）
- 若將「部分完成」折半計入：6 / 10（60%）

## MVP 變更概覽
- 新增「選取檔案」按鈕，與拖放共享載入流程
- 多檔載入時 Skeleton 優先排序
- DrawCall 顯示為單一數值
- MVP 內加入 Slot/Bone 顯示控制介面
- Spine 版本策略：4.x 主 + 3.x 回退

## 任務清單

### High Priority
- [x] 1) UI：新增「選取檔案」按鈕與檔案清單顯示
- [x] 2) API/Loader：新增載入入口與分類邏輯
- [~] 3) SpineRuntime 整合：與現有 useSpine 結合
  備註：Runtime 已整合，但目前直接實作在 `SpineCanvas.vue`，專案內沒有 `useSpine` composable。
- [~] 8) 錯誤處理與 UX 提示
  備註：已有 loading/error overlay，但缺少更完整的檔案驗證、版本不支援與載入失敗提示。
- [~] 9) 測試與驗收計畫
  備註：`npm run build` 可通過，但尚未整理成正式驗收計畫或測試案例文件。

### Medium Priority
- [ ] 4) 排序策略：多檔載入時 Skeleton 優先
  備註：目前僅依檔案副檔名分類後取第一個 skeleton / atlas，尚未實作排序策略。
- [x] 5) DrawCall 顯示：單一數值
- [x] 6) Slot/Bone 顯示控制（MVP 內）
- [~] 10) 文件與上線準備
  備註：已有 `SPEC.md`、`TODO.md` 與 build/preview 指令，但尚未看到完整上線準備內容。

### Low Priority
- [ ] 7) Spine 版本策略（可選路徑）
  備註：UI 有版本選單，但尚未實作 4.x 主 + 3.x fallback 的實際切換流程。

## 版本策略選項
- 方案 A：4.x 主 + 3.x 回退（已選擇）
- 方案 B：4.x 主，不計畫 3.x 支援
