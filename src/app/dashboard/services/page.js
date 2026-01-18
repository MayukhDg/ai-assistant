'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ServicesPage() {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [businessId, setBusinessId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_minutes: 30,
    price_cents: 0
  })
  
  useEffect(() => {
    loadServices()
  }, [])
  
  async function loadServices() {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (business) {
      setBusinessId(business.id)
      
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', business.id)
        .order('name')
      
      setServices(data || [])
    }
    
    setLoading(false)
  }
  
  async function handleSubmit(e) {
    e.preventDefault()
    
    if (editingService) {
      await supabase
        .from('services')
        .update(formData)
        .eq('id', editingService.id)
    } else {
      await supabase
        .from('services')
        .insert({ ...formData, business_id: businessId })
    }
    
    setShowForm(false)
    setEditingService(null)
    setFormData({ name: '', description: '', duration_minutes: 30, price_cents: 0 })
    loadServices()
  }
  
  async function handleDelete(id) {
    if (confirm('Are you sure you want to delete this service?')) {
      await supabase
        .from('services')
        .delete()
        .eq('id', id)
      
      loadServices()
    }
  }
  
  function startEdit(service) {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description || '',
      duration_minutes: service.duration_minutes,
      price_cents: service.price_cents || 0
    })
    setShowForm(true)
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
      <div className="md:flex md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Services</h1>
        <button
          onClick={() => {
            setEditingService(null)
            setFormData({ name: '', description: '', duration_minutes: 30, price_cents: 0 })
            setShowForm(true)
          }}
          className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add Service
        </button>
      </div>
      
      {/* Service Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {editingService ? 'Edit Service' : 'Add Service'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g., Teeth Cleaning"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Duration (min)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={(formData.price_cents / 100).toFixed(2)}
                    onChange={(e) => setFormData(prev => ({ ...prev, price_cents: Math.round(parseFloat(e.target.value) * 100) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingService ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Services List */}
      <div className="bg-white shadow rounded-lg">
        {services.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {services.map((service) => (
              <li key={service.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-sm font-medium text-gray-900">{service.name}</h3>
                      {!service.is_active && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-sm text-gray-500">{service.description}</p>
                    )}
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span>{service.duration_minutes} min</span>
                      {service.price_cents > 0 && (
                        <>
                          <span className="mx-2">•</span>
                          <span>${(service.price_cents / 100).toFixed(2)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => startEdit(service)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-12 text-center text-gray-500">
            <p>No services added yet.</p>
            <p className="text-sm mt-1">Add services that your business offers for better AI assistance.</p>
          </div>
        )}
      </div>
    </div>
  )
}
