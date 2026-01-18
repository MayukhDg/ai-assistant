/**
 * OpenAI Realtime API Handler
 * 
 * This handles direct WebSocket connections from browsers or other clients
 * that want to use voice features without going through Twilio.
 * 
 * Useful for testing or browser-based voice interactions.
 */

const WebSocket = require('ws')

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17'

async function handleRealtimeStream(connection, req) {
  const socket = connection.socket
  let openaiWs = null
  
  // Parse query parameters
  const url = new URL(req.url, `http://${req.headers.host}`)
  const businessId = url.searchParams.get('businessId')
  
  console.log('🎙️ Realtime connection started', { businessId })
  
  // Connect to OpenAI
  openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  })
  
  openaiWs.on('open', () => {
    console.log('🤖 Connected to OpenAI Realtime API')
    
    // Notify client
    socket.send(JSON.stringify({
      type: 'connection.ready',
      message: 'Connected to AI'
    }))
  })
  
  openaiWs.on('message', (message) => {
    // Forward all OpenAI messages to client
    try {
      socket.send(message.toString())
    } catch (err) {
      console.error('Error forwarding to client:', err)
    }
  })
  
  openaiWs.on('close', () => {
    console.log('🤖 OpenAI connection closed')
    socket.close()
  })
  
  openaiWs.on('error', (err) => {
    console.error('OpenAI error:', err)
  })
  
  // Handle messages from client
  socket.on('message', (message) => {
    try {
      // Forward to OpenAI
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(message.toString())
      }
    } catch (err) {
      console.error('Error forwarding to OpenAI:', err)
    }
  })
  
  socket.on('close', () => {
    console.log('🎙️ Client disconnected')
    if (openaiWs) {
      openaiWs.close()
    }
  })
  
  socket.on('error', (err) => {
    console.error('Client WebSocket error:', err)
  })
}

module.exports = { handleRealtimeStream }
