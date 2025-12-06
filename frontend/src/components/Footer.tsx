import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFacebook, faTwitter, faLinkedin, faInstagram, faGithub } from '@fortawesome/free-brands-svg-icons'

function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-800 border-t border-gray-700 mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">M</span>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                MarketPlace
              </span>
            </Link>
            <p className="text-gray-400 text-sm">
              Connect with talented professionals and get your projects done. Your one-stop marketplace for quality services.
            </p>
            {/* Social Media Links */}
            <div className="flex items-center space-x-4">
              <a
                href="#"
                className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-gray-600 transition-all"
                aria-label="Facebook"
              >
                <FontAwesomeIcon icon={faFacebook} />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-gray-600 transition-all"
                aria-label="Twitter"
              >
                <FontAwesomeIcon icon={faTwitter} />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-gray-600 transition-all"
                aria-label="LinkedIn"
              >
                <FontAwesomeIcon icon={faLinkedin} />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-gray-600 transition-all"
                aria-label="Instagram"
              >
                <FontAwesomeIcon icon={faInstagram} />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-gray-600 transition-all"
                aria-label="GitHub"
              >
                <FontAwesomeIcon icon={faGithub} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  All Services
                </Link>
              </li>
              <li>
                <Link to="/feed" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  Feed
                </Link>
              </li>
              <li>
                <Link to="/profile" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  Profile
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Services</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/services" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  Browse Services
                </Link>
              </li>
              <li>
                <Link to="/services/new" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  Create Service
                </Link>
              </li>
              <li>
                <Link to="/my-services" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  My Services
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-700">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm text-center md:text-left">
              © {currentYear} MarketPlace. All rights reserved.
            </p>
            <div className="flex items-center space-x-6">
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                Privacy
              </a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                Terms
              </a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

