require('dotenv').config()

const Fastify = require('fastify')
const fastifyWebsocket = require('@fastify/websocket')
const { handleMediaStream } = require('./handlers/mediaStreamHandler')
const { handleRealtimeStream } = require('./handlers/realtimeHandler')

const fastify = Fastify({ 
  logger: true,
  trustProxy: true
})

// Register WebSocket plugin
fastify.register(fastifyWebsocket)

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

// Twilio Media Streams WebSocket endpoint
// This receives raw audio from Twilio and processes it
fastify.register(async function (fastify) {
  fastify.get('/media-stream', { websocket: true }, (connection, req) => {
    console.log('📞 New Twilio Media Stream connection')
    handleMediaStream(connection, req)
  })
})

// OpenAI Realtime API WebSocket endpoint (for direct browser connections if needed)
fastify.register(async function (fastify) {
  fastify.get('/realtime', { websocket: true }, (connection, req) => {
    console.log('🤖 New Realtime API connection')
    handleRealtimeStream(connection, req)
  })
})

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 8080
    const host = process.env.HOST || '0.0.0.0'
    
    await fastify.listen({ port, host })
    console.log(`🚀 Voice server running on ${host}:${port}`)
    console.log(`   - Media Stream: ws://${host}:${port}/media-stream`)
    console.log(`   - Health Check: http://${host}:${port}/health`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
