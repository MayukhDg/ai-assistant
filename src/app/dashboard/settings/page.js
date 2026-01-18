'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const businessTypes = [
  { value: 'dental_clinic', label: 'Dental Clinic' },
  { value: 'medical_clinic', label: 'Medical Clinic' },
  { value: 'salon', label: 'Hair Salon / Spa' },
  { value: 'consultant', label: 'Consultant / Coach' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fitness', label: 'Fitness / Gym' },
  { value: 'legal', label: 'Law Office' },
  { value: 'other', label: 'Other' },
]

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (No DST)' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
]

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  
  const [business, setBusiness] = useState({
    name: '',
    phone_number: '',
    timezone: 'America/New_York',
    business_type: 'other',
    greeting_message: 'Hello! Thank you for calling. How can I help you today?',
    system_prompt: '',
    slot_duration_minutes: 30,
    buffer_minutes: 10,
    max_advance_days: 30,
    fallback_phone: '',
    fallback_enabled: true,
    working_hours: {
      monday: { start: '09:00', end: '17:00', enabled: true },
      tuesday: { start: '09:00', end: '17:00', enabled: true },
      wednesday: { start: '09:00', end: '17:00', enabled: true },
      thursday: { start: '09:00', end: '17:00', enabled: true },
      friday: { start: '09:00', end: '17:00', enabled: true },
      saturday: { start: '10:00', end: '14:00', enabled: false },
      sunday: { start: '10:00', end: '14:00', enabled: false },
    }
  })
  
  useEffect(() => {
    loadBusiness()
  }, [])
  
  async function loadBusiness() {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (data) {
      setBusiness(prev => ({
        ...prev,
        ...data,
        working_hours: data.working_hours || prev.working_hours
      }))
    }
    
    setLoading(false)
  }
  
  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    
    const { data: { user } } = await supabase.auth.getUser()
    
    // Check if business exists
    const { data: existing } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    const businessData = {
      name: business.name,
      phone_number: business.phone_number || null,
      timezone: business.timezone,
      business_type: business.business_type,
      greeting_message: business.greeting_message,
      system_prompt: business.system_prompt || null,
      slot_duration_minutes: business.slot_duration_minutes,
      buffer_minutes: business.buffer_minutes,
      max_advance_days: business.max_advance_days,
      fallback_phone: business.fallback_phone || null,
      fallback_enabled: business.fallback_enabled,
      working_hours: business.working_hours
    }
    
    let error
    
    if (existing) {
      const result = await supabase
        .from('businesses')
        .update(businessData)
        .eq('id', existing.id)
      error = result.error
    } else {
      const result = await supabase
        .from('businesses')
        .insert({ ...businessData, user_id: user.id })
      error = result.error
    }
    
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      router.refresh()
    }
    
    setSaving(false)
  }
  
  function updateWorkingHours(day, field, value) {
    setBusiness(prev => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day]: {
          ...prev.working_hours[day],
          [field]: value
        }
      }
    }))
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      
      {message && (
        <div className={`rounded-md p-4 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}
      
      <form onSubmit={handleSave} className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Business Information</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Business Name *
              </label>
              <input
                type="text"
                required
                value={business.name}
                onChange={(e) => setBusiness(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Business Type
              </label>
              <select
                value={business.business_type}
                onChange={(e) => setBusiness(prev => ({ ...prev, business_type: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                {businessTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Phone Number (Twilio)
              </label>
              <input
                type="tel"
                placeholder="+15551234567"
                value={business.phone_number || ''}
                onChange={(e) => setBusiness(prev => ({ ...prev, phone_number: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Your Twilio phone number for the AI receptionist
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Timezone
              </label>
              <select
                value={business.timezone}
                onChange={(e) => setBusiness(prev => ({ ...prev, timezone: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                {timezones.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* AI Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">AI Assistant</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Greeting Message
              </label>
              <textarea
                rows={2}
                value={business.greeting_message}
                onChange={(e) => setBusiness(prev => ({ ...prev, greeting_message: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                The first thing callers hear
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Custom Instructions (Optional)
              </label>
              <textarea
                rows={4}
                placeholder="Add any specific instructions for your AI assistant..."
                value={business.system_prompt || ''}
                onChange={(e) => setBusiness(prev => ({ ...prev, system_prompt: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                E.g., "We specialize in cosmetic dentistry. Always mention our free consultation."
              </p>
            </div>
          </div>
        </div>
        
        {/* Working Hours */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Working Hours</h2>
          
          <div className="space-y-3">
            {days.map(day => (
              <div key={day} className="flex items-center space-x-4">
                <div className="w-28">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={business.working_hours[day]?.enabled}
                      onChange={(e) => updateWorkingHours(day, 'enabled', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">{day}</span>
                  </label>
                </div>
                
                {business.working_hours[day]?.enabled && (
                  <>
                    <input
                      type="time"
                      value={business.working_hours[day]?.start || '09:00'}
                      onChange={(e) => updateWorkingHours(day, 'start', e.target.value)}
                      className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={business.working_hours[day]?.end || '17:00'}
                      onChange={(e) => updateWorkingHours(day, 'end', e.target.value)}
                      className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Booking Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Booking Settings</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Slot Duration (minutes)
              </label>
              <input
                type="number"
                min="15"
                max="120"
                step="15"
                value={business.slot_duration_minutes}
                onChange={(e) => setBusiness(prev => ({ ...prev, slot_duration_minutes: parseInt(e.target.value) }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Buffer Between Slots (minutes)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                step="5"
                value={business.buffer_minutes}
                onChange={(e) => setBusiness(prev => ({ ...prev, buffer_minutes: parseInt(e.target.value) }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Max Advance Booking (days)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={business.max_advance_days}
                onChange={(e) => setBusiness(prev => ({ ...prev, max_advance_days: parseInt(e.target.value) }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
        
        {/* Fallback */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Human Fallback</h2>
          
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={business.fallback_enabled}
                onChange={(e) => setBusiness(prev => ({ ...prev, fallback_enabled: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">
                Enable transfer to human when AI cannot help
              </span>
            </label>
            
            {business.fallback_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fallback Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+15559876543"
                  value={business.fallback_phone || ''}
                  onChange={(e) => setBusiness(prev => ({ ...prev, fallback_phone: e.target.value }))}
                  className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Where to transfer calls when AI requests human assistance
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
