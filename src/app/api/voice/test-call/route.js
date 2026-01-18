/**
 * Test Call Endpoint
 * Makes Twilio call YOUR phone and connects to the AI
 * 
 * Usage: POST /api/voice/test-call
 * Body: { "phoneNumber": "+919876543210" }
 */

import { NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request) {
  try {
    const { phoneNumber } = await request.json()
    
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }
    
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
    
    const call = await client.calls.create({
      to: phoneNumber,
      from: '+14156344586', // Your Twilio number (California)
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/incoming`,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/status`,
      statusCallbackEvent: ['completed']
    })
    
    return NextResponse.json({
      success: true,
      message: `Calling ${phoneNumber}...`,
      callSid: call.sid
    })
    
  } catch (error) {
    console.error('Test call error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST your phone number to receive a test call',
    example: { phoneNumber: '+919876543210' }
  })
}
