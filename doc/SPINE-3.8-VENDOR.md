# Spine 3.8 Vendor Plan

## Goal

Support Spine 3.8 assets in this viewer by vendoring a real Spine 3.8 WebGL runtime build into the repository instead of relying on npm.

This project already supports Spine 4.x through the official `@esotericsoftware/spine-webgl` package. The 3.8 path is different:

- the 3.8 runtime must be supplied manually under `public/vendor/`
- the app loads it through `src/lib/spine/loaders/loadSpine3Runtime.ts`
- `src/lib/spine/adapters/spine3Adapter.ts` validates the runtime surface before session creation

## Current State

The 3.8 integration is usable, but still depends on a manually vendored 3.8 runtime bundle.

- `public/vendor/spine-3.8/dist/spine-webgl-3.8.js` is expected by the loader
- `loadSpine3Runtime.ts` loads that file by public URL using browser dynamic `import()`
- `Spine3RuntimeAdapter` validates exports and creates a real 3.8 rendering session
- `SpineCanvas.vue` now supports auto fallback between the selected runtime and fallback candidates

This means the remaining work is around validation, compatibility hardening, and documentation rather than basic 3.8 session support.

## Required Repository Layout

```text
public/vendor/
  spine-3.8/
    README.md
    dist/
      spine-webgl-3.8.js
      spine-webgl-3.8.d.ts   # optional
```

Documentation for the vendor source and build process should be kept in:

```text
doc/SPINE-3.8-VENDOR.md
```

## Why Vendor Instead Of npm

The project cannot depend on npm alone for Spine 3.8 support.

- the official `@esotericsoftware/spine-webgl` package used by this repo is a 4.x runtime
- this repository needs a 3.8-compatible runtime for older exported assets
- keeping the build artifact in `vendor/` makes the app reproducible without depending on a deprecated or unavailable package version

## Source Of Truth To Record

When adding the real 3.8 runtime, record all of the following in this document:

- Spine runtimes repository URL
- exact branch, tag, or commit used for the 3.8 build
- build command
- output format
- exported namespace or module shape
- any local patches or compatibility edits

If someone else needs to rebuild the vendor bundle later, this document should be enough to reproduce it.

## Preferred Output Format

Preferred format: ESM bundle.

Reasoning:

- the existing loader already uses `import()`
- Vite handles ESM naturally
- this avoids requiring a global `window` namespace
- it keeps the 3.8 path closer to how the 4.x runtime is consumed

The current loader expects a public asset at:

```ts
const SPINE3_VENDOR_RUNTIME_PATH = 'vendor/spine-3.8/dist/spine-webgl-3.8.js'
const runtimeUrl = new URL(SPINE3_VENDOR_RUNTIME_PATH, window.location.origin + import.meta.env.BASE_URL).toString()
export const loadSpine3Runtime = async () => import(/* @vite-ignore */ runtimeUrl)
```

If ESM is not practical, a fallback global bundle is acceptable, but the loader and adapter must then be updated to resolve the runtime from a known global object.

Recommended global fallback name:

- `window.Spine38Runtime`

## Required Runtime Surface

`Spine3RuntimeAdapter` currently validates the following exports:

- `ManagedWebGLRenderingContext` (3.8 equivalent of 4.x `SpineCanvas`)
- `SceneRenderer`
- `TextureAtlas`
- `AtlasAttachmentLoader`
- `SkeletonJson`
- `Skeleton`
- `AnimationStateData`
- `AnimationState`
- `GLTexture`

Note: `SpineCanvas` does not exist in Spine 3.8. The 4.x `SpineCanvas` class was not yet introduced. Use `ManagedWebGLRenderingContext` + `SceneRenderer` instead.

The runtime does not have to match the 4.x API exactly, but the adapter must be able to obtain equivalent behavior from the 3.8 bundle.

## Loader Plan

The loader file already exists:

- `src/lib/spine/loaders/loadSpine3Runtime.ts`

Expected behavior:

1. dynamically import `public/vendor/spine-3.8/dist/spine-webgl-3.8.js` through its public URL
2. return the ESM module object when the bundle is ESM
3. if the bundle exports through `default`, let the adapter unwrap it
4. if a global bundle is used later, update the loader so it loads the script and returns the global runtime namespace

## Adapter Integration Plan

The adapter file already exists:

- `src/lib/spine/adapters/spine3Adapter.ts`

Work still required there:

1. keep the runtime export validation
2. create a real 3.8 session that satisfies `SpineRuntimeSession`
3. map 3.8 runtime operations into the common adapter interface
4. support skeleton loading, animation switching, playback control, viewport updates, and cleanup
5. preserve the separation so `SpineCanvas.vue` continues talking only to the adapter layer

The key design rule is that version-specific API differences belong in the adapter, not in the component.

## Build Notes

When the real vendor bundle is added, update this section with concrete values.

- source repo: https://github.com/EsotericSoftware/spine-runtimes
- source ref: branch `3.8`
- build command: pre-built, downloaded directly (no local build needed)
- output file: `spine-ts/build/spine-webgl.js` (422,151 bytes)
- output format: IIFE global namespace (`var spine; (function(spine){...})`)
- export shape: `module.default` → flattened object of `spine` + `spine.webgl`
- local changes: one line appended — `export default Object.assign({}, spine, spine.webgl || {});`
  - Reason: WebGL-specific classes (`SpineCanvas`, `GLTexture`, `Vector3`) live under `spine.webgl`, not `spine` directly. Flattening exposes them at the top level so the adapter's export validation can find them.
- verification date: 2026-04-20

### Commands used to obtain the bundle

```bash
# 1. 下載 pre-built bundle（覆寫舊 placeholder）
curl -L "https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/3.8/spine-ts/build/spine-webgl.js" \
  -o "vendor/spine-3.8/dist/spine-webgl-3.8.js"

# 2. 追加 ESM export（將 spine + spine.webgl 扁平合併後 export）
# spine.webgl 子命名空間包含 SpineCanvas、GLTexture、Vector3 等 WebGL 類別
printf '\nexport default Object.assign({}, spine, spine.webgl || {});\n' >> "vendor/spine-3.8/dist/spine-webgl-3.8.js"
```

若需重建，重複執行以上兩步驟即可（先清空舊檔再下載）。

## Validation Checklist

After replacing the placeholder bundle and implementing the 3.8 adapter path, manually verify all of the following in `npm run dev`:

- load a Spine 3.8 skeleton, atlas, and textures successfully
- switch animations successfully
- pause, resume, seek, and change playback rate successfully
- toggle debug rendering successfully
- zoom, pan, and reset view successfully
- reload a 3.8 asset after previously loading a 4.x asset
- reload a 4.x asset after previously loading a 3.8 asset
- verify that error messages clearly distinguish missing vendor bundle, invalid exports, and session initialization failures

## Development Fallback Testing

When you do not have a real "primary runtime fails, fallback runtime succeeds" asset set, use the dev-only query parameters below in `npm run dev`:

- `?debugPrimaryRuntime=3`
  - forces the first attempt to use Spine 3.x
  - useful for testing `4.x -> fallback to 4.x runtime after 3.x failure` with an otherwise normal 4.x asset
- `?debugPrimaryRuntime=4`
  - forces the first attempt to use Spine 4.x
  - useful for testing `3.x -> fallback to 3.x runtime after 4.x failure` with an otherwise normal 3.x asset
- `?debugFailRuntime=3`
  - forces the 3.x attempt to fail immediately
- `?debugFailRuntime=4`
  - forces the 4.x attempt to fail immediately

Example:

```text
http://localhost:5173/?debugPrimaryRuntime=3
```

With a normal Spine 4.x asset, the viewer should first try 3.x, fail, then auto fallback to 4.x. The left sidebar version section should show `Fallback v3.x -> v4.x`.

## Short-Term Implementation Order

Recommended order:

1. replace `vendor/spine-3.8/dist/spine-webgl-3.8.js` with a real 3.8 build
2. confirm the exported module shape and required runtime surface
3. finish `Spine3RuntimeAdapter.createSession()`
4. run manual 3.8 and 4.x switching verification
5. update `doc/TODO.md` and any user-facing docs once the path is actually usable

## Decisions Kept For Now

These are the current working decisions unless implementation proves they are wrong:

- Spine 3.8 support is provided through a vendored runtime bundle
- ESM is the preferred output format
- version differences are isolated in the adapter layer
- `SpineCanvas.vue` should remain version-agnostic
