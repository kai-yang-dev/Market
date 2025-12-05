import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faSpinner,
  faPaperPlane,
  faUser,
  faPlus,
  faCheck,
  faTimes,
  faBan,
  faCheckCircle,
  faMoneyBillWave,
  faGavel,
} from '@fortawesome/free-solid-svg-icons'
import { conversationApi, messageApi, milestoneApi, Conversation, Message, Milestone } from '../services/api'
import { useAppSelector } from '../store/hooks'
import { getSocket, disconnectSocket } from '../services/socket'
import { Socket } from 'socket.io-client'

function Chat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    balance: '',
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [updatingMilestone, setUpdatingMilestone] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (id) {
      fetchConversation()
      fetchMessages()
      fetchMilestones()
    }
  }, [id])

  // Set up WebSocket connection
  useEffect(() => {
    if (!id) return

    const socket = getSocket()
    if (!socket) {
      console.warn('Socket not available, skipping WebSocket setup')
      return
    }

    socketRef.current = socket

    // Wait for connection before joining room
    const setupSocket = () => {
      if (socket.connected) {
        socket.emit('join_conversation', { conversationId: id })
      } else {
        socket.once('connect', () => {
          socket.emit('join_conversation', { conversationId: id })
        })
      }
    }

    setupSocket()

    // Listen for new messages
    const handleNewMessage = (message: Message) => {
      setMessages((prev) => {
        // Check if message already exists
        if (prev.some((m) => m.id === message.id)) {
          return prev
        }
        return [...prev, message]
      })
    }

    // Listen for milestone updates
    const handleMilestoneUpdate = () => {
      fetchMilestones()
    }

    socket.on('new_message', handleNewMessage)
    socket.on('milestone_updated', handleMilestoneUpdate)
    socket.on('joined_conversation', () => {
      console.log('Joined conversation room:', id)
    })
    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.off('new_message', handleNewMessage)
        socket.off('milestone_updated', handleMilestoneUpdate)
        socket.off('joined_conversation')
        socket.off('error')
        socket.off('connect_error')
        socket.emit('leave_conversation', { conversationId: id })
      }
    }
  }, [id])

  useEffect(() => {
    scrollToBottom()
  }, [messages, milestones])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchConversation = async () => {
    try {
      const data = await conversationApi.getById(id!)
      setConversation(data)
    } catch (error) {
      console.error('Failed to fetch conversation:', error)
      navigate('/services')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    try {
      const data = await messageApi.getByConversation(id!)
      setMessages(data)
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    }
  }

  const fetchMilestones = async () => {
    try {
      const data = await milestoneApi.getByConversation(id!)
      setMilestones(data)
    } catch (error) {
      console.error('Failed to fetch milestones:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() || !id) return

    try {
      setSending(true)
      
      // Try WebSocket first, fallback to HTTP API
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('send_message', {
          conversationId: id,
          message: messageText.trim(),
        })
        setMessageText('')
        // Message will be added via WebSocket 'new_message' event
        setTimeout(() => {
          fetchMessages()
        }, 500)
      } else {
        // Fallback to HTTP API if WebSocket not available
        await messageApi.create(id, messageText.trim())
        setMessageText('')
        await fetchMessages()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleCreateMilestone = async () => {
    if (!conversation || !milestoneForm.title || !milestoneForm.description || !milestoneForm.balance) return

    try {
      await milestoneApi.create(id!, {
        serviceId: conversation.serviceId,
        title: milestoneForm.title,
        description: milestoneForm.description,
        balance: parseFloat(milestoneForm.balance),
      })
      setMilestoneForm({ title: '', description: '', balance: '' })
      setShowMilestoneForm(false)
      await fetchMilestones()
      await fetchMessages()
      // Emit milestone update via WebSocket
      if (socketRef.current) {
        socketRef.current.emit('milestone_updated', { conversationId: id })
      }
    } catch (error) {
      console.error('Failed to create milestone:', error)
      alert('Failed to create milestone. Please try again.')
    }
  }

  const handleMilestoneAction = async (milestoneId: string, action: string) => {
    try {
      setUpdatingMilestone(milestoneId)
      switch (action) {
        case 'accept':
          await milestoneApi.accept(milestoneId)
          break
        case 'cancel':
          await milestoneApi.cancel(milestoneId)
          break
        case 'complete':
          await milestoneApi.complete(milestoneId)
          break
        case 'withdraw':
          await milestoneApi.withdraw(milestoneId)
          break
        case 'release':
          await milestoneApi.release(milestoneId)
          break
        case 'dispute':
          await milestoneApi.dispute(milestoneId)
          break
      }
      await fetchMilestones()
      await fetchMessages()
      // Emit milestone update via WebSocket
      if (socketRef.current) {
        socketRef.current.emit('milestone_updated', { conversationId: id })
      }
    } catch (error) {
      console.error(`Failed to ${action} milestone:`, error)
      alert(`Failed to ${action} milestone. Please try again.`)
    } finally {
      setUpdatingMilestone(null)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-600',
      processing: 'bg-blue-600',
      canceled: 'bg-red-600',
      completed: 'bg-green-600',
      withdraw: 'bg-yellow-600',
      released: 'bg-purple-600',
      dispute: 'bg-orange-600',
    }
    return colors[status] || 'bg-gray-600'
  }

  const getOtherUser = () => {
    if (!conversation || !user) return null
    return conversation.clientId === user.id ? conversation.provider : conversation.client
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-400 mb-4" />
          <p className="text-gray-400">Loading conversation...</p>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Conversation not found</p>
          <button
            onClick={() => navigate('/services')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Back to Services
          </button>
        </div>
      </div>
    )
  }

  const otherUser = getOtherUser()
  const isClient = conversation.clientId === user?.id

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center space-x-4">
          <button
            onClick={() => navigate('/services')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
            {otherUser?.firstName?.[0] || otherUser?.userName?.[0] || <FontAwesomeIcon icon={faUser} />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">
              {otherUser?.firstName && otherUser?.lastName
                ? `${otherUser.firstName} ${otherUser.lastName}`
                : otherUser?.userName || 'User'}
            </h2>
            <p className="text-sm text-gray-400">{conversation.service?.title}</p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {(() => {
            // Combine messages and milestones, sorted by creation time
            const allItems = [
              ...messages.map((m) => ({ type: 'message' as const, data: m, createdAt: m.createdAt })),
              ...milestones.map((mil) => ({ type: 'milestone' as const, data: mil, createdAt: mil.createdAt })),
            ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

            return allItems.map((item) => {
              if (item.type === 'message') {
                const message = item.data as Message
                const isOwn = message.senderId === user?.id
                return (
                  <div
                    key={`msg-${message.id}`}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md rounded-lg px-4 py-2 ${
                        isOwn ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'
                      }`}
                    >
                      <p className="text-sm">{message.message}</p>
                      <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              } else {
                const milestone = item.data as Milestone
                const isOwn = milestone.clientId === user?.id
                return (
                  <div
                    key={`mil-${milestone.id}`}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md rounded-lg px-4 py-3 ${
                        isOwn ? 'bg-green-600 text-white' : 'bg-purple-600 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase">Milestone</span>
                        <span className={`px-2 py-1 rounded text-xs bg-white/20 ${getStatusColor(milestone.status)}`}>
                          {milestone.status}
                        </span>
                      </div>
                      <h4 className="font-semibold mb-1">{milestone.title}</h4>
                      <p className="text-sm mb-2">{milestone.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">${milestone.balance.toFixed(2)}</span>
                        <span className="text-xs opacity-75">
                          {new Date(milestone.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              }
            })
          })()}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-gray-700 text-gray-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sending}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              ) : (
                <FontAwesomeIcon icon={faPaperPlane} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Milestones Sidebar */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-100">Milestones</h3>
            {isClient && (
              <button
                onClick={() => setShowMilestoneForm(!showMilestoneForm)}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            )}
          </div>
          {showMilestoneForm && isClient && (
            <div className="bg-gray-700 rounded-lg p-4 space-y-3 mb-4">
              <input
                type="text"
                placeholder="Title"
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                className="w-full bg-gray-600 text-gray-100 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Description"
                value={milestoneForm.description}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                className="w-full bg-gray-600 text-gray-100 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <input
                type="number"
                placeholder="Balance"
                value={milestoneForm.balance}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, balance: e.target.value })}
                className="w-full bg-gray-600 text-gray-100 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateMilestone}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowMilestoneForm(false)
                    setMilestoneForm({ title: '', description: '', balance: '' })
                  }}
                  className="flex-1 bg-gray-600 text-gray-100 px-4 py-2 rounded font-semibold hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {milestones.length === 0 ? (
            <p className="text-gray-400 text-center">No milestones yet</p>
          ) : (
            milestones.map((milestone) => (
              <div key={milestone.id} className="bg-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-gray-100">{milestone.title}</h4>
                  <span className={`px-2 py-1 rounded text-xs text-white ${getStatusColor(milestone.status)}`}>
                    {milestone.status}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{milestone.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-blue-400">${milestone.balance.toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {milestone.status === 'draft' && (
                    <>
                      {!isClient && (
                        <button
                          onClick={() => handleMilestoneAction(milestone.id, 'accept')}
                          disabled={updatingMilestone === milestone.id}
                          className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <FontAwesomeIcon icon={faCheck} className="mr-1" />
                          Accept
                        </button>
                      )}
                      {isClient && (
                        <button
                          onClick={() => handleMilestoneAction(milestone.id, 'cancel')}
                          disabled={updatingMilestone === milestone.id}
                          className="flex-1 bg-red-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <FontAwesomeIcon icon={faTimes} className="mr-1" />
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                  {milestone.status === 'processing' && (
                    <>
                      {!isClient && (
                        <>
                          <button
                            onClick={() => handleMilestoneAction(milestone.id, 'complete')}
                            disabled={updatingMilestone === milestone.id}
                            className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                            Complete
                          </button>
                          <button
                            onClick={() => handleMilestoneAction(milestone.id, 'withdraw')}
                            disabled={updatingMilestone === milestone.id}
                            className="flex-1 bg-yellow-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50"
                          >
                            <FontAwesomeIcon icon={faMoneyBillWave} className="mr-1" />
                            Withdraw
                          </button>
                        </>
                      )}
                      {isClient && (
                        <button
                          onClick={() => handleMilestoneAction(milestone.id, 'cancel')}
                          disabled={updatingMilestone === milestone.id}
                          className="flex-1 bg-red-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <FontAwesomeIcon icon={faBan} className="mr-1" />
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                  {milestone.status === 'completed' && (
                    <>
                      {isClient && (
                        <>
                          <button
                            onClick={() => handleMilestoneAction(milestone.id, 'release')}
                            disabled={updatingMilestone === milestone.id}
                            className="flex-1 bg-purple-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                            Release
                          </button>
                          <button
                            onClick={() => handleMilestoneAction(milestone.id, 'dispute')}
                            disabled={updatingMilestone === milestone.id}
                            className="flex-1 bg-orange-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                          >
                            <FontAwesomeIcon icon={faGavel} className="mr-1" />
                            Dispute
                          </button>
                        </>
                      )}
                      {!isClient && (
                        <button
                          onClick={() => handleMilestoneAction(milestone.id, 'dispute')}
                          disabled={updatingMilestone === milestone.id}
                          className="flex-1 bg-orange-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                        >
                          <FontAwesomeIcon icon={faGavel} className="mr-1" />
                          Dispute
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Chat

