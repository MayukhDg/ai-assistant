/**
 * Twilio Voice Status Webhook
 * 
 * Twilio POSTs here when a call status changes (ringing, answered, completed, etc.)
 * This is useful for tracking call durations and outcomes.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { summarizeCall } from '@/lib/services/ai'

export const runtime = 'nodejs'

export async function POST(request) {
  const supabase = createAdminClient()
  
  try {
    const formData = await request.formData()
    const body = Object.fromEntries(formData.entries())
    
    const {
      CallSid,
      CallStatus,
      CallDuration,
      RecordingUrl
    } = body
    
    console.log(`📊 Call status update: ${CallSid} -> ${CallStatus}`)
    
    // Update call record based on status
    if (CallStatus === 'completed') {
      // Get the call to check if it has a transcript
      const { data: call } = await supabase
        .from('calls')
        .select('transcript, outcome')
        .eq('twilio_call_sid', CallSid)
        .single()
      
      const updates = {
        ended_at: new Date().toISOString(),
        duration_seconds: parseInt(CallDuration) || 0,
        recording_url: RecordingUrl || null
      }
      
      // Generate summary if we have a transcript
      if (call?.transcript && !call?.outcome) {
        try {
          const summary = await summarizeCall(call.transcript)
          updates.summary = summary
        } catch (err) {
          console.error('Summary generation error:', err)
        }
      }
      
      // If no outcome was set, mark as inquiry
      if (!call?.outcome) {
        updates.outcome = 'inquiry'
      }
      
      await supabase
        .from('calls')
        .update(updates)
        .eq('twilio_call_sid', CallSid)
    }
    
    if (CallStatus === 'no-answer' || CallStatus === 'busy' || CallStatus === 'failed') {
      await supabase
        .from('calls')
        .update({
          ended_at: new Date().toISOString(),
          outcome: 'missed'
        })
        .eq('twilio_call_sid', CallSid)
    }
    
    return new NextResponse('OK', { status: 200 })
    
  } catch (err) {
    console.error('Status webhook error:', err)
    return new NextResponse('Error', { status: 500 })
  }
}
