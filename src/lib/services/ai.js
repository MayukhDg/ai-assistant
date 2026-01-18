/**
 * AI Service
 * 
 * Handles AI-related operations for the voice assistant.
 * Used by the webhook-based flow (non-WebSocket).
 */

import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'

// Lazy-initialize OpenAI client to avoid build-time errors
let openaiClient = null

function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openaiClient
}

// Tools schema for function calling
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Check available appointment slots for a given date',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'The date to check availability for (YYYY-MM-DD format)'
          }
        },
        required: ['date']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book an appointment for a caller',
      parameters: {
        type: 'object',
        properties: {
          customer_name: {
            type: 'string',
            description: 'Name of the customer'
          },
          customer_phone: {
            type: 'string', 
            description: 'Phone number of the customer'
          },
          date: {
            type: 'string',
            description: 'Appointment date (YYYY-MM-DD)'
          },
          time: {
            type: 'string',
            description: 'Appointment time (HH:MM in 24hr format)'
          },
          service: {
            type: 'string',
            description: 'Service requested (optional)'
          },
          notes: {
            type: 'string',
            description: 'Additional notes (optional)'
          }
        },
        required: ['customer_name', 'customer_phone', 'date', 'time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Cancel an existing appointment',
      parameters: {
        type: 'object',
        properties: {
          customer_phone: {
            type: 'string',
            description: 'Phone number used for the booking'
          },
          date: {
            type: 'string',
            description: 'Date of appointment to cancel (YYYY-MM-DD)'
          }
        },
        required: ['customer_phone']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'transfer_to_human',
      description: 'Transfer the call to a human staff member when the AI cannot help',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for transfer'
          }
        },
        required: ['reason']
      }
    }
  }
]

/**
 * Build the system prompt for a business
 */
export function buildSystemPrompt(business) {
  const basePrompt = `You are a professional AI receptionist for ${business.name || 'our business'}.

Your responsibilities:
- Answer calls professionally and warmly
- Help callers book, reschedule, or cancel appointments
- Answer questions about services and business hours
- Collect caller information (name, phone, preferred time)
- Confirm all details before finalizing bookings

Business Information:
- Type: ${business.business_type || 'General Business'}
- Timezone: ${business.timezone || 'America/New_York'}
- Slot Duration: ${business.slot_duration_minutes || 30} minutes

Guidelines:
- Be concise and natural - keep responses under 2 sentences when possible
- Always confirm the date and time before booking
- If the caller hasn't provided their name, ask for it
- If you cannot help with something, offer to transfer to a human
- Never make up availability - always use the check_availability function
- Always use book_appointment function to finalize bookings
- Today's date is ${new Date().toISOString().split('T')[0]}`

  return business.system_prompt 
    ? `${basePrompt}\n\nAdditional Instructions:\n${business.system_prompt}`
    : basePrompt
}

/**
 * Process a conversation turn using OpenAI
 * Returns the assistant's response and any tool calls
 */
export async function processConversation(messages, business) {
  const systemPrompt = buildSystemPrompt(business)
  
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    tools: TOOLS,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 300
  })
  
  const message = response.choices[0].message
  
  return {
    content: message.content,
    toolCalls: message.tool_calls || [],
    finishReason: response.choices[0].finish_reason
  }
}

/**
 * Generate a text-to-speech audio for a message
 */
export async function generateSpeech(text, voice = 'alloy') {
  const response = await getOpenAI().audio.speech.create({
    model: 'tts-1',
    voice: voice,
    input: text,
    response_format: 'mp3'
  })
  
  const buffer = Buffer.from(await response.arrayBuffer())
  return buffer
}

/**
 * Transcribe audio to text using Whisper
 */
export async function transcribeAudio(audioBuffer, format = 'webm') {
  const file = new File([audioBuffer], `audio.${format}`, { 
    type: `audio/${format}` 
  })
  
  const response = await getOpenAI().audio.transcriptions.create({
    model: 'whisper-1',
    file: file,
    language: 'en'
  })
  
  return response.text
}

/**
 * Analyze intent from a transcript
 */
export async function analyzeIntent(transcript) {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Analyze the following transcript and extract the primary intent.
Respond with JSON only: { "intent": "book_appointment|reschedule|cancel|inquiry|other", "confidence": 0.0-1.0 }`
      },
      { role: 'user', content: transcript }
    ],
    response_format: { type: 'json_object' },
    temperature: 0
  })
  
  return JSON.parse(response.choices[0].message.content)
}

/**
 * Generate a summary of a call
 */
export async function summarizeCall(transcript) {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Summarize the following call transcript in 1-2 sentences. 
Focus on: caller intent, outcome, and any appointments made/changed.`
      },
      { role: 'user', content: transcript }
    ],
    temperature: 0.3,
    max_tokens: 100
  })
  
  return response.choices[0].message.content
}
