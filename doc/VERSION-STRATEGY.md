# Spine Version Strategy

## Goal

支援在同一個 viewer session 中載入不同版本的 Spine 資產，並避免 runtime 混用、資源殘留與非同步競態。

目前策略目標：

- 預設使用 `auto`
- 先讀取檔案內容再決定版本
- 優先使用 4.x
- 判斷不明或初始化失敗時可 fallback 到 3.x
- 每次載入都視為新的 session，完整清理前一個 session

## Current Risks

目前實作集中在 `src/components/SpineCanvas.vue`，存在幾個切版風險：

- runtime module 以檔案層級變數保存，切版本時容易混用 class 與 API
- reload 前沒有完整 dispose 舊的 SpineCanvas / WebGL 資源
- object URL 與預載圖片快取未集中管理
- 多次快速載入時，舊的 async 流程可能覆蓋新的 session 狀態

## Proposed Architecture

### 1. Version Detection Layer

新增版本判斷層，只負責讀檔與決策，不做 render。

建議位置：

- `src/lib/spine/versionDetection.ts`

責任：

- 接收 `File[]`
- 找出 skeleton / atlas / textures
- 讀 skeleton JSON 內容
- 根據內容判定 `3`、`4`、`unknown`
- 回傳標準化的檔案描述

建議型別：

```ts
export type SpineMajorVersion = 3 | 4
export type SpineVersionMode = 'auto' | 'force-3' | 'force-4'

export interface SpineSourceFiles {
  skeletonFile: File
  atlasFile: File
  textureFiles: File[]
}

export interface SpineVersionDetectionResult {
  requestedMode: SpineVersionMode
  detectedVersion: SpineMajorVersion | 'unknown'
  selectedVersion: SpineMajorVersion
  fallbackCandidates: SpineMajorVersion[]
  sourceFiles: SpineSourceFiles
  reason: string
}
```

判斷順序：

1. 若使用者選 `force-4` 或 `force-3`，直接指定版本
2. 若是 `auto`，先從 skeleton JSON 的版本欄位判斷
3. 若判斷不出來，先選 4，再保留 3 為 fallback

### 2. Runtime Adapter Layer

不同 Spine major version 不直接共用初始化邏輯，而是透過 adapter 封裝差異。

建議位置：

- `src/lib/spine/adapters/types.ts`
- `src/lib/spine/adapters/spine4Adapter.ts`
- `src/lib/spine/adapters/spine3Adapter.ts`
- `src/lib/spine/adapters/index.ts`

共同介面：

```ts
export interface SpineRuntimeAdapter {
  version: 3 | 4
  createSession(input: SpineSessionCreateInput): Promise<SpineRuntimeSession>
}

export interface SpineSessionCreateInput {
  canvas: HTMLCanvasElement
  sourceFiles: SpineSourceFiles
  animationName?: string
}

export interface SpineRuntimeSession {
  version: 3 | 4
  getAnimations(): string[]
  getDuration(animationName?: string): number
  setAnimation(name: string, loop: boolean): void
  setPlayback(enabled: boolean, playbackRate: number): void
  setDebugOptions(options: { showBones: boolean; showSlots: boolean }): void
  seekTo(time: number): void
  resetView(): void
  resize(): void
  getFrameMetrics(): { currentTime: number; duration: number; drawCall: number }
  dispose(): void
}
```

設計重點：

- `SpineCanvas.vue` 不直接碰 `@esotericsoftware/spine-webgl` 的版本差異
- 每個 adapter 自己處理 import、atlas、skeleton、debug renderer 與 draw call API
- UI 只看標準化後的 session 介面

### 3. Session Lifecycle Layer

建立可重建的 session 管理器，保證每次載入都先清理舊 session。

建議位置：

- `src/lib/spine/sessionManager.ts`

責任：

- 保留目前活動中的 `SpineRuntimeSession`
- 保留 `loadRequestId`
- 新載入開始時先 dispose 舊 session
- 只接受最新一次 request 的 async 結果

建議型別：

```ts
export interface ActiveSpineSession {
  requestId: number
  runtimeVersion: 3 | 4
  session: SpineRuntimeSession
}
```

基本流程：

1. `requestId += 1`
2. dispose 舊 session
3. 偵測版本
4. 建立 adapter
5. 建立新 session
6. 若 async 返回時 `requestId` 已過期，立刻 dispose 該結果
7. 只將最新 session 掛到畫面上

### 4. File Resource Layer

將 object URL 與預載圖片集中管理，避免快取污染與 memory leak。

建議位置：

- `src/lib/spine/fileResources.ts`

責任：

- 由 `File` 產生 object URL
- 追蹤已建立的 URL
- session dispose 時統一 `URL.revokeObjectURL`
- 提供依檔名查找 texture 的 mapping

建議型別：

```ts
export interface SpineResolvedResources {
  skeletonUrl: string
  atlasUrl: string
  textureUrls: string[]
  revokeAll(): void
}
```

## UI Strategy

`ControlPanel` 的版本選單建議改為：

- `Auto`
- `4.x (Force)`
- `3.x (Force)`

另外增加只讀資訊：

- `Detected Version`
- `Runtime Version`
- `Fallback Used`

這樣使用者可以知道：

- 是檔案本身判成 3.x / 4.x
- 還是因為初始化失敗才 fallback

## Recommended Data Flow

### Before

`ControlPanel -> App -> SpineCanvas`

傳遞內容以 object URL 與簡單 props 為主。

### After

`ControlPanel -> App -> versionDetection -> sessionManager -> runtimeAdapter -> SpineCanvas`

建議資料流：

1. `ControlPanel` 傳 `File[]` 與 `versionMode`
2. `App` 保存目前的載入請求與 UI 狀態
3. `sessionManager` 負責完整 reload
4. `SpineCanvas` 只接收已初始化好的 session，或由 `SpineCanvas` 內部調用 sessionManager，但不要自己負責版本判斷

## State Model

建議在 `App.vue` 維護：

```ts
interface SpineLoadState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  versionMode: 'auto' | 'force-3' | 'force-4'
  detectedVersion: 3 | 4 | 'unknown' | null
  runtimeVersion: 3 | 4 | null
  fallbackUsed: boolean
  errorMessage: string
}
```

## Failure Handling

初始化流程建議：

1. 先依 detection result 選 primary version
2. 用 primary adapter 建立 session
3. 若失敗且允許 fallback，記錄錯誤並試 secondary version
4. 若 secondary 也失敗，回報完整錯誤

錯誤訊息建議至少包含：

- 偵測版本
- 嘗試版本
- 是否 fallback
- 最終錯誤原因

## Implementation Order

建議實作順序：

1. 抽出 `versionDetection.ts`
2. 把 `ControlPanel` 改成傳 `File[]` 而不是只有 object URL
3. 抽出 `fileResources.ts`
4. 定義 `SpineRuntimeAdapter` 介面
5. 先完成 `spine4Adapter`
6. 把目前 `SpineCanvas.vue` 改為依賴 session / adapter
7. 再加入 `spine3Adapter`
8. 最後補上 UI 狀態顯示與 fallback 訊息

## Short-Term Recommendation

如果目前只想先把架構準備好，不急著完整支援 3.x，最務實的做法是：

- 先加 `versionDetection.ts`
- UI 改成 `auto / force-4 / force-3`
- 先讓 `force-3` 顯示為未實作或保留選項
- 把 Spine 4 的 session lifecycle 重構乾淨

這樣之後再補 3.x adapter 時，風險最低。
