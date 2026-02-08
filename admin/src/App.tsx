import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from "@/components/ui/toaster"
import { useAppSelector, useAppDispatch } from './store/hooks'
import { logout } from './store/slices/authSlice'
import { disconnectSocket as disconnectOldSocket } from './services/socket'
import { disconnectSocket as disconnectNewSocket } from './services/socketService'
import { showToast } from './utils/toast'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import CategoryForm from './pages/CategoryForm'
import Services from './pages/Services'
import ServiceDetail from './pages/ServiceDetail'
import Blog from './pages/Blog'
import TempWallets from './pages/TempWallets'
import Withdraws from './pages/Withdraws'
import MasterWalletTransactions from './pages/MasterWalletTransactions'
import BroadcastNotification from './pages/BroadcastNotification'
import Disputes from './pages/Disputes'
import Chat from './pages/Chat'
import Helps from './pages/Helps'
import HelpDetail from './pages/HelpDetail'
import Fraud from './pages/Fraud'
import Users from './pages/Users'
import ChatHistory from './pages/ChatHistory'
import LoginHistory from './pages/LoginHistory'
import SignIn from './pages/SignIn'
import Layout from './components/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/signin" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />
}

function AppContent() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  // Handle auth expiration events globally
  useEffect(() => {
    const handleAuthExpired = () => {
      // Disconnect all socket connections
      try {
        disconnectOldSocket()
      } catch (error) {
        console.warn('Error disconnecting old socket:', error)
      }
      try {
        disconnectNewSocket()
      } catch (error) {
        console.warn('Error disconnecting new socket:', error)
      }
      
      // Clear auth state
      dispatch(logout())
      
      // Show notification
      showToast.info('Your session expired. Please sign in again.')
      
      // Navigate to sign in page
      navigate('/signin')
    }

    window.addEventListener('auth-expired', handleAuthExpired as any)
    return () => window.removeEventListener('auth-expired', handleAuthExpired as any)
  }, [dispatch, navigate])

  return (
    <Routes>
        <Route path="/signin" element={
          <PublicRoute>
            <SignIn />
          </PublicRoute>
        } />
        <Route path="/" element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/categories" element={
          <PrivateRoute>
            <Layout>
              <Categories />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/categories/new" element={
          <PrivateRoute>
            <Layout>
              <CategoryForm />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/categories/:id/edit" element={
          <PrivateRoute>
            <Layout>
              <CategoryForm />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/services" element={
          <PrivateRoute>
            <Layout>
              <Services />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/services/:id" element={
          <PrivateRoute>
            <Layout>
              <ServiceDetail />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/blog" element={
          <PrivateRoute>
            <Layout>
              <Blog />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/temp-wallets" element={
          <PrivateRoute>
            <Layout>
              <TempWallets />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/withdraws" element={
          <PrivateRoute>
            <Layout>
              <Withdraws />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/master-wallet" element={
          <PrivateRoute>
            <Layout>
              <MasterWalletTransactions />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/broadcast" element={
          <PrivateRoute>
            <Layout>
              <BroadcastNotification />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/helps" element={
          <PrivateRoute>
            <Layout>
              <Helps />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/helps/:id" element={
          <PrivateRoute>
            <Layout>
              <HelpDetail />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/disputes" element={
          <PrivateRoute>
            <Layout>
              <Disputes />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/chat/:id" element={
          <PrivateRoute>
            <Layout>
              <Chat />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/fraud" element={
          <PrivateRoute>
            <Layout>
              <Fraud />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/users" element={
          <PrivateRoute>
            <Layout>
              <Users />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/chat-history" element={
          <PrivateRoute>
            <Layout>
              <ChatHistory />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/login-history" element={
          <PrivateRoute>
            <Layout>
              <LoginHistory />
            </Layout>
          </PrivateRoute>
        } />
    </Routes>
  )
}

function App() {
  return (
    <>
      <Router>
        <AppContent />
      </Router>
      <Toaster />
    </>
  )
}

export default App

