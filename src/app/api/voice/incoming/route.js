/**
 * Twilio Voice Incoming Webhook
 * 
 * This is the entry point for all incoming calls.
 * Twilio will POST here when someone calls a business number.
 * 
 * For real-time streaming: We return TwiML that connects to WebSocket server
 * For webhook-based: We return TwiML with Gather for speech input
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateMediaStreamTwiML, generateGreetingTwiML } from '@/lib/services/twilio'

// Disable body parsing - Twilio sends form-encoded data
export const runtime = 'nodejs'

export async function POST(request) {
  const supabase = createAdminClient()
  
  try {
    // Parse form data from Twilio
    const formData = await request.formData()
    const body = Object.fromEntries(formData.entries())
    
    const {
      CallSid,
      From,
      To,
      CallStatus,
      Direction
    } = body
    
    console.log(`📞 Incoming call: ${CallSid}`)
    console.log(`   From: ${From}`)
    console.log(`   To: ${To}`)
    console.log(`   Direction: ${Direction}`)
    
    // For inbound calls: look up by To (Twilio number)
    // For outbound calls: look up by From (Twilio number)
    const twilioNumber = Direction === 'outbound-api' ? From : To
    
    // Look up business by phone number
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('phone_number', twilioNumber)
      .single()
    
    if (error || !business) {
      console.error('Business not found for number:', To)
      
      // Return a generic message
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, this number is not configured. Please try again later.</Say>
  <Hangup/>
</Response>`
      
      return new NextResponse(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }
    
    // Create call record
    await supabase
      .from('calls')
      .insert({
        business_id: business.id,
        twilio_call_sid: CallSid,
        from_number: From,
        to_number: To,
        started_at: new Date().toISOString()
      })
    
    // Increment call counter
    await supabase
      .from('businesses')
      .update({ calls_this_month: business.calls_this_month + 1 })
      .eq('id', business.id)
    
    // Determine which flow to use based on environment
    const useRealtimeStream = process.env.VOICE_SERVER_URL && process.env.USE_REALTIME_STREAM === 'true'
    
    if (useRealtimeStream) {
      // Use WebSocket-based real-time streaming (low latency)
      const websocketUrl = process.env.VOICE_SERVER_URL.replace('https://', 'wss://').replace('http://', 'ws://')
      const streamUrl = `${websocketUrl}/media-stream`
      
      const twiml = generateMediaStreamTwiML(streamUrl, business.id, From, To)
      
      return new NextResponse(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    } else {
      // Use webhook-based flow (simpler, works with Vercel)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`
      const gatherUrl = `${baseUrl}/api/voice/gather?businessId=${business.id}&callSid=${CallSid}`
      
      const greeting = business.greeting_message || 
        `Hello! Thank you for calling ${business.name}. How can I help you today?`
      
      const twiml = generateGreetingTwiML(greeting, gatherUrl)
      
      return new NextResponse(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }
  } catch (err) {
    console.error('Incoming call error:', err)
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, we're experiencing technical difficulties. Please try again later.</Say>
  <Hangup/>
</Response>`
    
    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })
  }
}
