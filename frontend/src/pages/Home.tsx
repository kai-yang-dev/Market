import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faSearch, faShieldAlt, faRocket, faUsers, faWallet, faCheckCircle,
  faArrowRight, faHandshake, faLock, faClock, faGlobeAmericas, faStore
} from '@fortawesome/free-solid-svg-icons'
import { useAppSelector } from '../store/hooks'
import { categoryApi, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'

function Home() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await categoryApi.getAll()
        setCategories(data)
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [])

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/services?search=${encodeURIComponent(searchQuery)}`)
    } else {
      navigate('/services')
    }
  }

  const features = [
    {
      icon: faShieldAlt,
      title: 'Secure Transactions',
      description: 'Bank-level encryption and secure payment processing for all transactions',
      gradient: 'from-blue-500/20 to-cyan-500/20'
    },
    {
      icon: faRocket,
      title: 'Fast & Easy',
      description: 'Get started in minutes. List your service or find what you need instantly',
      gradient: 'from-purple-500/20 to-pink-500/20'
    },
    {
      icon: faUsers,
      title: 'Global Community',
      description: 'Connect with buyers and sellers from around the world',
      gradient: 'from-emerald-500/20 to-teal-500/20'
    },
    {
      icon: faWallet,
      title: 'Crypto Payments',
      description: 'Pay and get paid with USD. Fast, secure, and borderless',
      gradient: 'from-orange-500/20 to-red-500/20'
    },
    {
      icon: faHandshake,
      title: 'Trusted Platform',
      description: 'Verified sellers and buyer protection on every transaction',
      gradient: 'from-indigo-500/20 to-purple-500/20'
    },
    {
      icon: faGlobeAmericas,
      title: 'Unlimited Categories',
      description: 'Sell or buy anything - from digital services to physical products',
      gradient: 'from-green-500/20 to-emerald-500/20'
    }
  ]

  const howItWorks = [
    {
      step: 1,
      title: 'Sign Up Free',
      description: 'Create your account in seconds. No credit card required.',
      icon: faUsers
    },
    {
      step: 2,
      title: 'List or Browse',
      description: 'Sell your services or browse thousands of available listings.',
      icon: faStore
    },
    {
      step: 3,
      title: 'Connect & Transact',
      description: 'Chat with buyers/sellers and complete secure transactions.',
      icon: faHandshake
    },
    {
      step: 4,
      title: 'Get Paid',
      description: 'Receive payments instantly via USD. Withdraw anytime.',
      icon: faWallet
    }
  ]

  return (
    <div className="min-h-screen">
      {/* Enhanced Hero Section */}
      <section className="relative pt-24 md:pt-32 pb-20 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 rounded-full blur-[150px] -z-10 animate-pulse"></div>
        <div className="absolute top-[30%] right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] -z-10"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] -z-10"></div>
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border border-primary/20 mb-6 animate-fade-in">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            <span className="text-sm text-slate-300">Join <span className="text-primary font-semibold">50,000+</span> active users</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 leading-tight">
            <span className="block text-white">
              {isAuthenticated ? `Welcome back, ${user?.firstName || 'User'}!` : 'Anyone can sell'}
            </span>
            <span className="block mt-2">
              <span className="text-slate-300">anything and </span>
              <span className="text-gradient-primary">buy anything</span>
              <span className="text-white">.</span>
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-8 font-light leading-relaxed">
            Your universal marketplace. Sell digital services, physical products, or anything you can imagine. 
            <span className="block mt-2 text-lg">Get paid instantly with USD. No limits. No boundaries.</span>
          </p>

          {/* Enhanced Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-3xl mx-auto mb-8">
            <div className="relative flex-1 w-full">
              <FontAwesomeIcon icon={faSearch} className="absolute left-6 top-1/2 transform -translate-y-1/2 text-slate-400 text-lg" />
              <input
                type="text"
                placeholder="Search for anything... services, products, skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-14 pr-6 py-5 glass-card rounded-full text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all text-lg"
              />
            </div>
            <button 
              onClick={handleSearch}
              className="px-10 py-5 bg-primary text-primary-foreground rounded-full font-bold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-translate-y-1 transition-all flex items-center space-x-2 whitespace-nowrap text-lg"
            >
              <FontAwesomeIcon icon={faSearch} />
              <span>Search</span>
            </button>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!isAuthenticated ? (
              <>
                <Link
                  to="/signup"
                  className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-translate-y-1 transition-all flex items-center space-x-2 text-lg"
                >
                  <span>Start Selling Now</span>
                  <FontAwesomeIcon icon={faArrowRight} />
                </Link>
                <Link
                  to="/services"
                  className="px-8 py-4 glass-card border border-white/20 text-white rounded-full font-semibold hover:bg-white/10 hover:border-primary/50 transition-all flex items-center space-x-2 text-lg"
                >
                  <span>Browse Marketplace</span>
                  <FontAwesomeIcon icon={faStore} />
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/services/new"
                  className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-translate-y-1 transition-all flex items-center space-x-2 text-lg"
                >
                  <span>Create New Listing</span>
                  <FontAwesomeIcon icon={faArrowRight} />
                </Link>
                <Link
                  to="/services"
                  className="px-8 py-4 glass-card border border-white/20 text-white rounded-full font-semibold hover:bg-white/10 hover:border-primary/50 transition-all flex items-center space-x-2 text-lg"
                >
                  <span>Explore Services</span>
                  <FontAwesomeIcon icon={faStore} />
                </Link>
              </>
            )}
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-8 mt-12 text-slate-400">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faLock} className="text-primary" />
              <span className="text-sm">Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheckCircle} className="text-primary" />
              <span className="text-sm">Verified Sellers</span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faClock} className="text-primary" />
              <span className="text-sm">24/7 Support</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Moved Up */}
      <section className="py-16 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="glass-card p-6 rounded-2xl hover:border-primary/20 transition-all">
              <div className="text-4xl md:text-5xl font-bold mb-2 text-primary">50K+</div>
              <div className="text-slate-400 text-sm md:text-base">Active Users</div>
            </div>
            <div className="glass-card p-6 rounded-2xl hover:border-primary/20 transition-all">
              <div className="text-4xl md:text-5xl font-bold mb-2 text-primary">10K+</div>
              <div className="text-slate-400 text-sm md:text-base">Active Listings</div>
            </div>
            <div className="glass-card p-6 rounded-2xl hover:border-primary/20 transition-all">
              <div className="text-4xl md:text-5xl font-bold mb-2 text-primary">2K+</div>
              <div className="text-slate-400 text-sm md:text-base">Verified Sellers</div>
            </div>
            <div className="glass-card p-6 rounded-2xl hover:border-primary/20 transition-all">
              <div className="text-4xl md:text-5xl font-bold mb-2 text-primary">98%</div>
              <div className="text-slate-400 text-sm md:text-base">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 border-t border-white/5 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-white">How </span>
              <span className="text-gradient-primary">It Works</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Get started in 4 simple steps. It's that easy!
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step) => (
              <div
                key={step.step}
                className="relative glass-card p-8 rounded-2xl hover:border-primary/20 transition-all hover:scale-[1.02] group"
              >
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-primary to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/30">
                  {step.step}
                </div>
                <div className="mt-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-600/20 border border-primary/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FontAwesomeIcon icon={step.icon} className="text-3xl text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-slate-400 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-white">Why Choose </span>
              <span className="text-gradient-primary">OmniMart</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Everything you need to buy and sell with confidence
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="glass-card p-8 rounded-2xl hover:border-primary/20 transition-all hover:scale-[1.02] group"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <FontAwesomeIcon icon={feature.icon} className="text-3xl text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 border-t border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-white">Browse by </span>
              <span className="text-gradient-primary">Category</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Explore thousands of listings across all categories
            </p>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-400">Loading categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">No categories available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/services?category=${category.id}`}
                  className="glass-card p-6 rounded-2xl hover:border-primary/20 transition-all cursor-pointer hover:scale-[1.05] group"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    {category.icon && (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <div className="text-3xl text-primary">
                          {renderIcon(category.icon)}
                        </div>
                      </div>
                    )}
                    <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
                      {category.title}
                    </h3>
                    {category.serviceCount !== undefined && (
                      <p className="text-sm text-slate-400">
                        {category.serviceCount} {category.serviceCount === 1 ? 'listing' : 'listings'}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Home
