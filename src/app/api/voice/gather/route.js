/**
 * Twilio Voice Gather Webhook
 * 
 * This handles speech input from callers in the webhook-based flow.
 * Twilio POSTs here after the caller speaks.
 * 
 * Flow:
 * 1. Receive transcribed speech from Twilio
 * 2. Send to OpenAI for processing
 * 3. Execute any tool calls (check availability, book, etc.)
 * 4. Return TwiML with the AI response
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processConversation } from '@/lib/services/ai'
import { checkAvailability, bookAppointment, cancelAppointment } from '@/lib/services/booking'
import { generateResponseTwiML } from '@/lib/services/twilio'

export const runtime = 'nodejs'

// In-memory conversation store (use Redis in production)
const conversationStore = new Map()

export async function POST(request) {
  const supabase = createAdminClient()
  const url = new URL(request.url)
  const businessId = url.searchParams.get('businessId')
  const callSid = url.searchParams.get('callSid')
  
  try {
    // Parse Twilio form data
    const formData = await request.formData()
    const body = Object.fromEntries(formData.entries())
    
    const {
      SpeechResult,
      Confidence,
      From
    } = body
    
    console.log(`🎤 Speech received: "${SpeechResult}" (confidence: ${Confidence})`)
    
    if (!businessId) {
      return createErrorResponse('Configuration error')
    }
    
    // Get business details
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()
    
    if (!business) {
      return createErrorResponse('Business not found')
    }
    
    // Get or initialize conversation history
    const conversationKey = `${callSid}`
    let messages = conversationStore.get(conversationKey) || []
    
    // Add user message
    if (SpeechResult) {
      messages.push({ role: 'user', content: SpeechResult })
    }
    
    // Process with AI
    const aiResponse = await processConversation(messages, business)
    
    // Handle tool calls
    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      for (const toolCall of aiResponse.toolCalls) {
        const toolName = toolCall.function.name
        const toolArgs = JSON.parse(toolCall.function.arguments)
        
        console.log(`🔧 Tool call: ${toolName}`, toolArgs)
        
        let toolResult
        
        switch (toolName) {
          case 'check_availability':
            toolResult = await checkAvailability(businessId, toolArgs.date)
            break
            
          case 'book_appointment':
            toolResult = await bookAppointment(businessId, {
              ...toolArgs,
              customer_phone: toolArgs.customer_phone || From
            })
            
            // Update call outcome if booking succeeded
            if (toolResult.success) {
              await supabase
                .from('calls')
                .update({ 
                  outcome: 'booked', 
                  intent_detected: 'book_appointment' 
                })
                .eq('twilio_call_sid', callSid)
            }
            break
            
          case 'cancel_appointment':
            toolResult = await cancelAppointment(businessId, {
              customer_phone: toolArgs.customer_phone || From,
              date: toolArgs.date
            })
            
            if (toolResult.success) {
              await supabase
                .from('calls')
                .update({ 
                  outcome: 'cancelled', 
                  intent_detected: 'cancel' 
                })
                .eq('twilio_call_sid', callSid)
            }
            break
            
          case 'transfer_to_human':
            // Save conversation before transfer
            await saveConversation(supabase, callSid, messages)
            
            const transferMessage = "I'll transfer you to a staff member now. Please hold."
            const twiml = generateResponseTwiML(transferMessage, '', { 
              transfer: business.fallback_phone 
            })
            
            return new NextResponse(twiml, {
              status: 200,
              headers: { 'Content-Type': 'text/xml' }
            })
            
          default:
            toolResult = { error: 'Unknown tool' }
        }
        
        // Add tool result to messages
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [toolCall]
        })
        
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        })
      }
      
      // Get final response after tool calls
      const finalResponse = await processConversation(messages, business)
      
      if (finalResponse.content) {
        messages.push({ role: 'assistant', content: finalResponse.content })
      }
      
      // Store updated conversation
      conversationStore.set(conversationKey, messages)
      
      // Check if conversation should end
      const shouldEnd = finalResponse.content?.toLowerCase().includes('goodbye') ||
                        finalResponse.content?.toLowerCase().includes('have a great day')
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`
      const gatherUrl = `${baseUrl}/api/voice/gather?businessId=${businessId}&callSid=${callSid}`
      
      const twiml = generateResponseTwiML(
        finalResponse.content || "Is there anything else I can help you with?",
        gatherUrl,
        { hangup: shouldEnd }
      )
      
      // Save conversation periodically
      if (messages.length % 5 === 0 || shouldEnd) {
        await saveConversation(supabase, callSid, messages)
      }
      
      return new NextResponse(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }
    
    // No tool calls - just respond
    if (aiResponse.content) {
      messages.push({ role: 'assistant', content: aiResponse.content })
    }
    
    // Store updated conversation
    conversationStore.set(conversationKey, messages)
    
    const shouldEnd = aiResponse.content?.toLowerCase().includes('goodbye') ||
                      aiResponse.content?.toLowerCase().includes('have a great day')
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`
    const gatherUrl = `${baseUrl}/api/voice/gather?businessId=${businessId}&callSid=${callSid}`
    
    const twiml = generateResponseTwiML(
      aiResponse.content || "I'm sorry, I didn't understand. Could you please repeat that?",
      gatherUrl,
      { hangup: shouldEnd }
    )
    
    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })
    
  } catch (err) {
    console.error('Gather error:', err)
    return createErrorResponse('Processing error')
  }
}

function createErrorResponse(message) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I'm sorry, ${message}. Please try again later.</Say>
  <Hangup/>
</Response>`
  
  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  })
}

async function saveConversation(supabase, callSid, messages) {
  const transcript = messages
    .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
    .map(m => `${m.role === 'user' ? 'Caller' : 'AI'}: ${m.content}`)
    .join('\n')
  
  await supabase
    .from('calls')
    .update({ transcript })
    .eq('twilio_call_sid', callSid)
}
