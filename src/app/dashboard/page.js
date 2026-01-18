import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get business
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .single()
  
  if (!business) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Welcome!</h2>
        <p className="mt-2 text-gray-600">Let's set up your business profile.</p>
        <Link 
          href="/dashboard/settings"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Set up business
        </Link>
      </div>
    )
  }
  
  // Get today's date range
  const today = new Date()
  const startOfDay = format(today, 'yyyy-MM-dd') + 'T00:00:00'
  const endOfDay = format(today, 'yyyy-MM-dd') + 'T23:59:59'
  
  // Get stats
  const [appointmentsResult, callsResult, todayAppointments] = await Promise.all([
    supabase
      .from('appointments')
      .select('id', { count: 'exact' })
      .eq('business_id', business.id)
      .eq('status', 'confirmed'),
    supabase
      .from('calls')
      .select('id', { count: 'exact' })
      .eq('business_id', business.id),
    supabase
      .from('appointments')
      .select('*')
      .eq('business_id', business.id)
      .gte('scheduled_at', startOfDay)
      .lte('scheduled_at', endOfDay)
      .eq('status', 'confirmed')
      .order('scheduled_at', { ascending: true })
  ])
  
  // Get recent calls
  const { data: recentCalls } = await supabase
    .from('calls')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(5)
  
  const stats = [
    { 
      name: 'Total Appointments', 
      value: appointmentsResult.count || 0,
      href: '/dashboard/appointments'
    },
    { 
      name: 'Total Calls', 
      value: callsResult.count || 0,
      href: '/dashboard/calls'
    },
    { 
      name: 'Calls This Month', 
      value: business.calls_this_month || 0,
      href: '/dashboard/calls'
    },
    { 
      name: 'Bookings This Month', 
      value: business.bookings_this_month || 0,
      href: '/dashboard/appointments'
    },
  ]
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl">
            Welcome back, {business.name}
          </h1>
          {!business.phone_number && (
            <p className="mt-1 text-sm text-amber-600">
              ⚠️ No phone number configured. <Link href="/dashboard/settings" className="underline">Set up your AI receptionist</Link>
            </p>
          )}
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{stat.value}</dd>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Today's Appointments */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Today's Appointments</h2>
            <Link href="/dashboard/appointments" className="text-sm text-blue-600 hover:text-blue-500">
              View all →
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {todayAppointments.data && todayAppointments.data.length > 0 ? (
            todayAppointments.data.map((apt) => (
              <div key={apt.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{apt.customer_name}</p>
                    <p className="text-sm text-gray-500">{apt.customer_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(apt.scheduled_at), 'h:mm a')}
                    </p>
                    <p className="text-sm text-gray-500">{apt.duration_minutes} min</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              No appointments scheduled for today
            </div>
          )}
        </div>
      </div>
      
      {/* Recent Calls */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Recent Calls</h2>
            <Link href="/dashboard/calls" className="text-sm text-blue-600 hover:text-blue-500">
              View all →
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentCalls && recentCalls.length > 0 ? (
            recentCalls.map((call) => (
              <div key={call.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{call.from_number}</p>
                    <p className="text-sm text-gray-500">
                      {call.summary || call.outcome || 'No summary'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      call.outcome === 'booked' ? 'bg-green-100 text-green-800' :
                      call.outcome === 'missed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {call.outcome || 'pending'}
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      {format(new Date(call.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              No calls received yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
