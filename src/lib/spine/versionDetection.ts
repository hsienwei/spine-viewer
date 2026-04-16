export type SpineMajorVersion = 3 | 4
export type SpineVersionMode = 'auto' | 'force-3' | 'force-4'
export type SpineDetectedVersion = SpineMajorVersion | 'unknown'

export interface SpineSourceFiles {
  skeletonFile: File
  atlasFile: File
  textureFiles: File[]
}

export interface SpineVersionDetectionResult {
  requestedMode: SpineVersionMode
  detectedVersion: SpineDetectedVersion
  selectedVersion: SpineMajorVersion
  fallbackCandidates: SpineMajorVersion[]
  sourceFiles: SpineSourceFiles
  reason: string
}

const getFileExtension = (file: File): string => {
  return file.name.split('.').pop()?.toLowerCase() || ''
}

const compareSourceFiles = (a: File, b: File) => {
  const order: Record<string, number> = {
    json: 0,
    atlas: 1,
    png: 2
  }

  const extDiff = (order[getFileExtension(a)] ?? 99) - (order[getFileExtension(b)] ?? 99)
  if (extDiff !== 0) return extDiff

  return a.name.localeCompare(b.name)
}

export const classifySpineFiles = (files: File[]): SpineSourceFiles => {
  const sortedFiles = [...files].sort(compareSourceFiles)
  const skeletonFile = sortedFiles.find(file => getFileExtension(file) === 'json')
  const atlasFile = sortedFiles.find(file => getFileExtension(file) === 'atlas')
  const textureFiles = sortedFiles.filter(file => getFileExtension(file) === 'png')

  if (!skeletonFile) {
    throw new Error('Missing skeleton file (.json)')
  }

  if (!atlasFile) {
    throw new Error('Missing atlas file (.atlas)')
  }

  return {
    skeletonFile,
    atlasFile,
    textureFiles
  }
}

const parseVersionString = (value: unknown): SpineDetectedVersion => {
  if (typeof value !== 'string') return 'unknown'

  const normalized = value.trim()
  if (!normalized) return 'unknown'
  if (normalized.startsWith('4.')) return 4
  if (normalized.startsWith('3.')) return 3

  return 'unknown'
}

const detectVersionFromJsonText = (text: string): SpineDetectedVersion => {
  try {
    const parsed = JSON.parse(text) as {
      skeleton?: {
        spine?: string
      }
    }

    return parseVersionString(parsed?.skeleton?.spine)
  } catch {
    return 'unknown'
  }
}

export const detectSpineVersion = async (
  files: File[],
  requestedMode: SpineVersionMode
): Promise<SpineVersionDetectionResult> => {
  const sourceFiles = classifySpineFiles(files)

  if (requestedMode === 'force-4') {
    return {
      requestedMode,
      detectedVersion: 'unknown',
      selectedVersion: 4,
      fallbackCandidates: [],
      sourceFiles,
      reason: 'User forced Spine 4.x'
    }
  }

  if (requestedMode === 'force-3') {
    return {
      requestedMode,
      detectedVersion: 'unknown',
      selectedVersion: 3,
      fallbackCandidates: [],
      sourceFiles,
      reason: 'User forced Spine 3.x'
    }
  }

  const skeletonText = await sourceFiles.skeletonFile.text()
  const detectedVersion = detectVersionFromJsonText(skeletonText)

  if (detectedVersion === 3 || detectedVersion === 4) {
    return {
      requestedMode,
      detectedVersion,
      selectedVersion: detectedVersion,
      fallbackCandidates: detectedVersion === 4 ? [3] : [4],
      sourceFiles,
      reason: `Detected Spine ${detectedVersion}.x from skeleton JSON`
    }
  }

  return {
    requestedMode,
    detectedVersion: 'unknown',
    selectedVersion: 4,
    fallbackCandidates: [3],
    sourceFiles,
    reason: 'Version not found in skeleton JSON, defaulting to Spine 4.x'
  }
}
