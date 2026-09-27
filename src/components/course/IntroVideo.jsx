import { cx } from '../../lib/utils'
import { toEmbedURL, useFileURL } from './media'

/**
 * A course's preview video: `{ source: 'youtube' | 'file', url, fileId, src, fileName, fileSize }`.
 * A custom video is either uploaded to this browser (`fileId`) or served with the
 * portal (`src`, e.g. the videos copied from TalentLMS). Both sources are kept on the
 * record so switching tabs in Course options does not throw the other one away;
 * `source` decides which one plays.
 */
export function hasIntroVideo(video) {
  if (!video) return false
  return video.source === 'file' ? !!(video.fileId || video.src) : !!toEmbedURL(video.url)
}

export default function IntroVideo({ video, title = 'Course introduction', className }) {
  const storedUrl = useFileURL(video?.source === 'file' && !video.src ? video.fileId : null)
  const fileUrl = video?.src || storedUrl
  if (!hasIntroVideo(video)) return null

  const frame = cx('w-full aspect-video rounded-md overflow-hidden bg-black', className)

  if (video.source === 'file') {
    return fileUrl ? (
      <video src={fileUrl} controls preload="metadata" className={frame} />
    ) : (
      <div className={frame} />
    )
  }

  return (
    <div className={frame}>
      <iframe
        src={toEmbedURL(video.url)}
        title={title}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
