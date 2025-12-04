import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faPlus, faStar, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { useAppSelector } from '../store/hooks'
import { categoryApi, serviceApi, Service, Category } from '../services/api'

function Services() {
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  useEffect(() => {
    fetchCategories()
    fetchServices()
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchServices()
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, selectedCategory])

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.getAll()
      setCategories(data)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchServices = async () => {
    try {
      setLoading(true)
      const params: any = { status: 'active' }
      if (selectedCategory) {
        params.categoryId = selectedCategory
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim()
      }
      const data = await serviceApi.getAll(params)
      setServices(data)
    } catch (error) {
      console.error('Failed to fetch services:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">Services</h1>
              <p className="text-blue-100">Browse and discover amazing services</p>
            </div>
            {isAuthenticated && (
              <Link
                to="/services/new"
                className="mt-4 sm:mt-0 px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Create Service</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search services by title, description, or tags..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Services Grid */}
        {loading ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-md">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-600 mb-4" />
            <p className="text-gray-500">Loading services...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-md">
            <p className="text-gray-500 mb-6 text-lg">No services found</p>
            {isAuthenticated && (
              <Link
                to="/services/new"
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
              >
                Create First Service
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Link
                key={service.id}
                to={`/services/${service.id}`}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden border border-gray-200 group"
              >
                <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center overflow-hidden">
                  {service.adImage ? (
                    <img
                      src={`http://localhost:3000${service.adImage}`}
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-6xl text-blue-600">📦</div>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {service.title}
                    </h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.adText}</p>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-1">
                      <FontAwesomeIcon icon={faStar} className="text-yellow-400" />
                      <span className="font-semibold text-gray-900">
                        {service.rating
                          ? typeof service.rating === 'number'
                            ? service.rating.toFixed(1)
                            : parseFloat(service.rating as any).toFixed(1)
                          : '0.0'}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      ${typeof service.balance === 'number' ? service.balance.toFixed(2) : parseFloat(service.balance as any).toFixed(2)}
                    </span>
                  </div>
                  {service.category && (
                    <div className="text-xs text-gray-500 mb-2">Category: {service.category.title}</div>
                  )}
                  {service.tags && service.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {service.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          {tag.title}
                        </span>
                      ))}
                      {service.tags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{service.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Services

