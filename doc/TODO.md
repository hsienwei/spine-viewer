# TODO

## Spine 3.8 Vendor Runtime

- Replace `vendor/spine-3.8/dist/spine-webgl-3.8.js` placeholder with a real Spine 3.8 runtime build.
- Record the Spine 3.8 source branch/tag, build command, output format, and exported namespace in `doc/SPINE-3.8-VENDOR.md`.
- Implement `Spine3RuntimeAdapter` session initialization after the real 3.8 runtime bundle is available.
- Validate that the 3.8 bundle exposes the required runtime APIs used by the adapter.
- Add real 3.x load path verification: load, animation switch, seek, playback rate, debug display, and reload back to 4.x.

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
