'use client'

import { useState, useEffect } from 'react'
import { useAtaraxiaStore } from '@/hooks/useAtaraxiaStore'
import { Client, AccountBalanceQuery, Hbar, AccountId } from '@hashgraph/sdk'

export function Profile() {
  const { profile, updateProfile, xp } = useAtaraxiaStore()
  const [name, setName] = useState(profile.name)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar)
  const [hbarBalance, setHbarBalance] = useState<string>('—')
  const [loading, setLoading] = useState(false)

  // Hedera testnet config from env
  const HEDERA_ACCOUNT_ID = process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || '0.0.4865075'
  const HEDERA_NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet'

  useEffect(() => {
    fetchHbarBalance()
  }, [])

  const fetchHbarBalance = async () => {
    setLoading(true)
    try {
      const client = Client.forTestnet()
      const accountId = AccountId.fromString(HEDERA_ACCOUNT_ID)
      const balance = await new AccountBalanceQuery().setAccountId(accountId).execute(client)
      const hbar = balance.hbars.toString()
      setHbarBalance(`${parseFloat(hbar).toFixed(4)} HBAR`)
    } catch (err) {
      console.error('Failed to fetch HBAR balance:', err)
      setHbarBalance('Error')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Avatar maksimal 2MB')
        return
      }
      const reader = new FileReader()
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        setAvatarPreview(dataUrl)
        updateProfile({ avatar: dataUrl })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleNameSave = () => {
    updateProfile({ name })
  }

  const hedereEvmAddress = '0x510b8dae2b74ab45adb77024c6d424cab8265681'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-light text-sand-900 mb-6">Profile</h2>

      {/* Avatar & Name */}
      <div className="card p-6 mb-6 text-center">
        <div className="relative w-24 h-24 mx-auto mb-4">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Avatar"
              className="w-full h-full rounded-full object-cover border-4 border-primary-100"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-primary-100 flex items-center justify-center border-4 border-primary-100">
              <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Ganti avatar"
            />
          </label>
        </div>
        <div className="flex items-center justify-center gap-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="input-field w-auto text-center text-lg font-medium bg-transparent border-none focus:ring-0 px-2"
            placeholder="Nama kamu"
            maxLength={30}
          />
          <button onClick={handleNameSave} className="btn-primary text-sm px-4 py-2">Simpan</button>
        </div>
      </div>

      {/* Hedera Account Info */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-medium text-sand-900 mb-4 flex items-center gap-2">
          <span className="text-xl">🔗</span> Hedera Testnet Account
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-sand-500">Account ID</span>
            <code className="text-sand-900 font-mono bg-sand-100 px-2 py-1 rounded">{HEDERA_ACCOUNT_ID}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-sand-500">EVM Address</span>
            <code className="text-sand-900 font-mono bg-sand-100 px-2 py-1 rounded">{hedereEvmAddress}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-sand-500">Network</span>
            <span className="text-sand-900 capitalize">{HEDERA_NETWORK}</span>
          </div>
          <div className="flex justify-between pt-3 border-t border-sand-200">
            <span className="text-sand-500">HBAR Balance</span>
            <span className={`font-mono ${loading ? 'text-sand-400' : 'text-primary-600'}`}>
              {loading ? 'Memuat...' : hbarBalance}
            </span>
          </div>
        </div>
        <button
          onClick={fetchHbarBalance}
          disabled={loading}
          className="btn-secondary text-sm w-full mt-4"
        >
          {loading ? 'Memuat...' : 'Refresh Balance'}
        </button>
      </div>

      {/* Local Stats */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-sand-900 mb-4">Local Progress</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-sand-50 rounded-xl">
            <p className="text-2xl font-light text-primary-600">{xp.toLocaleString()}</p>
            <p className="text-xs text-sand-500">Total XP</p>
          </div>
          <div className="text-center p-3 bg-sand-50 rounded-xl">
            <p className="text-2xl font-light text-primary-600">
              {localStorage.getItem('ataraxia-stillness-v1') ? '✓' : '✗'}
            </p>
            <p className="text-xs text-sand-500">Data Tersimpan</p>
          </div>
        </div>
      </div>
    </div>
  )
}