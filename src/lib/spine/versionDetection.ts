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

export interface SpineFileGroupCandidate {
  id: string
  label: string
  score: number
  skeletonFile: File
  atlasFile: File | null
  textureFiles: File[]
  missingTextureNames: string[]
  issues: string[]
  isLoadable: boolean
  sourceFiles: SpineSourceFiles | null
}

export interface SpineFileAnalysisResult {
  groups: SpineFileGroupCandidate[]
  generalIssues: string[]
}

const getFileExtension = (file: File): string => {
  return file.name.split('.').pop()?.toLowerCase() || ''
}

const getFilenameStem = (filename: string): string => {
  return filename.replace(/\.[^.]+$/, '')
}

const getFilenameOnly = (filename: string): string => {
  return filename.split(/[\\/]/).pop() || filename
}

const normalizeMatchKey = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const tokenizeMatchKey = (value: string): string[] => {
  return value.toLowerCase().match(/[a-z0-9]+/g) || []
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

interface SpineAtlasAnalysis {
  file: File
  pageNames: string[]
  textureFiles: File[]
  missingTextureNames: string[]
}

const parseAtlasPageNames = (text: string): string[] => {
  const lines = text.split(/\r?\n/)
  const pageNames: string[] = []
  let isBlockStart = true

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      isBlockStart = true
      continue
    }

    if (/^\s/.test(line) || !isBlockStart) {
      continue
    }

    const nextFields: string[] = []
    for (let nextIndex = index + 1; nextIndex < lines.length && nextFields.length < 4; nextIndex += 1) {
      const nextTrimmed = lines[nextIndex].trim()
      if (!nextTrimmed) break
      nextFields.push(nextTrimmed.toLowerCase())
    }

    const pageFieldCount = ['size:', 'filter:', 'repeat:', 'format:']
      .filter(prefix => nextFields.some(field => field.startsWith(prefix)))
      .length

    if (pageFieldCount >= 2) {
      pageNames.push(trimmed)
    }

    isBlockStart = false
  }

  return [...new Set(pageNames)]
}

const matchAtlasPageToTexture = (pageName: string, textureFiles: File[]) => {
  const pageFilename = getFilenameOnly(pageName).toLowerCase()
  const pageStem = getFilenameStem(pageFilename)

  return textureFiles.find(file => {
    const filename = file.name.toLowerCase()
    return filename === pageFilename || getFilenameStem(filename) === pageStem
  }) || null
}

const analyzeAtlasFile = async (atlasFile: File, textureFiles: File[]): Promise<SpineAtlasAnalysis> => {
  const pageNames = parseAtlasPageNames(await atlasFile.text())
  const matchedTextures: File[] = []
  const missingTextureNames: string[] = []

  for (const pageName of pageNames) {
    const texture = matchAtlasPageToTexture(pageName, textureFiles)
    if (texture) {
      matchedTextures.push(texture)
      continue
    }
    missingTextureNames.push(getFilenameOnly(pageName))
  }

  return {
    file: atlasFile,
    pageNames,
    textureFiles: [...new Set(matchedTextures)].sort(compareSourceFiles),
    missingTextureNames
  }
}

const scoreSkeletonAtlasMatch = (
  skeletonFile: File,
  atlasFile: File,
  atlasFileCount: number
): number => {
  const skeletonStem = getFilenameStem(skeletonFile.name)
  const atlasStem = getFilenameStem(atlasFile.name)
  const skeletonKey = normalizeMatchKey(skeletonStem)
  const atlasKey = normalizeMatchKey(atlasStem)

  if (skeletonStem.toLowerCase() === atlasStem.toLowerCase()) return 100
  if (skeletonKey === atlasKey) return 95
  if (skeletonKey.startsWith(atlasKey) || atlasKey.startsWith(skeletonKey)) return 80
  if (skeletonKey.includes(atlasKey) || atlasKey.includes(skeletonKey)) return 70

  const skeletonTokens = tokenizeMatchKey(skeletonStem)
  const atlasTokens = tokenizeMatchKey(atlasStem)
  const sharedTokens = skeletonTokens.filter(token => atlasTokens.includes(token))

  if (sharedTokens.length >= 2) return 65
  if (sharedTokens.some(token => token.length >= 4)) return 60
  if (atlasFileCount === 1) return 40

  return 0
}

const buildGroupLabel = (skeletonFile: File, atlasFile: File | null) => {
  const skeletonStem = getFilenameStem(skeletonFile.name)
  if (!atlasFile) return skeletonStem

  const atlasStem = getFilenameStem(atlasFile.name)
  return skeletonStem === atlasStem ? skeletonStem : `${skeletonStem} -> ${atlasStem}`
}

const compareGroups = (a: SpineFileGroupCandidate, b: SpineFileGroupCandidate) => {
  if (a.isLoadable !== b.isLoadable) return a.isLoadable ? -1 : 1
  if (a.score !== b.score) return b.score - a.score
  return a.label.localeCompare(b.label)
}

export const analyzeSpineFiles = async (files: File[]): Promise<SpineFileAnalysisResult> => {
  const sortedFiles = [...files].sort(compareSourceFiles)
  const skeletonFiles = sortedFiles.filter(file => getFileExtension(file) === 'json')
  const atlasFiles = sortedFiles.filter(file => getFileExtension(file) === 'atlas')
  const textureFiles = sortedFiles.filter(file => getFileExtension(file) === 'png')
  const generalIssues: string[] = []

  if (skeletonFiles.length === 0) {
    generalIssues.push('Missing skeleton file (.json)')
  }

  if (atlasFiles.length === 0) {
    generalIssues.push('Missing atlas file (.atlas)')
  }

  const atlasAnalyses = await Promise.all(
    atlasFiles.map(file => analyzeAtlasFile(file, textureFiles))
  )

  const groups: SpineFileGroupCandidate[] = []
  const matchedAtlasNames = new Set<string>()
  const minimumCandidateScore = atlasFiles.length <= 1 ? 40 : 60

  for (const skeletonFile of skeletonFiles) {
    const candidates = atlasAnalyses
      .map(atlas => ({
        atlas,
        score: scoreSkeletonAtlasMatch(skeletonFile, atlas.file, atlasFiles.length)
      }))
      .filter(candidate => candidate.score >= minimumCandidateScore)
      .sort((left, right) => {
        if (left.score !== right.score) return right.score - left.score
        return left.atlas.file.name.localeCompare(right.atlas.file.name)
      })

    if (candidates.length === 0) {
      groups.push({
        id: `${skeletonFile.name}::unmatched`,
        label: buildGroupLabel(skeletonFile, null),
        score: 0,
        skeletonFile,
        atlasFile: null,
        textureFiles: [],
        missingTextureNames: [],
        issues: [atlasFiles.length > 0 ? 'No atlas match found' : 'Missing atlas file (.atlas)'],
        isLoadable: false,
        sourceFiles: null
      })
      continue
    }

    const hasMultipleCandidates = candidates.length > 1
    for (const [index, candidate] of candidates.entries()) {
      matchedAtlasNames.add(candidate.atlas.file.name)

      const issues: string[] = []
      if (hasMultipleCandidates) {
        issues.push(`Multiple atlas matches found for ${skeletonFile.name}`)
      }
      if (candidate.atlas.missingTextureNames.length > 0) {
        issues.push(`Missing textures: ${candidate.atlas.missingTextureNames.join(', ')}`)
      }

      groups.push({
        id: `${skeletonFile.name}::${candidate.atlas.file.name}::${index}`,
        label: buildGroupLabel(skeletonFile, candidate.atlas.file),
        score: candidate.score,
        skeletonFile,
        atlasFile: candidate.atlas.file,
        textureFiles: candidate.atlas.textureFiles,
        missingTextureNames: candidate.atlas.missingTextureNames,
        issues,
        isLoadable: candidate.atlas.missingTextureNames.length === 0,
        sourceFiles: {
          skeletonFile,
          atlasFile: candidate.atlas.file,
          textureFiles: candidate.atlas.textureFiles
        }
      })
    }
  }

  for (const atlas of atlasAnalyses) {
    if (!matchedAtlasNames.has(atlas.file.name)) {
      generalIssues.push(`Unmatched atlas: ${atlas.file.name}`)
    }
  }

  return {
    groups: groups.sort(compareGroups),
    generalIssues
  }
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
