import type { SpineSourceFiles } from './versionDetection'

export interface SpineResolvedResources {
  skeletonUrl: string
  atlasUrl: string
  textureUrls: string[]
  revokeAll: () => void
}

export const createSpineResolvedResources = (sourceFiles: SpineSourceFiles): SpineResolvedResources => {
  const urls = [
    URL.createObjectURL(sourceFiles.skeletonFile),
    URL.createObjectURL(sourceFiles.atlasFile),
    ...sourceFiles.textureFiles.map(file => URL.createObjectURL(file))
  ]

  return {
    skeletonUrl: urls[0],
    atlasUrl: urls[1],
    textureUrls: urls.slice(2),
    revokeAll: () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }
}
