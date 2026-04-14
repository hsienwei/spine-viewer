# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Vue 3 + TypeScript application. Keep UI and rendering logic in `src/components/`; current entry points are `ControlPanel.vue` and `SpineCanvas.vue`, wired together from `src/App.vue` and `src/main.ts`. Use `src/composables/` for shared reactive logic when component code starts repeating. Store static assets in `public/`, working notes and specs in `doc/`, and treat `dist/` as generated build output.

## Build, Test, and Development Commands
Run `npm install` once to install dependencies. Use `npm run dev` to start the Vite dev server for local iteration. Use `npm run build` before submitting changes; it runs `vue-tsc` for type-checking and then creates the production bundle. Use `npm run preview` to inspect the built app from `dist/`.

## Coding Style & Naming Conventions
Follow the existing style: Vue Single-File Components with `<script setup lang="ts">`, 2-space indentation, single quotes, and no unnecessary semicolons. Name Vue components in PascalCase (`SpineCanvas.vue`), and use camelCase for refs, functions, and props (`handleAnimationChange`, `playbackRate`). Keep emitted event names in kebab-case, such as `file-selected` and `animation-change`.

## Testing Guidelines
This repository does not yet include an automated test framework. Until one is added, treat `npm run build` as the required validation step and manually verify key flows in `npm run dev`: loading Spine assets, switching animations, playback state changes, and rendering behavior. If tests are introduced later, keep them close to the relevant feature and document the new command in `package.json`.

## Commit & Pull Request Guidelines
Match the current commit history with short conventional-style subjects like `fix:` and `debug:`. Keep each commit focused on one change. Pull requests should explain the behavior change, reference the related issue when available, and include screenshots or short recordings for UI or rendering updates.

## Configuration Notes
Do not commit generated output or large sample assets unless the change explicitly requires them. When adjusting Spine runtime behavior, prefer small, reviewable changes and note any camera, bounds, or asset-loading assumptions in the PR description.
