# TODO

## Viewport

- Add a UI setting for the viewport max zoom limit instead of hardcoding it in `src/components/SpineCanvas.vue`.
- Current zoom range is `20%` to `1000%`.
- The setting should be exposed from `ControlPanel` and applied by `SpineCanvas`.
- `Reset View` should reset only the current view transform, not the configured zoom limit.
