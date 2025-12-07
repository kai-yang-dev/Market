import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentApi, Balance } from '../services/api'
import { showToast } from '../utils/toast'

interface ChargeResponse {
  walletAddress: string
  amount: number
  gasFee: number
  platformFee: number
  total: number
  transactionId: string
  expiresAt: string
}

function Charge() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [chargeData, setChargeData] = useState<ChargeResponse | null>(null)
  const [transactionStatus, setTransactionStatus] = useState<string>('')
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const intervalRef = useRef<number | null>(null)
  const countdownRef = useRef<number | null>(null)

  useEffect(() => {
    paymentApi.getBalance()
      .then(setBalance)
      .catch((error) => {
        console.error('Failed to fetch balance:', error)
        showToast.error('Failed to load balance')
      })

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current)
      }
    }
  }, [])

  // Countdown timer effect - updates every second
  useEffect(() => {
    if (chargeData && transactionStatus === 'pending') {
      // Update countdown immediately
      setTimeRemaining(getTimeRemaining(chargeData.expiresAt))

      // Update countdown every second
      countdownRef.current = window.setInterval(() => {
        const remaining = getTimeRemaining(chargeData.expiresAt)
        setTimeRemaining(remaining)

        // If expired, stop the countdown
        if (remaining === 'Expired') {
          if (countdownRef.current) {
            window.clearInterval(countdownRef.current)
          }
        }
      }, 1000) // Update every second

      return () => {
        if (countdownRef.current) {
          window.clearInterval(countdownRef.current)
        }
      }
    } else {
      setTimeRemaining('')
    }
  }, [chargeData, transactionStatus])

  useEffect(() => {
    if (chargeData && transactionStatus === 'pending') {
      // Start polling for status updates
      intervalRef.current = window.setInterval(async () => {
        try {
          const status = await paymentApi.getChargeStatus(chargeData.transactionId)
          setTransactionStatus(status.status)

          if (status.status === 'success') {
            if (intervalRef.current) {
              window.clearInterval(intervalRef.current)
            }
            if (countdownRef.current) {
              window.clearInterval(countdownRef.current)
            }
            showToast.success('Payment received! Your balance has been updated.')
            // Refresh balance
            const updatedBalance = await paymentApi.getBalance()
            setBalance(updatedBalance)
            // Reset form after a delay
            setTimeout(() => {
              setChargeData(null)
              setAmount('')
              setTransactionStatus('')
              setTimeRemaining('')
            }, 3000)
          } else if (status.status === 'cancelled' || status.status === 'failed') {
            if (intervalRef.current) {
              window.clearInterval(intervalRef.current)
            }
            if (countdownRef.current) {
              window.clearInterval(countdownRef.current)
            }
            showToast.error('Transaction was cancelled or failed')
            setChargeData(null)
            setTransactionStatus('')
            setTimeRemaining('')
          }
        } catch (error) {
          console.error('Failed to check transaction status:', error)
        }
      }, 5000) // Poll every 5 seconds

      return () => {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current)
        }
      }
    }
  }, [chargeData, transactionStatus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!amount || Number(amount) <= 0) {
      showToast.error('Please enter a valid amount')
      return
    }

    setLoading(true)
    try {
      const response = await paymentApi.initiateCharge({
        amount: Number(amount),
      })
      setChargeData(response)
      setTransactionStatus('pending')
      showToast.success('Wallet address generated. Please send USDT to the address below.')
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to initiate charge'
      showToast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast.success('Copied to clipboard!')
  }

  const generateQRCode = (text: string): string => {
    // Using a QR code API service
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime()
    const expiry = new Date(expiresAt).getTime()
    const diff = expiry - now

    if (diff <= 0) return 'Expired'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    // Format with leading zeros for better display
    const h = hours.toString().padStart(2, '0')
    const m = minutes.toString().padStart(2, '0')
    const s = seconds.toString().padStart(2, '0')
    
    return `${h}:${m}:${s}`
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Charge Balance</h1>
        <p className="text-slate-400 mb-6">Add USDT TRC20 to your account</p>

        {balance && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-emerald-600/20 border border-primary/30">
            <p className="text-sm text-slate-400 mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-white">{Number(balance.amount).toFixed(2)} USDT</p>
          </div>
        )}

        {!chargeData ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-white mb-2">
                Amount (USDT)
              </label>
              <input
                type="number"
                id="amount"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-300">
                <strong>Note:</strong> After clicking "Charge Balance", you will receive a unique wallet address. 
                Send the exact amount of USDT TRC20 to that address. Your balance will be updated automatically once the payment is confirmed.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-semibold hover:shadow-lg hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Charge Balance'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white font-semibold hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-center">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                transactionStatus === 'success' 
                  ? 'text-green-400 bg-green-400/10' 
                  : transactionStatus === 'pending'
                  ? 'text-yellow-400 bg-yellow-400/10'
                  : 'text-slate-400 bg-slate-400/10'
              }`}>
                {transactionStatus === 'success' ? 'PAID' : transactionStatus === 'pending' ? 'WAITING FOR PAYMENT' : transactionStatus.toUpperCase()}
              </span>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-xl">
                <img
                  src={generateQRCode(chargeData.walletAddress)}
                  alt="Wallet Address QR Code"
                  className="w-64 h-64"
                />
              </div>
            </div>

            {/* Wallet Address */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Wallet Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chargeData.walletAddress}
                  readOnly
                  className="flex-1 px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(chargeData.walletAddress)}
                  className="px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Amount Breakdown */}
            <div className="p-4 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Amount:</span>
                <span className="font-semibold">{chargeData.amount.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Gas Fee (estimated):</span>
                <span className="font-semibold">~{chargeData.gasFee.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Platform Fee:</span>
                <span className="font-semibold">{chargeData.platformFee.toFixed(2)} USDT</span>
              </div>
              <div className="pt-2 border-t border-white/10 flex justify-between text-white">
                <span className="font-semibold">Total to Send:</span>
                <span className="font-bold text-lg">{chargeData.total.toFixed(2)} USDT</span>
              </div>
            </div>

            {/* Expiration */}
            {transactionStatus === 'pending' && (
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                <div className="text-center">
                  <p className="text-xs text-yellow-400/70 mb-2">Time Remaining</p>
                  <p className="text-3xl font-bold text-yellow-300 font-mono tracking-wider">
                    {timeRemaining || getTimeRemaining(chargeData.expiresAt)}
                  </p>
                  {timeRemaining === 'Expired' && (
                    <p className="text-xs text-red-400 mt-2">This transaction has expired</p>
                  )}
                </div>
                <p className="text-xs text-yellow-400/70 text-center mt-3 pt-3 border-t border-yellow-500/20">
                  Expires at: {formatDate(chargeData.expiresAt)}
                </p>
              </div>
            )}

            {/* Instructions */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-300 mb-2">
                <strong>Instructions:</strong>
              </p>
              <ol className="text-sm text-blue-300/80 list-decimal list-inside space-y-1">
                <li>Send exactly <strong>{chargeData.total.toFixed(2)} USDT</strong> to the wallet address above</li>
                <li>Make sure you're sending USDT on the TRC20 network</li>
                <li>Your balance will be updated automatically once the payment is confirmed</li>
                <li>This page will update automatically when payment is received</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  if (intervalRef.current) {
                    window.clearInterval(intervalRef.current)
                  }
                  if (countdownRef.current) {
                    window.clearInterval(countdownRef.current)
                  }
                  setChargeData(null)
                  setAmount('')
                  setTransactionStatus('')
                  setTimeRemaining('')
                }}
                className="flex-1 px-6 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white font-semibold hover:bg-white/5 transition-all"
              >
                {transactionStatus === 'success' ? 'Charge Again' : 'Cancel'}
              </button>
              {transactionStatus === 'pending' && (
                <button
                  onClick={() => {
                    window.open(`https://tronscan.org/#/address/${chargeData.walletAddress}`, '_blank')
                  }}
                  className="px-6 py-3 rounded-xl bg-primary/20 border border-primary/30 text-primary font-semibold hover:bg-primary/30 transition-all"
                >
                  View on TronScan
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Charge
