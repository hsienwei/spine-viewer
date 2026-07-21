<template>
  <div class="spine-viewer">
    <aside
      id="mobile-control-sheet"
      class="sidebar"
      :class="{
        'sidebar--share-preview': isSharePreview,
        'sidebar--mobile-sheet': isMobileViewport,
        [`sidebar--mobile-${mobileSheetState}`]: isMobileViewport,
        [`sidebar--mobile-panel-${activeMobilePanel}`]: isMobileViewport
      }"
      :aria-hidden="isMobileViewport && mobileSheetState === 'collapsed'"
    >
      <div class="sidebar-brand">
        <div v-if="isMobileViewport" class="mobile-sheet-grabber" aria-hidden="true"></div>
        <div class="sidebar-brand-copy">
          <div class="brand-title">
            <span class="brand-spine">SPINE</span>
            <span class="brand-viewer">VIEWER</span>
          </div>
          <span class="brand-version">v{{ appVersion }}</span>
        </div>
        <div v-if="isMobileViewport" class="mobile-sheet-actions" aria-label="Sheet size controls">
          <div class="mobile-more-wrap">
            <button
              type="button"
              class="mobile-sheet-icon-btn"
              aria-label="More information links"
              :aria-expanded="isMobileMoreOpen"
              @click="isMobileMoreOpen = !isMobileMoreOpen"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="8" cy="3.25" r="1.25"/>
                <circle cx="8" cy="8" r="1.25"/>
                <circle cx="8" cy="12.75" r="1.25"/>
              </svg>
            </button>
            <div v-if="isMobileMoreOpen" class="mobile-more-menu">
              <button
                type="button"
                class="mobile-more-item"
                @click="openInfoFromMobileMore"
              >
                Info
              </button>
              <a
                class="mobile-more-item"
                :href="privacyPolicyUrl"
                target="_blank"
                rel="noreferrer"
                @click="isMobileMoreOpen = false"
              >
                Privacy Policy
              </a>
              <a
                class="mobile-more-item"
                :href="termsOfServiceUrl"
                target="_blank"
                rel="noreferrer"
                @click="isMobileMoreOpen = false"
              >
                Terms of Service
              </a>
            </div>
          </div>
          <button
            type="button"
            class="mobile-sheet-icon-btn"
            :aria-label="mobileSheetState === 'full' ? 'Set controls sheet to half height' : 'Expand controls sheet'"
            @click="toggleMobileSheetSize"
          >
            <svg v-if="mobileSheetState === 'full'" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 10l4-4 4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button type="button" class="mobile-sheet-icon-btn" aria-label="Collapse controls sheet" @click="setMobileSheetState('collapsed')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <button
          v-if="!isMobileViewport"
          class="theme-toggle"
          @click="toggleTheme"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <svg v-if="isDark" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.4"/>
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M10.01 3.99l1.06-1.06M2.93 11.07l1.06-1.06" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11.5 8.5A5 5 0 1 1 5.5 2.5a3.5 3.5 0 0 0 6 6z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <div class="sidebar-content">
        <div v-if="!isSharePreview" class="sidebar-panel sidebar-panel--load" :class="{ 'sidebar-panel--empty-state-focus': showEmptyState }">
          <button
            type="button"
            class="sidebar-panel-header"
            :aria-expanded="isLoadFilesPanelOpen"
            @click="toggleSidebarPanel('load')"
          >
            <span class="sidebar-panel-header-title">Load <span v-if="showEmptyState" class="sidebar-panel-start-hint">Start here</span></span>
            <svg class="panel-chevron" :class="{ open: isLoadFilesPanelOpen }" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-show="isLoadFilesPanelOpen" class="sidebar-panel-body">
            <LoadFilesPanel @file-selected="handleFileSelected" />
          </div>
        </div>

        <div v-if="!isSharePreview && animations.length > 0" class="sidebar-panel sidebar-panel--animate">
          <button
            type="button"
            class="sidebar-panel-header"
            :aria-expanded="isAnimatePanelOpen"
            @click="toggleSidebarPanel('animate')"
          >
            <span>Animate</span>
            <svg class="panel-chevron" :class="{ open: isAnimatePanelOpen }" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-show="isAnimatePanelOpen" class="sidebar-panel-body">
            <ControlPanel
              mode="animate"
              @tracks-change="handleTracksChange"
              :animations="animations"
              :tracks="animationTracks"
              :is-playing="isPlaying"
            />
          </div>
        </div>

        <div v-if="!isSharePreview && hasInspectPanel" class="sidebar-panel sidebar-panel--inspect">
          <button
            type="button"
            class="sidebar-panel-header"
            :aria-expanded="isInspectPanelOpen"
            @click="toggleSidebarPanel('inspect')"
          >
            <span>Inspect</span>
            <svg class="panel-chevron" :class="{ open: isInspectPanelOpen }" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-show="isInspectPanelOpen" class="sidebar-panel-body">
            <ControlPanel
              mode="inspect"
              @skin-change="handleSkinChange"
              @debug-option-change="handleDebugOptionChange"
              @premultiply-alpha-change="handlePremultipliedAlphaChange"
              @texture-filtering-change="handleTextureFilteringChange"
              :animations="animations"
              :skins="skins"
              :current-skin="currentSkin"
              :draw-call="drawCall"
              :event-marker-count="currentAnimationMarkers.length"
              :detected-version="detectedVersion"
              :runtime-version="runtimeVersion"
              :initial-runtime-version="initialRuntimeVersion"
              :fallback-used="fallbackUsed"
              :debug-options="debugOptions"
              :premultiplied-alpha="premultipliedAlpha"
              :texture-filtering="textureFiltering"
            />
            <div class="inspect-subsection">
              <StructurePanel
                @bone-selected="handleBoneSelected"
                @slot-selected="handleSlotSelected"
                :structure="structure"
                :selection="selection"
              />
            </div>
          </div>
        </div>

        <div v-if="isSharePreview && shareManifest" class="sidebar-panel">
          <div class="sidebar-panel-header sidebar-panel-header--static">
            <span>Shared Preview</span>
          </div>
          <div class="sidebar-panel-body">
            <div class="share-preview-summary">
              <div class="share-preview-title">{{ shareManifest.files.skeleton.name }}</div>
              <div class="share-preview-copy">
                Expires {{ formatShareDate(shareManifest.expiresAt) }}
              </div>
            </div>
            <div v-if="animations.length > 0 || skins.length > 0" class="share-preview-controls">
              <label v-if="animations.length > 0" class="share-preview-field">
                <span class="share-preview-label">Animation</span>
                <div class="share-preview-select-wrap">
                  <select
                    class="share-preview-select"
                    :value="activeShareAnimation"
                    @change="handleShareAnimationChange(($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="anim in animations" :key="anim" :value="anim">{{ anim }}</option>
                  </select>
                </div>
              </label>

              <label v-if="skins.length > 0" class="share-preview-field">
                <span class="share-preview-label">Skin</span>
                <div class="share-preview-select-wrap">
                  <select
                    class="share-preview-select"
                    :value="currentSkin"
                    @change="handleSkinChange(($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="skin in skins" :key="skin" :value="skin">{{ skin }}</option>
                  </select>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div v-if="isSharePreview && shareError && !shareManifest" class="sidebar-panel">
          <div class="sidebar-panel-header sidebar-panel-header--static">
            <span>Shared Preview</span>
          </div>
          <div class="sidebar-panel-body">
            <div class="share-error-banner">
              <div class="share-error-title">Share load failed</div>
              <div class="share-error-copy">{{ shareError }}</div>
              <button
                type="button"
                class="sidebar-link sidebar-link-button"
                @click="handleExitSharePreview"
              >
                Back to Viewer
              </button>
            </div>
          </div>
        </div>

        <div v-if="!isSharePreview" class="sidebar-panel sidebar-panel--share">
          <button 
            type="button" 
            class="sidebar-panel-header" 
            :aria-expanded="isSharePanelOpen"
            @click="isSharePanelOpen = !isSharePanelOpen"
          >
            <span>Share</span>
            <svg class="panel-chevron" :class="{ open: isSharePanelOpen }" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-show="isSharePanelOpen" class="sidebar-panel-body">
            <div class="share-panel-body">
              <div class="share-export-card">
                <div class="share-export-copy">
                  <span class="share-export-title">WebM Clip</span>
                  <span class="share-export-hint">{{ shareWebmSummary }}</span>
                </div>
                <button
                  type="button"
                  class="share-secondary-btn"
                  :disabled="!canShareWebm || isSharingWebm"
                  @click="handleShareWebm"
                >
                  {{ isSharingWebm ? 'Recording...' : 'Export WebM' }}
                </button>
                <p v-if="shareWebmStatus" class="share-export-status">
                  {{ shareWebmStatus }}
                </p>
              </div>
              <div class="share-config-card">
                <div class="share-config-title">Share Setup</div>
                <p class="share-config-copy">
                  Create a 24-hour preview link by uploading the selected Spine assets to Spine Viewer storage after confirmation.
                </p>
                <label class="share-option-row">
                  <span class="share-option-copy">
                    <span class="share-option-title">Watermark textures</span>
                    <span class="share-option-hint">Export texture pages as WebP and apply a static watermark.</span>
                  </span>
                  <span class="share-option-switch">
                    <input v-model="shareWatermarkEnabled" class="share-option-checkbox" type="checkbox">
                    <span class="share-option-track">
                      <span class="share-option-thumb"></span>
                    </span>
                  </span>
                </label>
                <label class="share-option-row" :class="{ disabled: !sharePrimaryAnimationName }">
                  <span class="share-option-copy">
                    <span class="share-option-title">Clip to current animation</span>
                    <span class="share-option-hint">
                      {{ sharePrimaryAnimationName ? `Only keep "${sharePrimaryAnimationName}" in the shared skeleton JSON.` : 'Choose an animation first.' }}
                    </span>
                  </span>
                  <span class="share-option-switch">
                    <input
                      v-model="shareClipCurrentAnimation"
                      class="share-option-checkbox"
                      type="checkbox"
                      :disabled="!sharePrimaryAnimationName"
                    >
                    <span class="share-option-track">
                      <span class="share-option-thumb"></span>
                    </span>
                  </span>
                </label>
                <div class="share-defaults-summary">
                  <span class="share-defaults-label">Defaults</span>
                  <span class="share-defaults-value">{{ shareDefaultsSummary }}</span>
                </div>
              </div>
              <button
                type="button"
                class="share-primary-btn"
                :disabled="!canShare || isSharing"
                @click="openShareConfirm"
              >
                {{ isSharing ? 'Sharing...' : 'Create Share Link' }}
              </button>
              <p v-if="!canShare" class="sidebar-status">
                Load a Spine asset and keep at least one animation available before sharing.
              </p>
              <p v-if="shareStatusText" class="sidebar-status" :class="{ error: !!shareError }">
                {{ shareStatusText }}
              </p>
              <a
                v-if="shareUrl"
                class="sidebar-link"
                :href="shareUrl"
                target="_blank"
                rel="noreferrer"
              >
                Open Share Link
              </a>

              <div v-if="shareHistory.length > 0" class="inspect-subsection inspect-subsection--share-history">
                <div class="inspect-subsection-header">
                  <span class="inspect-subsection-title">Share History</span>
                </div>
                <div class="share-history-list">
                  <div
                    v-for="item in shareHistory"
                    :key="item.token"
                    class="share-history-item"
                    :class="`share-history-item--${getShareHistoryStatus(item)}`"
                  >
                    <div class="share-history-meta">
                      <div class="share-history-title-row">
                        <span class="share-history-title">{{ item.skeletonName }}</span>
                        <span class="share-history-status" :class="`share-history-status--${getShareHistoryStatus(item)}`">
                          {{ getShareHistoryStatusLabel(item) }}
                        </span>
                      </div>
                      <span class="share-history-subtitle">
                        Expires {{ formatShareDate(item.expiresAt) }}
                      </span>
                      <span v-if="getShareHistoryOptionSummary(item)" class="share-history-subtitle">
                        {{ getShareHistoryOptionSummary(item) }}
                      </span>
                    </div>
                    <div class="share-history-actions">
                      <button type="button" class="mini-action-btn" :disabled="!isShareHistoryActionAllowed(item)" @click="openShareLink(item.shareUrl)">Open</button>
                      <button type="button" class="mini-action-btn" :disabled="!isShareHistoryActionAllowed(item)" @click="copyShareLink(item.shareUrl)">Copy</button>
                      <button
                        type="button"
                        class="mini-action-btn danger"
                        :disabled="getShareHistoryStatus(item) !== 'active' || !!item.revoking"
                        @click="handleRevokeShare(item.token)"
                      >
                        {{ item.revoking ? 'Revoking...' : getShareHistoryRevokeLabel(item) }}
                      </button>
                      <button
                        type="button"
                        class="mini-action-btn danger"
                        @click="deleteShareHistory(item.token)"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="shareError && !shareManifest" class="share-error-banner">
                <div class="share-error-title">Share load failed</div>
                <div class="share-error-copy">{{ shareError }}</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div v-if="!isSharePreview && !isMobileViewport" class="sidebar-footer">
        <button
          type="button"
          class="sidebar-link sidebar-link-button"
          @click="isInfoOpen = true"
        >
          Info
        </button>
        <a
          class="sidebar-link"
          :href="privacyPolicyUrl"
          target="_blank"
          rel="noreferrer"
        >
          Privacy Policy
        </a>
        <a
          class="sidebar-link"
          :href="termsOfServiceUrl"
          target="_blank"
          rel="noreferrer"
        >
          Terms of Service
        </a>
      </div>
    </aside> 

    <main
      class="main-content"
      :class="{
        'main-content--mobile-sheet': isMobileViewport
      }"
    >
      <SpineCanvas
        ref="spineCanvasRef"
        :files="sourceFiles"
        :animation-name="animationName"
        :animation-tracks="animationTracks"
        :skin-name="currentSkin"
        :is-playing="isPlaying"
        :playback-rate="playbackRate"
        :debug-options="debugOptions" 
        :selection="selection" 
        :premultiplied-alpha="premultipliedAlpha" 
        :texture-filtering="textureFiltering" 
        @loaded="(data) => handleLoaded(data)" 
        @time-update="(state) => handleTimeUpdate(state)" 
        @runtime-event="(payload) => handleRuntimeEvent(payload)" 
        @error="(err) => handleError(err)" 
        @canvas-tap="handleCanvasTap"
      />
      <section v-if="showEmptyState" class="empty-load-state" aria-label="Load a Spine asset">
        <p class="empty-load-state__eyebrow">SPINE ASSET</p>
        <h1 class="empty-load-state__title">Load a Spine asset</h1>
        <p class="empty-load-state__copy">Use the Load panel</p>
        <svg class="empty-load-state__arrow" :class="{ 'empty-load-state__arrow--mobile': isMobileViewport }" width="40" height="24" viewBox="0 0 40 24" fill="none" aria-hidden="true">
          <path d="M38 12H4m0 0 8-8M4 12l8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </section>
      <PlaybackOverlay
        :visible="animations.length > 0"
        :track-options="overlayTrackOptions"
        :observed-track-index="overlayTrackIndex"
        :animation-name="observedAnimationName"
        :current-time="currentTime"
        :duration="duration"
        :is-playing="isPlaying"
        :playback-rate="playbackRate"
        :event-markers="currentAnimationMarkers"
        :runtime-notifications="visibleRuntimeNotifications"
        @track-change="handleOverlayTrackChange"
        @playback-change="handlePlaybackChange"
        @seek="handleSeek"
        @speed-change="handleSpeedChange"
      />
      <button
        v-if="isMobileViewport && !isSharePreview"
        type="button"
        class="mobile-floating-share"
        :disabled="!canShare"
        aria-label="Open share confirmation"
        @click="openShareConfirm"
      >
        Share
      </button>
    </main>

    <nav v-if="isMobileViewport && !isSharePreview" class="mobile-bottom-nav" role="tablist" aria-label="Mobile controls">
      <button
        type="button"
        class="mobile-nav-btn"
        :class="{ 'mobile-nav-btn--active': activeMobilePanel === 'load' && mobileSheetState !== 'collapsed' }"
        role="tab"
        :aria-selected="activeMobilePanel === 'load' && mobileSheetState !== 'collapsed'"
        aria-controls="mobile-control-sheet"
        @click="openMobilePanel('load')"
      >
        Files
      </button>
      <button
        type="button"
        class="mobile-nav-btn"
        :class="{ 'mobile-nav-btn--active': activeMobilePanel === 'animate' && mobileSheetState !== 'collapsed' }"
        role="tab"
        :aria-selected="activeMobilePanel === 'animate' && mobileSheetState !== 'collapsed'"
        :disabled="!canUseMobileAnimate"
        aria-controls="mobile-control-sheet"
        @click="openMobilePanel('animate')"
      >
        Animate
      </button>
      <button
        type="button"
        class="mobile-nav-btn"
        :class="{ 'mobile-nav-btn--active': activeMobilePanel === 'inspect' && mobileSheetState !== 'collapsed' }"
        role="tab"
        :aria-selected="activeMobilePanel === 'inspect' && mobileSheetState !== 'collapsed'"
        :disabled="!canUseMobileInspect"
        aria-controls="mobile-control-sheet"
        @click="openMobilePanel('inspect')"
      >
        Inspect
      </button>
    </nav>

    <div
      v-if="isShareConfirmOpen"
      class="share-confirm-backdrop"
      @click.self="closeShareConfirm"
    >
      <section
        class="share-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-confirm-title"
      >
        <div class="share-confirm-header">
          <div>
            <p class="share-confirm-kicker">Share Confirmation</p>
            <h2 id="share-confirm-title" class="share-confirm-title">Create 24-hour preview link</h2>
          </div>
          <button ref="shareConfirmCloseRef" type="button" class="info-modal-close" aria-label="Close share confirmation" @click="closeShareConfirm">×</button>
        </div>
        <div class="share-confirm-body">
          <p class="share-confirm-copy">
            Spine Viewer will upload the selected asset files to create a temporary preview link. This does not change Google Drive sharing permissions.
          </p>
          <div class="share-confirm-section">
            <div class="share-confirm-section-title">Files to upload</div>
            <div class="share-confirm-file-list">
              <div v-for="item in shareUploadFileSummary" :key="item.name" class="share-confirm-file">
                <span class="share-confirm-file-name">{{ item.name }}</span>
                <span class="share-confirm-file-meta">{{ item.type }} · {{ item.size }}</span>
              </div>
            </div>
          </div>
          <div class="share-confirm-section">
            <div class="share-confirm-section-title">Share settings</div>
            <div class="share-confirm-detail-row">
              <span>Expires</span>
              <strong>{{ shareUploadExpiryPreview }}</strong>
            </div>
            <div class="share-confirm-detail-row">
              <span>Watermark</span>
              <strong>{{ shareWatermarkEnabled ? 'On, textures exported as WebP with a soft static watermark' : 'Off' }}</strong>
            </div>
            <div class="share-confirm-detail-row">
              <span>Animation content</span>
              <strong>{{ shareClipCurrentAnimation && sharePrimaryAnimationName ? `Only "${sharePrimaryAnimationName}"` : 'All animations kept' }}</strong>
            </div>
            <div class="share-confirm-detail-row">
              <span>Default preview</span>
              <strong>{{ shareDefaultsSummary }}</strong>
            </div>
          </div>
          <p v-if="shareError" class="share-confirm-error">{{ shareError }}</p>
        </div>
        <div class="share-confirm-actions">
          <button type="button" class="share-secondary-btn" :disabled="isSharing" @click="closeShareConfirm">Cancel</button>
          <button type="button" class="share-primary-btn" :disabled="!canShare || isSharing" @click="executeCreateShare">
            {{ isSharing ? 'Creating...' : 'Create Share Link' }}
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="isInfoOpen"
      class="info-modal-backdrop"
      @click.self="isInfoOpen = false"
    >
      <section
        class="info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
      >
        <div class="info-modal-header">
          <div>
            <p class="info-modal-kicker">About</p>
            <h2 id="info-modal-title" class="info-modal-title">Spine Viewer</h2>
          </div>
          <button
            type="button"
            class="info-modal-close"
            aria-label="Close info dialog"
            @click="isInfoOpen = false"
          >
            ×
          </button>
        </div>
        <div class="info-modal-body">
          <p class="info-modal-copy">
            Spine Viewer 是用來載入、檢視與播放 Spine 動畫資產的網頁工具，支援本機檔案與 Google Drive 檔案挑選。
          </p>
          <p class="info-modal-copy">
            Google Drive 權限只用於透過 Google Picker 選取並下載你明確選擇的檔案。建立分享連結時，會在你確認後上傳目前選取的 Spine 資產以產生 24 小時預覽連結；詳細資料處理方式請參考 Privacy Policy。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import packageJson from '../package.json'
import ControlPanel from './components/ControlPanel.vue'
import LoadFilesPanel from './components/LoadFilesPanel.vue'
import PlaybackOverlay from './components/PlaybackOverlay.vue'
import SpineCanvas from './components/SpineCanvas.vue'
import StructurePanel from './components/StructurePanel.vue'
import { DEFAULT_SPINE_DEBUG_OPTIONS, DEFAULT_SPINE_TEXTURE_FILTERING } from './lib/spine/adapters'
import type { SpineAnimationEventMarker, SpineAnimationEventPayload, SpineAnimationSummary, SpineDebugOptions, SpineTextureFiltering, SpineTrackEntry, SpineTrackPlaybackState } from './lib/spine/adapters'
import type { SpineSelectionState, SpineSkeletonStructure } from './lib/spine/skeletonStructure'
import { classifySpineFiles, type SpineDetectedVersion, type SpineMajorVersion } from './lib/spine/versionDetection'
import { createShareLink, extractShareTokenFromPath, fetchShareManifest, fetchSharedSourceFiles, normalizeShareErrorMessage, revokeShareLink } from './lib/share/api' 
import { prepareShareUpload } from './lib/share/prepareShareUpload'
import type { ShareManifest } from './lib/share/types'
import { downloadWebm, recordCanvasToWebm } from './lib/share/webm'

const appVersion = packageJson.version

const sourceFiles = ref<File[]>([])
const animationName = ref('')
const animationTracks = ref<SpineTrackEntry[]>([])
const overlayTrackIndex = ref(0)
const currentSkin = ref('')
const isPlaying = ref(true)
const playbackRate = ref(1)
const debugOptions = ref<SpineDebugOptions>({ ...DEFAULT_SPINE_DEBUG_OPTIONS })
const premultipliedAlpha = ref(true)
const textureFiltering = ref<SpineTextureFiltering>(DEFAULT_SPINE_TEXTURE_FILTERING)
const spineCanvasRef = ref<InstanceType<typeof SpineCanvas> | null>(null)
const isLoadFilesPanelOpen = ref(true)
const isAnimatePanelOpen = ref(true)
const isInspectPanelOpen = ref(true)
const isSharePanelOpen = ref(false)
const isInfoOpen = ref(false)
const isMobileViewport = ref(false)
const activeMobilePanel = ref<'load' | 'animate' | 'inspect'>('load')
const mobileSheetState = ref<'collapsed' | 'half' | 'full'>('half')
const isShareConfirmOpen = ref(false)
const shareConfirmCloseRef = ref<HTMLButtonElement | null>(null)
const isMobileMoreOpen = ref(false)

const animations = ref<string[]>([])
const skins = ref<string[]>([])
const animationSummaries = ref<SpineAnimationSummary[]>([])
const structure = ref<SpineSkeletonStructure>({ bones: [], slots: [], totalBones: 0 })
const selection = ref<SpineSelectionState>({ boneName: null, slotName: null })
const currentTime = ref(0)
const duration = ref(0)
const drawCall = ref(0)
const trackPlaybackStates = ref<SpineTrackPlaybackState[]>([])
const detectedVersion = ref<SpineDetectedVersion | null>(null)
const runtimeVersion = ref<SpineMajorVersion | null>(null)
const initialRuntimeVersion = ref<SpineMajorVersion | null>(null)
const fallbackUsed = ref(false)
const isSharing = ref(false)
const shareUrl = ref('')
const shareExpiresAt = ref('')
const shareError = ref('')
const shareToken = ref('')
const shareManifest = ref<ShareManifest | null>(null)
const shareWatermarkEnabled = ref(true)
const shareClipCurrentAnimation = ref(false)
const isSharingWebm = ref(false)
const shareWebmStatus = ref('')

interface ShareHistoryEntry {
  token: string
  shareUrl: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  skeletonName: string
  atlasName: string
  watermarkLabel: string
  watermarkEnabled?: boolean
  clipAnimationName?: string | null
  defaultAnimationName?: string | null
  defaultSkinName?: string | null
  revoking?: boolean
}

const SHARE_HISTORY_KEY = 'spine-viewer-share-history'
const shareHistory = ref<ShareHistoryEntry[]>([])
let shareHistoryPruneTimer: number | null = null

interface RuntimeNotificationRecord {
  id: number
  eventName: string
  animationName: string | null
  trackIndex: number
  trackTime: number | null
  receivedAt: string
  visible: boolean
  count: number
}

const runtimeNotifications = ref<RuntimeNotificationRecord[]>([])

const isSharePreview = computed(() => !!shareToken.value)
const hasStructurePanel = computed(() => structure.value.bones.length > 0)  
const hasInspectPanel = computed(() => {
  return hasStructurePanel.value
    || skins.value.length > 0
    || animations.value.length > 0
    || runtimeVersion.value !== null
})
const canShare = computed(() => sourceFiles.value.length > 0 && animations.value.length > 0)  
const showEmptyState = computed(() => !isSharePreview.value && sourceFiles.value.length === 0)
const canUseMobileAnimate = computed(() => animations.value.length > 0)
const canUseMobileInspect = computed(() => hasInspectPanel.value)
const canShareWebm = computed(() => {
  return sourceFiles.value.length > 0
    && !!observedAnimationName.value
    && duration.value > 0
    && !isSharePreview.value
})
const shareStatusText = computed(() => {  
  if (shareError.value) return shareError.value
  if (shareUrl.value && shareExpiresAt.value) {
    return `Share link ready. Expires ${new Date(shareExpiresAt.value).toLocaleString()}.`
  }
  if (shareToken.value && shareManifest.value) {
    return `Shared preview. Expires ${new Date(shareManifest.value.expiresAt).toLocaleString()}.`
  } 
  return '' 
}) 
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}
const getShareFileTypeLabel = (file: File) => {
  if (/\.json$/i.test(file.name)) return 'Skeleton JSON'
  if (/\.atlas$/i.test(file.name)) return 'Atlas'
  if (/\.png$/i.test(file.name)) return 'Texture'
  return 'File'
}
const shareUploadFileSummary = computed(() => sourceFiles.value.map(file => ({
  name: file.name,
  type: getShareFileTypeLabel(file),
  size: formatFileSize(file.size)
})))
const shareUploadExpiryPreview = computed(() => {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return formatShareDate(expiresAt.toISOString())
})
const sortShareHistory = (entries: ShareHistoryEntry[]) => { 
  return [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) 
} 

const getShareHistoryStatus = (item: ShareHistoryEntry) => {
  if (item.revokedAt) return 'revoked'
  if (Date.parse(item.expiresAt) <= Date.now()) return 'expired'
  return 'active'
}

const clearShareHistoryPruneTimer = () => {
  if (shareHistoryPruneTimer === null) return
  window.clearTimeout(shareHistoryPruneTimer)
  shareHistoryPruneTimer = null
}

const pruneShareHistory = () => {
  const nextEntries = sortShareHistory(
    shareHistory.value.filter(item => getShareHistoryStatus(item) === 'active')
  )
  const changed = nextEntries.length !== shareHistory.value.length
  shareHistory.value = nextEntries
  return changed
}

const scheduleShareHistoryPrune = () => {
  clearShareHistoryPruneTimer()

  const nextExpiryAt = shareHistory.value
    .filter(item => !item.revokedAt)
    .map(item => Date.parse(item.expiresAt))
    .filter(expiresAt => Number.isFinite(expiresAt) && expiresAt > Date.now())
    .sort((a, b) => a - b)[0]

  if (!nextExpiryAt) return

  const delay = Math.max(nextExpiryAt - Date.now() + 1000, 1000)
  shareHistoryPruneTimer = window.setTimeout(() => {
    const changed = pruneShareHistory()
    if (changed) {
      persistShareHistory()
    }
    scheduleShareHistoryPrune()
  }, delay)
}

const getShareHistoryStatusLabel = (item: ShareHistoryEntry) => {
  const status = getShareHistoryStatus(item)
  if (status === 'revoked') return 'Revoked'
  if (status === 'expired') return 'Expired'
  return 'Active'
}

const getShareHistoryRevokeLabel = (item: ShareHistoryEntry) => {
  const status = getShareHistoryStatus(item)
  if (status === 'revoked') return 'Revoked'
  if (status === 'expired') return 'Expired'
  return 'Revoke'
}

const isShareHistoryActionAllowed = (item: ShareHistoryEntry) => {
  return getShareHistoryStatus(item) === 'active'
}

const loadShareHistory = () => { 
  try {
    const saved = localStorage.getItem(SHARE_HISTORY_KEY)
    if (!saved) return

    const parsed = JSON.parse(saved) as ShareHistoryEntry[]
    shareHistory.value = sortShareHistory(
      parsed.filter(item => item && typeof item.token === 'string' && typeof item.shareUrl === 'string')
    )
    if (pruneShareHistory()) {
      persistShareHistory()
    }
  } catch {
    shareHistory.value = []
  }
  scheduleShareHistoryPrune()
}

const persistShareHistory = () => {
  if (shareHistory.value.length === 0) {
    localStorage.removeItem(SHARE_HISTORY_KEY)
  } else {
    localStorage.setItem(SHARE_HISTORY_KEY, JSON.stringify(shareHistory.value))
  }
}

const upsertShareHistory = (entry: ShareHistoryEntry) => {
  const nextEntries = shareHistory.value.filter(item => item.token !== entry.token)
  shareHistory.value = sortShareHistory([entry, ...nextEntries])
  pruneShareHistory()
  persistShareHistory()
  scheduleShareHistoryPrune()
}

const markShareHistoryRevoked = (token: string, revokedAt: string) => { 
  shareHistory.value = shareHistory.value
    .map(item => (
      item.token === token
        ? { ...item, revokedAt, revoking: false }
        : item
    ))
  persistShareHistory() 
  scheduleShareHistoryPrune()
} 

const deleteShareHistory = (token: string) => {
  const currentItem = shareHistory.value.find(item => item.token === token)
  const confirmed = window.confirm(
    [
      'Delete this local share history entry?',
      '',
      currentItem ? currentItem.skeletonName : 'This only removes the saved history item from this browser.',
      'It does not revoke a public share link. Use Revoke for active links.'
    ].join('\n')
  )
  if (!confirmed) return
  shareHistory.value = shareHistory.value.filter(item => item.token !== token)
  persistShareHistory()
  scheduleShareHistoryPrune()
}

const getShareHistoryOptionSummary = (item: ShareHistoryEntry) => {
  const parts: string[] = []
  parts.push(item.watermarkEnabled === false ? 'No watermark' : 'Watermark on')
  if (item.clipAnimationName) {
    parts.push(`Only "${item.clipAnimationName}"`)
  } else if (item.defaultAnimationName) {
    parts.push(`Default "${item.defaultAnimationName}"`)
  }
  if (item.defaultSkinName) {
    parts.push(`Skin ${item.defaultSkinName}`)
  }
  return parts.join(' • ')
}

const formatShareDate = (value: string) => { 
  return new Date(value).toLocaleString() 
} 

const copyShareLink = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    window.prompt('Copy share link', url)
  }
}

const openShareLink = (url: string) => {
  window.open(url, '_blank', 'noreferrer')
}

const buildWebmFileName = () => {
  const skeletonName = sourceFiles.value.find(file => /\.(json|skel)$/i.test(file.name))?.name || 'spine-viewer'
  const skeletonBase = skeletonName.replace(/\.[^.]+$/, '')
  const animationBase = (observedAnimationName.value || 'clip').replace(/[^\w.-]+/g, '-')
  return `${skeletonBase}-${animationBase}.webm`
}

const buildDefaultShareTracks = (name: string | null): SpineTrackEntry[] => {
  if (!name) return []
  return [{
    trackIndex: 0,
    animationName: name,
    loop: true,
    mixDuration: 0
  }]
}
const applySharePreviewDefaults = (manifest: ShareManifest) => {
  const defaultAnimationName = manifest.defaults?.animationName || manifest.content?.clipAnimationName || ''
  const defaultSkinName = manifest.defaults?.skinName || ''
  animationName.value = defaultAnimationName
  animationTracks.value = buildDefaultShareTracks(defaultAnimationName)
  currentSkin.value = defaultSkinName
}
const observedTrackState = computed(() => { 
  return trackPlaybackStates.value.find(track => track.trackIndex === overlayTrackIndex.value) || null
})
const observedAnimationName = computed(() => {
  if (observedTrackState.value?.animationName) return observedTrackState.value.animationName
  return animationTracks.value.find(track => track.trackIndex === overlayTrackIndex.value)?.animationName || ''
})
const currentAnimationSummary = computed(() => {
  if (!observedAnimationName.value) return null
  return animationSummaries.value.find(animation => animation.name === observedAnimationName.value) || null
})
const currentAnimationMarkers = computed<SpineAnimationEventMarker[]>(() => {
  return currentAnimationSummary.value?.eventMarkers || []
})
const visibleRuntimeNotifications = computed(() => {
  return runtimeNotifications.value
    .filter(item => item.visible && item.trackIndex === overlayTrackIndex.value)
    .slice(0, 3)
})
const activeShareAnimation = computed(() => {
  return animationTracks.value.find(track => track.trackIndex === 0)?.animationName || animationName.value || animations.value[0] || ''
})
const sharePrimaryAnimationName = computed(() => activeShareAnimation.value || '')
const shareDefaultsSummary = computed(() => {
  const animationLabel = sharePrimaryAnimationName.value || 'First available animation'
  const skinLabel = currentSkin.value || skins.value[0] || 'Setup pose skin'
  return `Animation: ${animationLabel} • Skin: ${skinLabel}`
})
const shareWebmSummary = computed(() => {
  if (!observedAnimationName.value || duration.value <= 0) {
    return 'Choose a playable animation to export a WebM clip.'
  }

  const seconds = duration.value / Math.max(playbackRate.value || 1, 0.01)
  const roundedSeconds = Math.round(seconds * 10) / 10
  return `Clip: ${observedAnimationName.value} · Length: ${roundedSeconds}s · Track: ${overlayTrackIndex.value}`
})
const overlayTrackOptions = computed(() => {
  const indices = new Set<number>()
  animationTracks.value.forEach(track => indices.add(track.trackIndex))
  trackPlaybackStates.value.forEach(track => indices.add(track.trackIndex))

  return [...indices]
    .sort((a, b) => a - b)
    .map(trackIndex => {
      const configuredTrack = animationTracks.value.find(track => track.trackIndex === trackIndex)
      const activeTrack = trackPlaybackStates.value.find(track => track.trackIndex === trackIndex)
      return {
        trackIndex,
        animationName: activeTrack?.animationName || configuredTrack?.animationName || ''
      }
    })
})
const privacyPolicyUrl = `${import.meta.env.BASE_URL}privacy-policy.html`
const termsOfServiceUrl = `${import.meta.env.BASE_URL}terms-of-service.html`

const THEME_KEY = 'spine-viewer-theme'
const RUNTIME_NOTIFICATION_LIMIT = 12
const RUNTIME_NOTIFICATION_DURATION_MS = 500
const RUNTIME_NOTIFICATION_DEDUPE_WINDOW_MS = 600
const EVENT_MARKER_TIME_TOLERANCE = 0.02
const isDark = ref(true)
let runtimeNotificationId = 0
const runtimeNotificationTimers = new Map<number, number>()

const updateViewportState = () => {
  const nextIsMobileViewport = window.innerWidth <= 640 || (window.innerWidth <= 900 && window.innerHeight <= 480)
  if (nextIsMobileViewport !== isMobileViewport.value) {
    isMobileViewport.value = nextIsMobileViewport
    if (!nextIsMobileViewport) {
      mobileSheetState.value = 'half'
    } else {
      mobileSheetState.value = 'half'
    }
  }
}

const handleWindowKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (isShareConfirmOpen.value) {
      closeShareConfirm()
      return
    }
    if (isInfoOpen.value) {
      isInfoOpen.value = false
      return
    }
    if (isMobileViewport.value && mobileSheetState.value !== 'collapsed') {
      mobileSheetState.value = 'collapsed'
    }
  }
}

const setMobileSheetState = (state: 'collapsed' | 'half' | 'full') => {
  if (!isMobileViewport.value) return
  mobileSheetState.value = state
  if (state === 'collapsed') {
    isMobileMoreOpen.value = false
  }
}

const toggleSidebarPanel = (panel: 'load' | 'animate' | 'inspect') => {
  if (isMobileViewport.value) {
    if (panel === 'load') isLoadFilesPanelOpen.value = !isLoadFilesPanelOpen.value
    if (panel === 'animate') isAnimatePanelOpen.value = !isAnimatePanelOpen.value
    if (panel === 'inspect') isInspectPanelOpen.value = !isInspectPanelOpen.value
    return
  }

  const shouldOpen = panel === 'load'
    ? !isLoadFilesPanelOpen.value
    : panel === 'animate'
      ? !isAnimatePanelOpen.value
      : !isInspectPanelOpen.value

  isLoadFilesPanelOpen.value = panel === 'load' && shouldOpen
  isAnimatePanelOpen.value = panel === 'animate' && shouldOpen
  isInspectPanelOpen.value = panel === 'inspect' && shouldOpen
}

const openMobilePanel = (panel: 'load' | 'animate' | 'inspect') => {
  if (!isMobileViewport.value) return
  if (panel === 'animate' && !canUseMobileAnimate.value) return
  if (panel === 'inspect' && !canUseMobileInspect.value) return
  activeMobilePanel.value = panel
  if (mobileSheetState.value === 'collapsed') {
    mobileSheetState.value = 'half'
  }
}

const handleCanvasTap = () => {
  if (!isMobileViewport.value || mobileSheetState.value === 'collapsed') return
  setMobileSheetState('collapsed')
}

const toggleMobileSheetSize = () => {
  if (!isMobileViewport.value) return
  mobileSheetState.value = mobileSheetState.value === 'full' ? 'half' : 'full'
  isMobileMoreOpen.value = false
}

const openShareConfirm = () => {
  if (!canShare.value) return
  shareError.value = ''
  isShareConfirmOpen.value = true
}

const closeShareConfirm = () => {
  if (isSharing.value) return
  isShareConfirmOpen.value = false
}

const openInfoFromMobileMore = () => {
  isMobileMoreOpen.value = false
  isInfoOpen.value = true
}

watch(isShareConfirmOpen, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  shareConfirmCloseRef.value?.focus()
})

watch([canUseMobileAnimate, canUseMobileInspect], ([canAnimate, canInspect]) => {
  if (!isMobileViewport.value) return
  if (activeMobilePanel.value === 'animate' && !canAnimate) {
    activeMobilePanel.value = 'load'
  }
  if (activeMobilePanel.value === 'inspect' && !canInspect) {
    activeMobilePanel.value = 'load'
  }
})

watch(() => sourceFiles.value.length, (fileCount) => {
  if (!isMobileViewport.value || fileCount > 0) return
  activeMobilePanel.value = 'load'
  mobileSheetState.value = 'half'
}, { immediate: true })

const applyTheme = (dark: boolean) => {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  applyTheme(isDark.value)
}

const resetViewerState = () => {
  animations.value = []
  animationName.value = ''
  animationTracks.value = []
  overlayTrackIndex.value = 0
  skins.value = []
  currentSkin.value = ''
  animationSummaries.value = []
  structure.value = { bones: [], slots: [], totalBones: 0 }
  selection.value = { boneName: null, slotName: null }
  currentTime.value = 0
  duration.value = 0
  drawCall.value = 0
  trackPlaybackStates.value = []
  detectedVersion.value = null
  runtimeVersion.value = null
  initialRuntimeVersion.value = null
  fallbackUsed.value = false
  shareWebmStatus.value = ''
  clearRuntimeNotifications()
}

const loadSharedSession = async (token: string) => {
  shareError.value = ''
  shareUrl.value = ''
  shareExpiresAt.value = ''
  shareToken.value = token
  resetViewerState()

  try {
    const manifest = await fetchShareManifest(token)
    const sharedFiles = await fetchSharedSourceFiles(token, manifest)
    shareManifest.value = manifest
    applySharePreviewDefaults(manifest)
    sourceFiles.value = [
      sharedFiles.skeletonFile,
      sharedFiles.atlasFile,
      ...sharedFiles.textureFiles
    ]
    isLoadFilesPanelOpen.value = false
    mobileSheetState.value = 'collapsed'
  } catch (error) { 
    shareManifest.value = null 
    shareError.value = error instanceof Error ? normalizeShareErrorMessage(error.message) : 'Failed to load shared assets' 
  } 
} 

const handleExitSharePreview = () => {
  shareManifest.value = null
  shareToken.value = ''
  shareUrl.value = ''
  shareExpiresAt.value = ''
  shareError.value = ''
  sourceFiles.value = []
  mobileSheetState.value = 'half'
  resetViewerState()
  window.history.replaceState({}, '', '/')
}

onMounted(() => { 
  loadShareHistory()
  const saved = localStorage.getItem(THEME_KEY) 
  if (saved) {
    isDark.value = saved === 'dark'
  } else {
    isDark.value = !window.matchMedia('(prefers-color-scheme: light)').matches
  }
  updateViewportState()
  applyTheme(isDark.value)
  window.addEventListener('keydown', handleWindowKeydown)
  window.addEventListener('resize', updateViewportState)

  const initialShareToken = extractShareTokenFromPath(window.location.pathname)
  if (initialShareToken) {
    void loadSharedSession(initialShareToken)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  window.removeEventListener('resize', updateViewportState)
  runtimeNotificationTimers.forEach(timeoutId => window.clearTimeout(timeoutId))
  runtimeNotificationTimers.clear()
  clearShareHistoryPruneTimer()
})

const handleFileSelected = (payload: { files: File[] }) => {
  sourceFiles.value = payload.files
  shareManifest.value = null
  shareToken.value = ''
  shareUrl.value = ''
  shareExpiresAt.value = ''
  shareError.value = ''
  resetViewerState()
  if (!isMobileViewport.value) {
    isLoadFilesPanelOpen.value = true
    isAnimatePanelOpen.value = false
    isInspectPanelOpen.value = false
  }
  mobileSheetState.value = isMobileViewport.value ? 'half' : mobileSheetState.value
}

const clearRuntimeNotifications = () => {
  runtimeNotificationTimers.forEach(timeoutId => window.clearTimeout(timeoutId))
  runtimeNotificationTimers.clear()
  runtimeNotifications.value = []
}

const normalizeTracks = (tracks: SpineTrackEntry[]) => {
  return tracks
    .filter(track => Number.isInteger(track.trackIndex) && track.trackIndex >= 0)
    .map(track => ({
      trackIndex: track.trackIndex,
      animationName: track.animationName || '',
      loop: track.loop !== false,
      mixDuration: Math.max(0, track.mixDuration || 0)
    }))
    .sort((a, b) => a.trackIndex - b.trackIndex)
    .map((track, index) => ({
      ...track,
      trackIndex: index
    }))
}

const syncPrimaryTrackState = (tracks: SpineTrackEntry[]) => {
  const primaryTrack = tracks.find(track => !!track.animationName)
  animationName.value = primaryTrack?.animationName || ''
  currentTime.value = 0
  duration.value = primaryTrack?.animationName
    ? (animationSummaries.value.find(animation => animation.name === primaryTrack.animationName)?.duration || duration.value)
    : 0
  clearRuntimeNotifications()
}

const handleTracksChange = (tracks: SpineTrackEntry[]) => {
  const normalizedTracks = normalizeTracks(tracks)
  animationTracks.value = normalizedTracks
  if (!normalizedTracks.some(track => track.trackIndex === overlayTrackIndex.value)) {
    overlayTrackIndex.value = normalizedTracks[0]?.trackIndex || 0
  }
  syncPrimaryTrackState(normalizedTracks)
}

const handleShareAnimationChange = (name: string) => {
  if (!name) return

  const primaryTrack = animationTracks.value.find(track => track.trackIndex === 0)
  const nextTracks: SpineTrackEntry[] = primaryTrack
    ? animationTracks.value.map(track => (
      track.trackIndex === 0
        ? { ...track, animationName: name }
        : track
    ))
    : [{ trackIndex: 0, animationName: name, loop: true, mixDuration: 0 }]

  handleTracksChange(nextTracks)
}

const handleSkinChange = (name: string) => {
  currentSkin.value = name
}

const handlePlaybackChange = (playing: boolean) => {
  isPlaying.value = playing
}

const handleSpeedChange = (speed: number) => {
  playbackRate.value = speed
}

const handleSeek = (time: number) => {
  currentTime.value = time
  spineCanvasRef.value?.seekTo(time, overlayTrackIndex.value)
}

const handleOverlayTrackChange = (trackIndex: number) => {
  overlayTrackIndex.value = trackIndex
  const trackState = trackPlaybackStates.value.find(track => track.trackIndex === trackIndex)
  currentTime.value = trackState?.currentTime || 0
  duration.value = trackState?.duration || 0
  clearRuntimeNotifications()
}

const handleDebugOptionChange = (key: keyof SpineDebugOptions, value: boolean) => {
  debugOptions.value = {
    ...debugOptions.value,
    [key]: value
  }
}

const handlePremultipliedAlphaChange = (value: boolean) => {
  premultipliedAlpha.value = value
}

const handleTextureFilteringChange = (value: SpineTextureFiltering) => {
  textureFiltering.value = value
}

const handleBoneSelected = (boneName: string) => {
  selection.value = {
    boneName,
    slotName: null
  }
}

const handleSlotSelected = (slotName: string, boneName: string) => {
  selection.value = {
    boneName,
    slotName
  }
}

const handleLoaded = (data: {
  animations: string[]
  animationSummaries: SpineAnimationSummary[]
  skins: string[]
  currentSkin: string
  skeletonName: string
  drawCall: number
  duration: number
  structure: SpineSkeletonStructure
  detectedVersion: SpineDetectedVersion
  initialRuntimeVersion: SpineMajorVersion
  runtimeVersion: SpineMajorVersion
  fallbackUsed: boolean
}) => {
  animations.value = data.animations
  skins.value = data.skins
  currentSkin.value = currentSkin.value && data.skins.includes(currentSkin.value)
    ? currentSkin.value
    : data.currentSkin
  animationSummaries.value = data.animationSummaries
  structure.value = data.structure
  selection.value = { boneName: null, slotName: null }
  clearRuntimeNotifications()
  if (data.animations.length > 0) {
    const preferredAnimationName = animationTracks.value.find(track => track.trackIndex === 0)?.animationName || animationName.value
    const initialTrack = {
      trackIndex: 0,
      animationName: preferredAnimationName && data.animations.includes(preferredAnimationName)
        ? preferredAnimationName
        : data.animations[0],
      loop: true,
      mixDuration: 0
    }
    animationTracks.value = [initialTrack]
    overlayTrackIndex.value = 0
    animationName.value = initialTrack.animationName
  } else {
    animationTracks.value = []
    overlayTrackIndex.value = 0
    animationName.value = ''
  }
  duration.value = data.duration || data.animationSummaries[0]?.duration || 2.5
  drawCall.value = data.drawCall
  currentTime.value = 0
  trackPlaybackStates.value = []
  detectedVersion.value = data.detectedVersion
  initialRuntimeVersion.value = data.initialRuntimeVersion
  runtimeVersion.value = data.runtimeVersion
  fallbackUsed.value = data.fallbackUsed
  if (!isMobileViewport.value) {
    isLoadFilesPanelOpen.value = false
    isAnimatePanelOpen.value = data.animations.length > 0
    isInspectPanelOpen.value = data.animations.length === 0
  }
}

const handleTimeUpdate = (state: {
  currentTime: number
  duration: number
  drawCall: number
  tracks: SpineTrackPlaybackState[]
}) => {
  trackPlaybackStates.value = state.tracks
  const observedState = state.tracks.find(track => track.trackIndex === overlayTrackIndex.value)
  currentTime.value = observedState?.currentTime ?? state.currentTime
  duration.value = observedState?.duration ?? state.duration ?? duration.value
  drawCall.value = state.drawCall
}

const hideRuntimeNotification = (notificationId: number) => {
  runtimeNotificationTimers.delete(notificationId)
  runtimeNotifications.value = runtimeNotifications.value.map(item => (
    item.id === notificationId
      ? { ...item, visible: false }
      : item
  ))
}

const patchMarkerEventNameFromRuntime = (payload: SpineAnimationEventPayload) => {
  const eventName = payload.eventName?.trim()
  const eventTime = payload.trackTime
  const targetAnimationName = payload.animationName || animationName.value

  if (!eventName || typeof eventTime !== 'number' || !targetAnimationName) return

  animationSummaries.value = animationSummaries.value.map(summary => {
    if (summary.name !== targetAnimationName) return summary

    let changed = false
    const nextMarkers = summary.eventMarkers.map(marker => {
      if (Math.abs(marker.time - eventTime) >= EVENT_MARKER_TIME_TOLERANCE) {
        return marker
      }

      const unnamedEventIndex = marker.events.findIndex(event => {
        const currentName = event.eventName?.trim() || ''
        return !currentName || currentName === 'Unnamed event'
      })

      if (unnamedEventIndex === -1) return marker

      const nextEvents = marker.events.map((event, index) => {
        if (index !== unnamedEventIndex) return event

        return {
          ...event,
          eventName
        }
      })

      changed = true
      return {
        ...marker,
        events: nextEvents
      }
    })

    if (!changed) return summary

    return {
      ...summary,
      eventMarkers: nextMarkers
    }
  })
}

const handleRuntimeEvent = (payload: SpineAnimationEventPayload) => {
  if (payload.type !== 'event') return

  patchMarkerEventNameFromRuntime(payload)

  const now = new Date()
  const previousItem = runtimeNotifications.value[0]
  const sameAsPrevious = previousItem
    && previousItem.eventName === (payload.eventName || 'Unnamed event')
    && previousItem.animationName === payload.animationName
    && previousItem.trackIndex === payload.trackIndex
    && previousItem.trackTime !== null
    && payload.trackTime !== null
    && Math.abs(previousItem.trackTime - payload.trackTime) < 0.001
    && (now.getTime() - new Date(previousItem.receivedAt).getTime()) <= RUNTIME_NOTIFICATION_DEDUPE_WINDOW_MS

  if (sameAsPrevious) {
    const timerId = runtimeNotificationTimers.get(previousItem.id)
    if (timerId !== undefined) {
      window.clearTimeout(timerId)
    }

    runtimeNotifications.value = runtimeNotifications.value.map(item => (
      item.id === previousItem.id
        ? {
            ...item,
            count: item.count + 1,
            receivedAt: now.toISOString(),
            visible: true
          }
        : item
    ))

    const timeoutId = window.setTimeout(() => hideRuntimeNotification(previousItem.id), RUNTIME_NOTIFICATION_DURATION_MS)
    runtimeNotificationTimers.set(previousItem.id, timeoutId)
    return
  }

  const id = ++runtimeNotificationId
  const nextItem: RuntimeNotificationRecord = {
    id,
    eventName: payload.eventName || 'Unnamed event',
    animationName: payload.animationName,
    trackIndex: payload.trackIndex,
    trackTime: payload.trackTime,
    receivedAt: now.toISOString(),
    visible: true,
    count: 1
  }

  runtimeNotifications.value = [nextItem, ...runtimeNotifications.value]
    .slice(0, RUNTIME_NOTIFICATION_LIMIT)

  const timeoutId = window.setTimeout(() => hideRuntimeNotification(id), RUNTIME_NOTIFICATION_DURATION_MS)
  runtimeNotificationTimers.set(id, timeoutId)

  const removedIds = [...runtimeNotificationTimers.keys()].filter(activeId => !runtimeNotifications.value.some(item => item.id === activeId))
  removedIds.forEach(removedId => {
    const timerId = runtimeNotificationTimers.get(removedId)
    if (timerId !== undefined) {
      window.clearTimeout(timerId)
      runtimeNotificationTimers.delete(removedId)
    }
  })
}

const handleError = (error: string) => {
  console.error('Spine Canvas Error:', error)
}

const classifyShareCreateError = (error: unknown) => {
  const rawMessage = error instanceof Error ? error.message : 'Failed to create share link'
  const normalized = normalizeShareErrorMessage(rawMessage)
  const lower = normalized.toLowerCase()

  if (lower.includes('network') || lower.includes('fetch')) {
    return `Network error: ${normalized}`
  }
  if (lower.includes('texture') || lower.includes('canvas') || lower.includes('webp')) {
    return `File processing error: ${normalized}`
  }
  if (lower.includes('upload') || lower.includes('storage')) {
    return `Upload error: ${normalized}`
  }
  if (lower.includes('expired')) {
    return `Expired link: ${normalized}`
  }
  if (lower.includes('revoked')) {
    return `Revoked link: ${normalized}`
  }
  return normalized
}

const executeCreateShare = async () => {
  if (!canShare.value || isSharing.value) return

  shareError.value = ''
  shareUrl.value = ''
  shareExpiresAt.value = ''
  isSharing.value = true

  try { 
    const prepared = await prepareShareUpload(classifySpineFiles(sourceFiles.value), {
      watermarkEnabled: shareWatermarkEnabled.value,
      clipAnimationName: shareClipCurrentAnimation.value ? sharePrimaryAnimationName.value : null,
      defaultAnimationName: sharePrimaryAnimationName.value || null,
      defaultSkinName: currentSkin.value || skins.value[0] || null
    }) 
    const result = await createShareLink(prepared) 
    upsertShareHistory({
      token: result.token,
      shareUrl: result.shareUrl,
      createdAt: prepared.manifest.createdAt,
      expiresAt: result.expiresAt,
      revokedAt: null,
      skeletonName: prepared.manifest.files.skeleton.name,
      atlasName: prepared.manifest.files.atlas.name,
      watermarkLabel: prepared.manifest.watermark.label || '',
      watermarkEnabled: prepared.manifest.watermark.enabled,
      clipAnimationName: prepared.manifest.content?.clipAnimationName || null,
      defaultAnimationName: prepared.manifest.defaults?.animationName || null,
      defaultSkinName: prepared.manifest.defaults?.skinName || null
    })
    shareUrl.value = result.shareUrl 
    shareExpiresAt.value = result.expiresAt 
    isShareConfirmOpen.value = false
    try {
      await navigator.clipboard?.writeText(result.shareUrl)
    } catch {
      // The visible link remains available if clipboard access is denied.
    }
  } catch (error) { 
    shareError.value = classifyShareCreateError(error) 
  } finally { 
    isSharing.value = false 
  } 
} 

const handleShareWebm = async () => {
  if (!canShareWebm.value || isSharingWebm.value) return

  const canvas = spineCanvasRef.value?.getCanvasElement?.()
  if (!canvas) {
    shareWebmStatus.value = 'WebM export is unavailable because the canvas is not ready.'
    return
  }

  const clipDurationMs = Math.ceil((duration.value / Math.max(playbackRate.value || 1, 0.01)) * 1000)
  if (!Number.isFinite(clipDurationMs) || clipDurationMs <= 0) {
    shareWebmStatus.value = 'WebM export requires a valid animation duration.'
    return
  }

  const previousTime = currentTime.value
  const previousPlaying = isPlaying.value
  isSharingWebm.value = true
  shareWebmStatus.value = 'Recording WebM...'

  try {
    spineCanvasRef.value?.seekTo(0, overlayTrackIndex.value)
    isPlaying.value = true
    await nextTick()

    const file = await recordCanvasToWebm({
      canvas,
      durationMs: clipDurationMs + 180,
      fileName: buildWebmFileName()
    })
    await downloadWebm(file)
    shareWebmStatus.value = `WebM downloaded: ${file.name}`
  } catch (error) {
    shareWebmStatus.value = error instanceof Error ? error.message : 'Failed to export WebM'
  } finally {
    spineCanvasRef.value?.seekTo(previousTime, overlayTrackIndex.value)
    isPlaying.value = previousPlaying
    isSharingWebm.value = false
  }
}

const handleRevokeShare = async (token: string) => { 
  const currentItem = shareHistory.value.find(item => item.token === token) 
  if (!currentItem || getShareHistoryStatus(currentItem) !== 'active') return

  const confirmed = window.confirm(
    [
      'Revoke this public share link?',
      '',
      currentItem.skeletonName,
      'People with the link will no longer be able to open this preview. This is different from deleting local history.'
    ].join('\n')
  )
  if (!confirmed) return

  shareHistory.value = shareHistory.value.map(item => (
    item.token === token
      ? { ...item, revoking: true }
      : item
  ))

  try {
    const result = await revokeShareLink(token)
    markShareHistoryRevoked(token, result.revokedAt)
    if (shareToken.value === token) {
      shareError.value = 'Share link revoked'
    }
  } catch (error) {
    shareHistory.value = shareHistory.value.map(item => (
      item.token === token
        ? { ...item, revoking: false }
        : item
    ))
    shareError.value = error instanceof Error ? normalizeShareErrorMessage(error.message) : 'Failed to revoke share link'
  }
}
</script>

<style>
:root {
  /* Dark theme (default) */
  --bg-base:      #0c0b0a;
  --bg-panel:     #131110;
  --bg-surface:   #1c1917;
  --bg-raised:    #242018;
  --border:       #2e2720;
  --border-muted: #1f1c17;
  --border-glow:  rgba(201, 141, 42, 0.35);
  --bg-overlay:   rgba(13, 11, 10, 0.92);

  --text-primary:   #f5ede0;
  --text-secondary: #c2ae98;
  --text-muted:     #8a7e72;

  --accent:       #c98d2a;
  --accent-dim:   rgba(201, 141, 42, 0.12);
  --accent-glow:  rgba(201, 141, 42, 0.25);
  --success:      #5fad82;
  --info:         #5b96d4;
  --danger:       #c46b5a;
  --event-highlight-fill:       #ffe27a;
  --event-highlight-border:     rgba(55, 39, 6, 0.95);
  --event-highlight-ring:       rgba(255, 226, 122, 0.24);
  --event-highlight-glow:       rgba(255, 226, 122, 0.78);
  --event-highlight-glow-wide:  rgba(255, 226, 122, 0.4);
  --tooltip-bg: rgba(11, 14, 18, 0.94);
  --tooltip-border: rgba(91, 150, 212, 0.36);
  --tooltip-text: #f5ede0;
  --tooltip-muted: #8fc0f1;

  --font-ui:   'Syne', 'Noto Sans TC', sans-serif;
  --font-mono: 'DM Mono', 'Noto Sans TC', monospace;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 14px;
  --transition: 0.15s ease;
  --mobile-bottom-nav-height: 64px;
  --mobile-bottom-nav-gap: 10px;
  --mobile-bottom-nav-bottom: max(12px, env(safe-area-inset-bottom));
}

:root[data-theme="light"] {
  --bg-base:      #f5f0e8;
  --bg-panel:     #ede7db;
  --bg-surface:   #e4ddd1;
  --bg-raised:    #d8d0c3;
  --border:       #c5bdb0;
  --border-muted: #d4ccbf;
  --border-glow:  rgba(160, 100, 14, 0.45);
  --bg-overlay:   rgba(232, 225, 212, 0.95);

  --text-primary:   #1c1610;
  --text-secondary: #4a4038;
  --text-muted:     #7a7060;

  --accent:       #a06c10;
  --accent-dim:   rgba(160, 108, 16, 0.1);
  --accent-glow:  rgba(160, 108, 16, 0.22);
  --success:      #2e8a56;
  --info:         #2e6cb8;
  --danger:       #b04030;
  --event-highlight-fill:       #c97700;
  --event-highlight-border:     rgba(255, 248, 235, 0.95);
  --event-highlight-ring:       rgba(201, 119, 0, 0.28);
  --event-highlight-glow:       rgba(173, 95, 0, 0.88);
  --event-highlight-glow-wide:  rgba(173, 95, 0, 0.45);
  --tooltip-bg: rgba(248, 242, 233, 0.98);
  --tooltip-border: rgba(46, 108, 184, 0.3);
  --tooltip-text: #1c1610;
  --tooltip-muted: #2e6cb8;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: var(--font-ui);
}

button,
a,
input,
select {
  -webkit-tap-highlight-color: transparent;
}

.spine-viewer {
  display: flex;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  background: var(--bg-base);
  color: var(--text-primary);
}

.sidebar {
  width: 272px;
  min-width: 272px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-panel);
}

.sidebar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.sidebar-content::-webkit-scrollbar { width: 4px; }
.sidebar-content::-webkit-scrollbar-track { background: transparent; }
.sidebar-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.sidebar-footer {
  margin-top: auto;
  padding: 14px 16px 18px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  z-index: 1;
  background: var(--bg-panel);
  box-shadow: 0 -8px 20px rgba(0, 0, 0, 0.16);
}

.sidebar-link {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--transition);
}

.sidebar-link:hover {
  color: var(--accent);
}

.sidebar-link-button {
  justify-content: flex-start;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.sidebar-link-button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.sidebar-status {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}

.sidebar-status.error { 
  color: var(--danger); 
} 

.share-error-banner {
  margin: 12px 14px 0;
  padding: 10px 10px 11px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(196, 107, 90, 0.32);
  background: rgba(196, 107, 90, 0.08);
}

.share-error-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--danger);
}

.share-error-copy {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.sidebar-brand { 
  display: flex; 
  align-items: center;
  gap: 10px;
  padding: 18px 16px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-brand-copy {
  flex: 1;
  min-width: 0;
}

.brand-title {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.brand-spine {
  font-family: var(--font-ui);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--accent);
}

.brand-viewer {
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.28em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.brand-version {
  display: inline-block;
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--transition), border-color var(--transition), background var(--transition);
}

.theme-toggle:hover {
  color: var(--accent);
  border-color: var(--border-glow);
  background: var(--accent-dim);
}

.sidebar-panel {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border);
}

.sidebar-panel-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 16px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color var(--transition), background var(--transition);
  flex-shrink: 0;
}

.sidebar-panel-header:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.02);
}


.sidebar-panel-header--static {
  cursor: default;
}

.sidebar-panel-header--static:hover {
  color: var(--text-secondary);
  background: transparent;
}

.panel-chevron {
  color: var(--text-muted);
  transition: transform var(--transition), color var(--transition);
  flex-shrink: 0;
}

.panel-chevron.open {
  transform: rotate(180deg);
  color: var(--accent);
}

.sidebar-panel-body {
  overflow: visible;
}

.inspect-subsection {
  margin: 0 14px 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-muted);
}

.inspect-subsection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.inspect-subsection-title {
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.share-panel-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 14px 16px;
}

.share-config-card {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.share-config-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-primary);
}

.share-config-copy {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.share-option-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.share-option-row.disabled {
  opacity: 0.55;
}

.share-option-copy {
  display: grid;
  gap: 4px;
}

.share-option-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.share-option-hint {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}

.share-option-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.share-option-checkbox {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.share-option-track {
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  padding: 2px;
  transition: background var(--transition), border-color var(--transition), opacity var(--transition);
}

.share-option-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: transform var(--transition), background var(--transition);
}

.share-option-checkbox:checked + .share-option-track {
  background: var(--accent-dim);
  border-color: var(--accent);
}

.share-option-checkbox:checked + .share-option-track .share-option-thumb {
  transform: translateX(14px);
  background: var(--accent);
}

.share-option-checkbox:disabled + .share-option-track {
  opacity: 0.5;
}

.share-defaults-summary {
  display: grid;
  gap: 4px;
  padding-top: 2px;
  border-top: 1px solid var(--border);
}

.share-defaults-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.share-defaults-value {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.share-primary-btn {
  min-height: 38px;
  padding: 9px 12px;
  border: 1px solid var(--border-glow);
  border-radius: var(--radius-md);
  background: var(--accent-dim);
  color: var(--accent);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition), color var(--transition), opacity var(--transition);
}

.share-primary-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-glow);
}

.share-primary-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.share-export-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-surface) 74%, transparent);
}

.share-export-copy {
  display: grid;
  gap: 4px;
}

.share-export-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.share-export-hint {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}

.share-export-status {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}

.share-secondary-btn {
  min-height: 36px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: border-color var(--transition), color var(--transition), background var(--transition), opacity var(--transition);
}

.share-secondary-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

.share-secondary-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.share-preview-summary {
  display: grid;
  gap: 6px;
  padding: 12px 14px 14px;
}

.share-preview-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text-primary);
  word-break: break-word;
}

.share-preview-copy {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.share-preview-controls {
  display: grid;
  gap: 10px;
  padding: 0 14px 14px;
}

.share-preview-field {
  display: grid;
  gap: 6px;
}

.share-preview-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.share-preview-select-wrap {
  position: relative;
}

.share-preview-select {
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 12px;
  appearance: none;
}

.share-preview-select:focus {
  outline: none;
  border-color: var(--accent);
}

.share-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inspect-subsection--share-history .share-history-list {
  padding: 0;
}

.share-history-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.share-history-item--revoked,
.share-history-item--expired {
  opacity: 0.65;
}

.share-history-item--expired {
  border-color: rgba(91, 150, 212, 0.28);
}

.share-history-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.share-history-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.share-history-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-history-subtitle {
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.45;
  color: var(--text-muted);
}

.share-history-status {
  flex-shrink: 0;
  padding: 3px 7px;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid var(--border);
  background: var(--bg-raised);
}

.share-history-status--active {
  color: var(--success);
  border-color: rgba(95, 173, 130, 0.35);
}

.share-history-status--revoked {
  color: var(--danger);
  border-color: rgba(180, 64, 48, 0.35);
}

.share-history-status--expired {
  color: var(--info);
  border-color: rgba(46, 108, 184, 0.35);
}

.share-history-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mini-action-btn {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: border-color var(--transition), color var(--transition), background var(--transition), opacity var(--transition);
}

.mini-action-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

.mini-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mini-action-btn.danger:hover:not(:disabled) {
  border-color: var(--danger);
  color: var(--danger);
  background: rgba(196, 107, 90, 0.08);
}

.mini-action-btn.danger {
  color: var(--danger);
}

.mini-action-btn:disabled {
  color: var(--text-muted);
}

.main-content {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.empty-load-state {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 12;
  display: grid;
  justify-items: center;
  gap: 14px;
  width: min(100% - 40px, 360px);
  transform: translate(-50%, -50%);
  text-align: center;
}

.empty-load-state__eyebrow {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--accent);
}

.empty-load-state__title {
  margin: 0;
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 22px;
  line-height: 1.2;
}

.empty-load-state__copy {
  margin: 0;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 13px;
}

.empty-load-state__arrow {
  color: var(--accent);
  animation: empty-load-arrow 1.6s ease-in-out infinite;
}

@keyframes empty-load-arrow {
  50% { transform: translateX(-7px); }
}

.sidebar-panel--empty-state-focus {
  position: relative;
  box-shadow: inset 3px 0 0 var(--accent);
}

.sidebar-panel-header-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sidebar-panel-start-hint {
  padding: 3px 6px;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: var(--radius-sm);
  background: var(--accent-dim);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.mobile-bottom-nav,
.mobile-floating-share {
  display: none;
}

.share-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(7, 6, 5, 0.72);
  backdrop-filter: blur(6px);
}

.share-confirm-modal {
  width: min(100%, 560px);
  max-height: min(720px, calc(100dvh - 40px));
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.share-confirm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--border);
}

.share-confirm-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

.share-confirm-title {
  margin-top: 6px;
  font-size: 20px;
  color: var(--text-primary);
}

.share-confirm-body {
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 14px;
  padding: 18px;
}

.share-confirm-copy {
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-secondary);
}

.share-confirm-section {
  display: grid;
  gap: 8px;
}

.share-confirm-section-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.share-confirm-file-list {
  display: grid;
  gap: 7px;
}

.share-confirm-file,
.share-confirm-detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
}

.share-confirm-file-name,
.share-confirm-detail-row strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 12px;
}

.share-confirm-file-meta,
.share-confirm-detail-row span {
  flex-shrink: 0;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
}

.share-confirm-error {
  padding: 10px;
  border: 1px solid rgba(196, 107, 90, 0.28);
  border-radius: var(--radius-md);
  background: rgba(196, 107, 90, 0.08);
  color: var(--danger);
  font-size: 12px;
  line-height: 1.5;
}

.share-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px 18px;
  border-top: 1px solid var(--border);
}

.info-modal-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(7, 6, 5, 0.68);
  backdrop-filter: blur(4px);
  z-index: 1200;
}

.info-modal {
  width: min(100%, 460px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.info-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--border);
}

.info-modal-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

.info-modal-title {
  margin-top: 6px;
  font-size: 20px;
  color: var(--text-primary);
}

.info-modal-close {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: color var(--transition), border-color var(--transition), background var(--transition);
}

.info-modal-close:hover {
  color: var(--accent);
  border-color: var(--border-glow);
  background: var(--accent-dim);
}

.info-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
}

.info-modal-copy {
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .main-content {
    min-height: 0;
  }
}

@media (max-width: 640px), (max-width: 900px) and (max-height: 480px) {
  .spine-viewer {
    flex-direction: column;
    min-height: 100dvh;
  }

  .sidebar {
    width: auto;
    min-width: 0;
  }

  .sidebar--mobile-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--mobile-bottom-nav-height) + var(--mobile-bottom-nav-gap) + var(--mobile-bottom-nav-bottom));
    z-index: 28;
    height: min(58dvh, 520px);
    border-right: 0;
    border-top: 1px solid var(--border);
    border-bottom: 0;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -18px 48px rgba(0, 0, 0, 0.42);
    transition: height var(--transition), transform var(--transition);
  }

  .sidebar--mobile-full {
    height: calc(100dvh - var(--mobile-bottom-nav-height) - var(--mobile-bottom-nav-gap) - var(--mobile-bottom-nav-bottom));
  }

  .sidebar--mobile-collapsed {
    transform: translateY(calc(100% + var(--mobile-bottom-nav-height)));
    pointer-events: none;
  }

  .sidebar--mobile-panel-load .sidebar-panel:not(.sidebar-panel--load),
  .sidebar--mobile-panel-animate .sidebar-panel:not(.sidebar-panel--animate),
  .sidebar--mobile-panel-inspect .sidebar-panel:not(.sidebar-panel--inspect) {
    display: none;
  }

  .sidebar--mobile-sheet .sidebar-panel--share {
    display: none;
  }

  .sidebar-brand {
    position: relative;
    padding: 18px 14px 12px;
  }

  .mobile-sheet-grabber {
    position: absolute;
    top: 7px;
    left: 50%;
    width: 42px;
    height: 4px;
    border-radius: 999px;
    background: var(--border);
    transform: translateX(-50%);
  }

  .mobile-sheet-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .mobile-more-wrap {
    position: relative;
  }

  .mobile-sheet-icon-btn {
    min-height: 34px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 10px;
    cursor: pointer;
  }

  .mobile-sheet-icon-btn {
    width: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-more-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 36;
    width: 180px;
    display: grid;
    gap: 4px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-panel);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.36);
  }

  .mobile-more-item {
    display: flex;
    align-items: center;
    min-height: 38px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font-ui);
    font-size: 12px;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .mobile-more-item:hover,
  .mobile-more-item:focus-visible {
    outline: none;
    background: var(--accent-dim);
    color: var(--accent);
  }

  .brand-spine {
    font-size: 15px;
  }

  .brand-viewer {
    font-size: 9px;
    letter-spacing: 0.22em;
  }

  .sidebar-panel-header {
    padding: 10px 14px;
  }

  .inspect-subsection {
    margin: 0 12px 12px;
    padding-top: 12px;
  }

  .share-panel-body {
    padding: 12px;
  }

  .share-error-banner {
    margin: 0;
  }

  .main-content {
    display: flex;
    flex: 1;
    min-height: 0;
    padding-bottom: calc(var(--mobile-bottom-nav-height) + var(--mobile-bottom-nav-gap) + var(--mobile-bottom-nav-bottom));
  }

  .empty-load-state {
    top: 22%;
    width: min(100% - 32px, 300px);
    gap: 10px;
  }

  .empty-load-state__title {
    font-size: 18px;
  }

  .empty-load-state__arrow--mobile {
    transform: rotate(-90deg);
    animation-name: empty-load-arrow-mobile;
  }

  @keyframes empty-load-arrow-mobile {
    50% { transform: translateY(7px) rotate(-90deg); }
  }

  .mobile-bottom-nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: var(--mobile-bottom-nav-bottom);
    z-index: 32;
    gap: 6px;
    min-height: var(--mobile-bottom-nav-height);
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--bg-panel) 92%, transparent);
    box-shadow: 0 16px 32px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(16px);
  }

  .mobile-nav-btn {
    position: relative;
    isolation: isolate;
    min-height: 46px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    transition: color var(--transition), background-color var(--transition), border-color var(--transition), box-shadow var(--transition);
  }

  .mobile-nav-btn--active::before {
    position: absolute;
    inset: 0;
    z-index: -1;
    box-sizing: border-box;
    border: 1px solid var(--border-glow);
    border-radius: inherit;
    background: color-mix(in srgb, var(--accent-dim) 86%, var(--bg-raised));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent);
    content: '';
  }

  .mobile-nav-btn--active {
    color: var(--accent);
  }

  .mobile-nav-btn:not(:disabled):active::before {
    background: color-mix(in srgb, var(--accent-dim) 72%, var(--bg-raised));
  }

  .mobile-nav-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -3px;
  }

  .mobile-nav-btn:disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }

  .mobile-floating-share {
    display: inline-flex;
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: 12px;
    z-index: 20;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--border-glow);
    border-radius: 999px;
    background: var(--bg-overlay);
    color: var(--accent);
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    backdrop-filter: blur(14px);
  }

  .mobile-floating-share:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .sidebar--share-preview .sidebar-brand {
    padding-bottom: 10px;
  }

  .sidebar--share-preview .sidebar-content {
    max-height: none;
  }

  .sidebar--share-preview .sidebar-panel {
    border-bottom: 0;
  }

  .sidebar--share-preview .sidebar-panel-header {
    padding-bottom: 8px;
  }

  .sidebar--share-preview .share-preview-summary {
    gap: 4px;
    padding: 0 14px 12px;
  }

  .sidebar--share-preview .share-preview-title {
    font-size: 12px;
    line-height: 1.4;
  }

  .sidebar--share-preview .share-preview-copy {
    font-size: 11px;
  }

  .share-confirm-backdrop {
    align-items: stretch;
    padding: 0;
  }

  .share-confirm-modal {
    width: 100%;
    max-height: none;
    min-height: 100dvh;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
  }

  .share-confirm-header {
    padding-top: max(18px, env(safe-area-inset-top));
  }

  .share-confirm-actions {
    padding-bottom: max(18px, env(safe-area-inset-bottom));
  }

  .share-confirm-actions .share-secondary-btn,
  .share-confirm-actions .share-primary-btn {
    min-height: 44px;
    flex: 1;
  }

  .share-confirm-detail-row {
    align-items: flex-start;
  }

  .share-confirm-detail-row strong,
  .share-confirm-file-name {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .share-confirm-detail-row strong {
    text-align: right;
  }
}
</style>
