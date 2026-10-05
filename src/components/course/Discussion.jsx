import { useMemo, useState } from 'react'
import { Avatar, Badge, Button, EmptyState, Icon, Textarea } from '../ui'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { isAdmin } from '../../lib/permissions'
import { cx, fullName, timeAgo } from '../../lib/utils'

/**
 * A course's discussion: topics, replies and upvotes. Shown to its learners in
 * the course player and to its staff in the builder, when Account & Settings →
 * Courses → Discussions is on.
 */
export default function Discussion({ course }) {
  const { discussions = [], users, actions } = useData()
  const { user } = useAuth()
  const [topic, setTopic] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [reply, setReply] = useState('')

  const posts = useMemo(() => discussions.filter((p) => p.courseId === course.id), [discussions, course.id])
  const topics = posts.filter((p) => !p.parentId).sort((a, b) => (a.at < b.at ? 1 : -1))
  const repliesOf = (id) => posts.filter((p) => p.parentId === id).sort((a, b) => (a.at > b.at ? 1 : -1))
  const moderator = isAdmin(user) || (course.instructorIds || []).includes(user.id)
  const author = (id) => users.find((u) => u.id === id)

  function post(body, parentId = null) {
    const text = body.trim()
    if (!text) return
    actions.discussions.add({ courseId: course.id, userId: user.id, parentId, body: text, at: new Date().toISOString(), upvotes: [] })
    actions.logEvent('progress', `posted in the discussion of ${course.name}`, user.id)
  }

  function remove(p) {
    repliesOf(p.id).forEach((r) => actions.discussions.remove(r.id))
    actions.discussions.remove(p.id)
  }

  function toggleVote(p) {
    const votes = p.upvotes || []
    actions.discussions.update(p.id, { upvotes: votes.includes(user.id) ? votes.filter((id) => id !== user.id) : [...votes, user.id] })
  }

  const Post = ({ p, nested }) => {
    const who = author(p.userId)
    const mine = p.userId === user.id
    const voted = (p.upvotes || []).includes(user.id)
    return (
      <div className={cx('flex gap-3', nested && 'mt-4')}>
        <Avatar user={who} size={nested ? 30 : 36} />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px]">
            <span className="font-semibold">{who ? fullName(who) : 'A former member'}</span>
            {who && who.role !== 'learner' && (
              <Badge tone="blue" className="ml-2">
                Staff
              </Badge>
            )}
            <span className="text-ink-400 ml-2">{timeAgo(p.at)}</span>
          </p>
          <p className="text-[14px] leading-6 text-ink-900 whitespace-pre-line mt-1 break-words">{p.body}</p>
          <div className="flex items-center gap-4 mt-2 text-[12.5px] text-ink-500">
            <button
              onClick={() => !mine && toggleVote(p)}
              disabled={mine}
              className={cx('inline-flex items-center gap-1.5', voted ? 'text-brand-700 font-semibold' : !mine && 'hover:text-brand-700')}
              title={mine ? 'Upvotes on your post' : voted ? 'Take back your upvote' : 'Upvote'}
            >
              <Icon name="chevronUp" className="w-4 h-4" strokeWidth={2.4} />
              {(p.upvotes || []).length}
            </button>
            {!nested && (
              <button className="hover:text-brand-700" onClick={() => setReplyTo(replyTo === p.id ? null : p.id)}>
                Reply
              </button>
            )}
            {(mine || moderator) && (
              <button className="hover:text-red-600" onClick={() => remove(p)}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ask a question or start a topic for this course" />
        <div className="flex justify-end mt-2.5">
          <Button
            size="sm"
            disabled={!topic.trim()}
            onClick={() => {
              post(topic)
              setTopic('')
            }}
          >
            Post
          </Button>
        </div>
      </div>

      {topics.length === 0 ? (
        <EmptyState icon="quote" title="No discussion yet" message="Be the first to ask a question or share a tip about this course." />
      ) : (
        <ul className="space-y-6">
          {topics.map((p) => (
            <li key={p.id} className="border border-line rounded-md p-4">
              <Post p={p} />
              <div className="pl-12">
                {repliesOf(p.id).map((r) => (
                  <Post key={r.id} p={r} nested />
                ))}
                {replyTo === p.id && (
                  <div className="mt-4">
                    <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply" autoFocus />
                    <div className="flex justify-end gap-2.5 mt-2.5">
                      <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!reply.trim()}
                        onClick={() => {
                          post(reply, p.id)
                          setReply('')
                          setReplyTo(null)
                        }}
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
