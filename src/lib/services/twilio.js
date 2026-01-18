/**
 * Twilio Service
 * 
 * Helper functions for Twilio integration.
 */

import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

// Create Twilio client
export function getTwilioClient() {
  return twilio(accountSid, authToken)
}

/**
 * Validate that a request came from Twilio
 */
export function validateTwilioRequest(request, body, url) {
  const signature = request.headers.get('x-twilio-signature')
  
  if (!signature) {
    return false
  }
  
  return twilio.validateRequest(
    authToken,
    signature,
    url,
    body
  )
}

/**
 * Generate TwiML response for initial call greeting
 */
export function generateGreetingTwiML(greeting, gatherUrl) {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response = new VoiceResponse()
  
  const gather = response.gather({
    input: 'speech',
    action: gatherUrl,
    method: 'POST',
    speechTimeout: 'auto',
    language: 'en-US'
  })
  
  gather.say({ voice: 'Polly.Joanna' }, greeting)
  
  // If no input, repeat
  response.redirect({ method: 'POST' }, gatherUrl)
  
  return response.toString()
}

/**
 * Generate TwiML response for conversation continuation
 */
export function generateResponseTwiML(message, gatherUrl, options = {}) {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response = new VoiceResponse()
  
  if (options.hangup) {
    response.say({ voice: 'Polly.Joanna' }, message)
    response.hangup()
    return response.toString()
  }
  
  if (options.transfer) {
    response.say({ voice: 'Polly.Joanna' }, message)
    response.dial(options.transfer)
    return response.toString()
  }
  
  const gather = response.gather({
    input: 'speech',
    action: gatherUrl,
    method: 'POST',
    speechTimeout: 'auto',
    language: 'en-US'
  })
  
  gather.say({ voice: 'Polly.Joanna' }, message)
  
  // Timeout handling
  response.say({ voice: 'Polly.Joanna' }, "I didn't catch that. Please try again.")
  response.redirect({ method: 'POST' }, gatherUrl)
  
  return response.toString()
}

/**
 * Generate TwiML for WebSocket Media Stream connection
 * This is used for the real-time voice flow
 */
export function generateMediaStreamTwiML(websocketUrl, businessId, callerNumber, businessNumber) {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response = new VoiceResponse()
  
  // Brief pause before connecting
  response.pause({ length: 1 })
  
  // Connect to WebSocket for bidirectional audio streaming
  const connect = response.connect()
  const stream = connect.stream({
    url: `${websocketUrl}?businessId=${businessId}`
  })
  
  // Pass custom parameters to the WebSocket
  stream.parameter({ name: 'businessId', value: businessId })
  stream.parameter({ name: 'from', value: callerNumber })
  stream.parameter({ name: 'to', value: businessNumber })
  
  return response.toString()
}

/**
 * Send an SMS message
 */
export async function sendSMS(to, from, body) {
  const client = getTwilioClient()
  
  try {
    const message = await client.messages.create({
      body,
      from,
      to
    })
    
    return { success: true, sid: message.sid }
  } catch (error) {
    console.error('SMS error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Purchase a phone number for a business
 */
export async function purchasePhoneNumber(areaCode, voiceUrl, smsUrl) {
  const client = getTwilioClient()
  
  try {
    // Search for available numbers
    const availableNumbers = await client.availablePhoneNumbers('US')
      .local
      .list({ areaCode, limit: 1 })
    
    if (availableNumbers.length === 0) {
      return { success: false, error: 'No numbers available in this area code' }
    }
    
    // Purchase the number
    const number = await client.incomingPhoneNumbers.create({
      phoneNumber: availableNumbers[0].phoneNumber,
      voiceUrl,
      smsUrl
    })
    
    return { 
      success: true, 
      phoneNumber: number.phoneNumber,
      sid: number.sid
    }
  } catch (error) {
    console.error('Purchase error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update webhook URLs for a phone number
 */
export async function updatePhoneNumberWebhooks(phoneNumberSid, voiceUrl, smsUrl) {
  const client = getTwilioClient()
  
  try {
    await client.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl,
      smsUrl
    })
    
    return { success: true }
  } catch (error) {
    console.error('Update error:', error)
    return { success: false, error: error.message }
  }
}
