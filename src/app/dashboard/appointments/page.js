import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function AppointmentsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get business
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .single()
  
  if (!business) {
    return <div>Please set up your business first.</div>
  }
  
  // Get appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      *,
      services (name)
    `)
    .eq('business_id', business.id)
    .order('scheduled_at', { ascending: true })
  
  const upcomingAppointments = appointments?.filter(
    apt => new Date(apt.scheduled_at) >= new Date() && apt.status === 'confirmed'
  ) || []
  
  const pastAppointments = appointments?.filter(
    apt => new Date(apt.scheduled_at) < new Date() || apt.status !== 'confirmed'
  ) || []
  
  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
      </div>
      
      {/* Upcoming Appointments */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Upcoming ({upcomingAppointments.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {upcomingAppointments.length > 0 ? (
            upcomingAppointments.map((apt) => (
              <div key={apt.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900">
                        {apt.customer_name}
                      </p>
                      {apt.services?.name && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {apt.services.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{apt.customer_phone}</p>
                    {apt.notes && (
                      <p className="mt-1 text-sm text-gray-500 italic">{apt.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(apt.scheduled_at), 'MMM d, yyyy')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(apt.scheduled_at), 'h:mm a')}
                    </p>
                    <p className="text-xs text-gray-400">{apt.duration_minutes} min</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              No upcoming appointments
            </div>
          )}
        </div>
      </div>
      
      {/* Past/Cancelled Appointments */}
      {pastAppointments.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-500">
              Past & Cancelled ({pastAppointments.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {pastAppointments.slice(0, 10).map((apt) => (
              <div key={apt.id} className="px-4 py-4 sm:px-6 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {apt.customer_name}
                    </p>
                    <p className="text-sm text-gray-500">{apt.customer_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {format(new Date(apt.scheduled_at), 'MMM d, h:mm a')}
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      apt.status === 'completed' ? 'bg-green-100 text-green-800' :
                      apt.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      apt.status === 'no_show' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {apt.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
