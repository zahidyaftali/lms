import { useEffect, useState } from 'react'
import { getFileURL } from '../../lib/fileStore'

/** Resolves an IndexedDB file id into an object URL for as long as the caller is mounted. */
export function useFileURL(fileId) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let revoked = null
    let active = true
    if (fileId) {
      getFileURL(fileId).then((u) => {
        if (active) {
          setUrl(u)
          revoked = u
        } else if (u) URL.revokeObjectURL(u)
      })
    } else {
      setUrl(null)
    }
    return () => {
      active = false
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [fileId])
  return url
}

/** YouTube and Vimeo page links become their embeddable player URLs; anything else returns null. */
export function toEmbedURL(url) {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}
