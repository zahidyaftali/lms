import { useEffect, useRef } from 'react'
import { Icon } from '../ui'

const TOOLS = [
  { cmd: 'bold', icon: 'minus', label: 'B' },
  { cmd: 'italic', label: 'I' },
  { cmd: 'underline', label: 'U' },
  { cmd: 'formatBlock', value: 'h2', label: 'H2' },
  { cmd: 'formatBlock', value: 'h3', label: 'H3' },
  { cmd: 'insertUnorderedList', label: '• List' },
  { cmd: 'insertOrderedList', label: '1. List' },
]

/**
 * Small formatting surface for text units. execCommand is deprecated but is
 * still the least invasive way to get a usable editor without a dependency.
 */
export default function RichText({ value, onChange, minHeight = 260 }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || ''
  }, [value])

  const run = (tool) => {
    ref.current?.focus()
    document.execCommand(tool.cmd, false, tool.value)
    onChange(ref.current.innerHTML)
  }

  return (
    <div className="border border-line rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-gray-50 px-2 py-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(tool)}
            className="h-8 min-w-8 px-2 rounded text-[13px] font-medium text-ink-700 hover:bg-white hover:text-brand-700 border border-transparent hover:border-line"
          >
            {tool.label}
          </button>
        ))}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = window.prompt('Link URL')
            if (url) run({ cmd: 'createLink', value: url })
          }}
          className="h-8 px-2 rounded text-ink-700 hover:bg-white hover:text-brand-700 border border-transparent hover:border-line"
          title="Insert link"
        >
          <Icon name="link" className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        style={{ minHeight }}
        className="prose-unit px-4 py-3.5 text-[14.5px] leading-7 text-ink-900 outline-none"
      />
    </div>
  )
}
