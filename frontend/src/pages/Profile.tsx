import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faEnvelope, faIdCard, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { useAppSelector } from '../store/hooks'
import { authApi } from '../services/api'

function Profile() {
  const navigate = useNavigate()
  const { user: storeUser, isAuthenticated } = useAppSelector((state) => state.auth)
  const [user, setUser] = useState(storeUser)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const fetchProfile = async () => {
      try {
        setLoading(true)
        const profileData = await authApi.getProfile()
        setUser(profileData)
      } catch (error) {
        console.error('Failed to fetch profile:', error)
        // If fetch fails, use store user as fallback
        setUser(storeUser)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [isAuthenticated, navigate, storeUser])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-400 mb-4" />
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg">No user data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/30">
              <span className="text-4xl font-bold text-white">
                {user.firstName?.[0] || user.email[0].toUpperCase()}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.userName || 'User Profile'}
            </h1>
            <p className="text-blue-100 text-lg">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
        {/* Profile Information Card */}
        <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-100 mb-6 flex items-center space-x-2">
            <FontAwesomeIcon icon={faUser} className="text-blue-400" />
            <span>Profile Information</span>
          </h2>

          <div className="space-y-4">
            {/* Email */}
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-2">
                <FontAwesomeIcon icon={faEnvelope} className="text-blue-400" />
                <label className="text-sm font-medium text-gray-400">Email</label>
              </div>
              <p className="text-gray-100 text-lg">{user.email}</p>
            </div>

            {/* Username */}
            {user.userName && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <FontAwesomeIcon icon={faIdCard} className="text-blue-400" />
                  <label className="text-sm font-medium text-gray-400">Username</label>
                </div>
                <p className="text-gray-100 text-lg">{user.userName}</p>
              </div>
            )}

            {/* First Name */}
            {user.firstName && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <FontAwesomeIcon icon={faUser} className="text-blue-400" />
                  <label className="text-sm font-medium text-gray-400">First Name</label>
                </div>
                <p className="text-gray-100 text-lg">{user.firstName}</p>
              </div>
            )}

            {/* Last Name */}
            {user.lastName && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <FontAwesomeIcon icon={faUser} className="text-blue-400" />
                  <label className="text-sm font-medium text-gray-400">Last Name</label>
                </div>
                <p className="text-gray-100 text-lg">{user.lastName}</p>
              </div>
            )}

            {/* Role */}
            {user.role && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <FontAwesomeIcon icon={faIdCard} className="text-blue-400" />
                  <label className="text-sm font-medium text-gray-400">Role</label>
                </div>
                <p className="text-gray-100 text-lg capitalize">{user.role}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile

