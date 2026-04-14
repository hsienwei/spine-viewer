# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # 啟動開發伺服器（Vite，熱重載）
pnpm build      # 型別檢查（vue-tsc）+ 打包（vite build）
pnpm preview    # 預覽 dist/ 建置輸出
```

無測試框架，目前也無 lint 設定。

## Architecture

**技術棧：** Vue 3 (Composition API / `<script setup>`) + TypeScript + Vite 6 + `@esotericsoftware/spine-webgl` 4.2.x

### 元件結構與資料流

```
App.vue  ← 唯一狀態協調層，持有所有共享狀態（URLs、播放狀態）
├── ControlPanel.vue  → 左側 300px 面板，負責所有使用者輸入
│     emits: file-selected | animation-change | playback-change | seek | speed-change
└── SpineCanvas.vue   → 主內容區 WebGL 渲染核心
      emits: loaded | error | timeUpdate
```

`App.vue` 透過 props 向下傳遞資料，並接收子元件的 events 更新狀態。`SpineCanvas.vue` 持有所有 spine runtime 物件（`skeleton`、`animationState`、`spineCanvas`），這些為模組層級變數（非 reactive），避免 Vue 的 reactivity 追蹤。

### SpineCanvas.vue 渲染流程

1. **`loadSpine()`** — 動態 import `@esotericsoftware/spine-webgl`（首次載入時快取於模組變數 `spine`），呼叫 `preloadTextures()` 後建立 `spine.SpineCanvas(canvas, { app, pathPrefix, webglConfig })`
2. **`initializeSpine(sc)`** — 在 `app.initialize` callback 中執行：建立 `TextureAtlas`（使用 preloadedImages Map 解析頁面貼圖）→ `AtlasAttachmentLoader` → `SkeletonJson` → `Skeleton` + `AnimationState`，最後 emit `loaded`
3. **`renderSpine(sc)`** — 在每個 frame 的 `app.render` callback 中執行：更新動畫時間 → 計算 skeleton bounds → 設定 camera → clear → `drawSkeleton`

### 目前已知限制

- `renderSpine()` 中有大量 `console.log` debug 輸出（Bounds、Slots、Camera），Camera Z 固定為 150，尚未根據骨骼 bounds 自動計算
- `composables/` 目錄為空（規劃中的 `useSpine` composable 未實作）
- Spine 版本切換（v3/v4）的 UI 已在 ControlPanel，但 runtime 切換邏輯尚未實作
- `showBones` / `showSlots` props 傳入 SpineCanvas 但渲染邏輯尚未接入

### 檔案載入流程

`ControlPanel` 使用 `URL.createObjectURL()` 將本機檔案轉為 Blob URL，透過 `file-selected` event 傳出 `{ skeleton, atlas, textures[] }`。`SpineCanvas` 的 `assetManager.loadText()` 以此 URL 載入 `.json` 與 `.atlas`；`.png` 貼圖則由 `preloadTextures()` 直接以 `new Image()` 載入並存入 `preloadedImages: Map<string, HTMLImageElement>`，在 `TextureAtlas` 的 texture 解析 callback 中查找對應圖片。
