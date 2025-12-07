import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentApi, Balance } from '../services/api'
import { showToast } from '../utils/toast'

function Withdraw() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [amount, setAmount] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    paymentApi.getBalance()
      .then(setBalance)
      .catch((error) => {
        console.error('Failed to fetch balance:', error)
        showToast.error('Failed to load balance')
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!amount || Number(amount) <= 0) {
      showToast.error('Please enter a valid amount')
      return
    }

    // Check if balance is sufficient (amount + fees)
    if (balance && (Number(amount) + totalFees) > Number(balance.amount)) {
      showToast.error(`Insufficient balance. You need ${(Number(amount) + totalFees).toFixed(2)} USDT (including fees)`)
      return
    }

    if (!walletAddress.trim()) {
      showToast.error('Please enter wallet address')
      return
    }

    // Basic TRC20 address validation (starts with T and is 34 characters)
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(walletAddress.trim())) {
      showToast.error('Please enter a valid TRC20 wallet address')
      return
    }

    setLoading(true)
    try {
      await paymentApi.withdraw({
        amount: Number(amount),
        walletAddress: walletAddress.trim(),
      })
      showToast.success('Withdrawal request submitted successfully')
      setAmount('')
      setWalletAddress('')
      // Refresh balance
      const updatedBalance = await paymentApi.getBalance()
      setBalance(updatedBalance)
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to process withdrawal'
      showToast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleMaxAmount = () => {
    if (balance) {
      // Account for fees (platform fee $1 + estimated gas fee ~$1.5)
      const estimatedFees = 2.5
      const maxAmount = Math.max(0, Number(balance.amount) - estimatedFees)
      setAmount(maxAmount.toFixed(2))
    }
  }

  // Calculate estimated fees
  const estimatedGasFee = 1.5 // This should ideally come from the backend
  const platformFee = 1
  const totalFees = estimatedGasFee + platformFee
  const netAmount = amount ? (Number(amount) - totalFees).toFixed(2) : '0.00'

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Withdraw Balance</h1>
        <p className="text-slate-400 mb-6">Withdraw USDT TRC20 to your wallet</p>

        {balance && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-emerald-600/20 border border-primary/30">
            <p className="text-sm text-slate-400 mb-1">Available Balance</p>
            <p className="text-2xl font-bold text-white">{Number(balance.amount).toFixed(2)} USDT</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-white mb-2">
              Amount (USDT)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                id="amount"
                step="0.01"
                min="0.01"
                max={balance ? Number(balance.amount) : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="0.00"
                required
              />
              <button
                type="button"
                onClick={handleMaxAmount}
                className="px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-all"
              >
                Max
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="walletAddress" className="block text-sm font-medium text-white mb-2">
              TRC20 Wallet Address
            </label>
            <input
              type="text"
              id="walletAddress"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
              placeholder="Txxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              Enter your TRC20 wallet address (starts with T)
            </p>
          </div>

          {amount && Number(amount) > 0 && (
            <div className="p-4 rounded-xl bg-[rgba(2,4,8,0.7)] border border-white/10 space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Withdrawal Amount:</span>
                <span className="font-semibold">{Number(amount).toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Gas Fee (estimated):</span>
                <span className="font-semibold">~{estimatedGasFee.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Platform Fee:</span>
                <span className="font-semibold">{platformFee.toFixed(2)} USDT</span>
              </div>
              <div className="pt-2 border-t border-white/10 flex justify-between text-white">
                <span className="font-semibold">Total Deduction:</span>
                <span className="font-bold text-lg">{(Number(amount) + totalFees).toFixed(2)} USDT</span>
              </div>
              <div className="pt-2 border-t border-white/10 flex justify-between text-green-400">
                <span className="font-semibold">You will receive:</span>
                <span className="font-bold text-lg">{netAmount} USDT</span>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm text-yellow-300">
              <strong>Warning:</strong> Please double-check your wallet address. 
              Withdrawals are irreversible and will be processed immediately.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-semibold hover:shadow-lg hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Withdraw'}
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
      </div>
    </div>
  )
}

export default Withdraw

