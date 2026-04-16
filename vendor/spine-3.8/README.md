# Spine 3.8 Vendor Runtime

這個目錄保留 Spine 3.8 runtime 的本地 vendor 產物。

## Purpose

目前官方 `@esotericsoftware/spine-webgl` npm package 只有 4.x，專案若要支援 3.8，需自行提供 3.8 runtime bundle。

## Expected Files

建議至少提供：

```text
vendor/spine-3.8/
  dist/
    spine-webgl-3.8.js
```

## Current State

目前 `dist/spine-webgl-3.8.js` 是 placeholder module，只是為了讓專案結構、loader 與 adapter 可以先落地。

當你之後自行 build 出真正的 3.8 runtime 時，直接覆蓋該檔案即可。

## Recommended Output

優先使用 ESM bundle，方便由 Vite 使用動態 `import()` 載入。

## Validation

替換成真實 bundle 後，請確認它至少能提供或對外暴露等效能力：

- `SpineCanvas`
- `TextureAtlas`
- `AtlasAttachmentLoader`
- `SkeletonJson`
- `Skeleton`
- `AnimationStateData`
- `AnimationState`
- `GLTexture`
- `Vector3`
