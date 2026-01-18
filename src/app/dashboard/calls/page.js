import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function CallsPage() {
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
  
  // Get calls
  const { data: calls } = await supabase
    .from('calls')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(100)
  
  const outcomeColors = {
    booked: 'bg-green-100 text-green-800',
    rescheduled: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-orange-100 text-orange-800',
    inquiry: 'bg-purple-100 text-purple-800',
    transferred: 'bg-yellow-100 text-yellow-800',
    missed: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800'
  }
  
  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Call History</h1>
        <div className="mt-4 md:mt-0">
          <p className="text-sm text-gray-500">
            Total calls this month: <span className="font-medium">{calls?.length || 0}</span>
          </p>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Caller
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Outcome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Summary
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {calls && calls.length > 0 ? (
              calls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {call.from_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(new Date(call.created_at), 'MMM d, yyyy')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(call.created_at), 'h:mm a')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {call.duration_seconds 
                      ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                      : '-'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      outcomeColors[call.outcome] || 'bg-gray-100 text-gray-800'
                    }`}>
                      {call.outcome || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-500 max-w-xs truncate">
                      {call.summary || '-'}
                    </p>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No calls received yet. Once your AI receptionist is set up, calls will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
