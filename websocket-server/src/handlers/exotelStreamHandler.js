/**
 * Exotel Stream Handler
 * 
 * This handles the WebSocket connection from Exotel's Voicebot applet.
 * Exotel sends audio packets (PCM 16-bit, 8kHz) which we forward to OpenAI's
 * Realtime API for processing.
 * 
 * Flow:
 * 1. Exotel connects with call metadata via 'start' event
 * 2. We connect to OpenAI Realtime API
 * 3. Audio flows: Exotel -> Here -> OpenAI -> Here -> Exotel
 * 
 * Key difference from Twilio:
 * - Audio format: PCM 16-bit (Exotel) vs g711_ulaw (Twilio)
 * - OpenAI supports pcm16 natively, so we can use it directly
 */

const WebSocket = require('ws')
const { createClient } = require('@supabase/supabase-js')

// Supabase admin client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

// OpenAI Realtime API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17'

// System prompt for the AI receptionist (shared with Twilio handler)
const getSystemPrompt = (business) => `
You are a professional AI receptionist for ${business.name || 'our business'}. 

Your responsibilities:
- Answer calls professionally and warmly
- Help callers book, reschedule, or cancel appointments
- Answer questions about services and business hours
- Collect caller information (name, phone, preferred time)
- Confirm all details before finalizing bookings

Business Information:
- Type: ${business.business_type || 'General Business'}
- Working Hours: ${JSON.stringify(business.working_hours)}
- Slot Duration: ${business.slot_duration_minutes || 30} minutes

Guidelines:
- Be concise and natural in conversation
- Always confirm the date and time before booking
- If you cannot help, offer to transfer to a human
- Never make up availability - use the check_availability tool
- Always use book_appointment tool to finalize bookings

${business.system_prompt || ''}
`

// Tools available to the AI
const TOOLS = [
    {
        type: 'function',
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
    },
    {
        type: 'function',
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
    },
    {
        type: 'function',
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
    },
    {
        type: 'function',
        name: 'transfer_to_human',
        description: 'Transfer the call to a human staff member',
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
]

async function handleExotelStream(connection, req) {
    const socket = connection.socket

    // State for this call
    let streamSid = null
    let callSid = null
    let businessId = null
    let business = null
    let callId = null
    let openaiWs = null
    let transcript = []
    let sequenceNumber = 0

    // Parse custom parameters from URL
    const url = new URL(req.url, `http://${req.headers.host}`)
    businessId = url.searchParams.get('businessId')

    console.log('📞 Exotel stream connection initiated')
    console.log(`   Business ID from URL: ${businessId}`)

    socket.on('message', async (message) => {
        try {
            const msgString = message.toString()
            let data
            try {
                data = JSON.parse(msgString)
            } catch (e) {
                console.error('❌ Error parsing Exotel message:', msgString.substring(0, 100))
                return
            }

            switch (data.event) {
                case 'connected':
                    console.log('📱 Exotel WebSocket connected (event received)')
                    break

                case 'start':
                    // Call started - get metadata and connect to OpenAI
                    streamSid = data.start?.stream_sid || data.stream_sid
                    callSid = data.start?.call_sid

                    // Get business ID from custom parameters if not in URL
                    if (!businessId && data.start?.custom_parameters?.businessId) {
                        businessId = data.start.custom_parameters.businessId
                    }

                    console.log(`📞 Exotel call started: ${callSid}`)
                    console.log(`   Stream SID: ${streamSid}`)
                    console.log(`   Business ID: ${businessId}`)
                    console.log(`   From: ${data.start?.from}`)
                    console.log(`   To: ${data.start?.to}`)

                    // Fetch business details
                    if (businessId) {
                        const { data: bizData } = await supabase
                            .from('businesses')
                            .select('*')
                            .eq('id', businessId)
                            .single()
                        business = bizData
                    }

                    // Create call record in database
                    const { data: callData } = await supabase
                        .from('calls')
                        .insert({
                            business_id: businessId,
                            exotel_call_sid: callSid,
                            provider: 'exotel',
                            from_number: data.start?.from || 'unknown',
                            to_number: data.start?.to || 'unknown',
                            started_at: new Date().toISOString()
                        })
                        .select()
                        .single()

                    if (callData) {
                        callId = callData.id
                    }

                    // Connect to OpenAI Realtime API
                    console.log('🔗 Protocol: wss, Host: api.openai.com (Exotel)')
                    if (!OPENAI_API_KEY) {
                        console.error('❌ CRITICAL: OPENAI_API_KEY is missing on server!')
                        socket.close()
                        return
                    }

                    try {
                        openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
                            headers: {
                                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                                'OpenAI-Beta': 'realtime=v1'
                            }
                        })
                    } catch (wsErr) {
                        console.error('❌ Failed to create OpenAI WebSocket (Exotel):', wsErr.message)
                        socket.close()
                        return
                    }

                    openaiWs.on('open', () => {
                        console.log('🤖 Connected to OpenAI Realtime API (Exotel)')

                        // Configure the session - use pcm16 for Exotel
                        openaiWs.send(JSON.stringify({
                            type: 'session.update',
                            session: {
                                modalities: ['text', 'audio'],
                                instructions: getSystemPrompt(business || {}),
                                voice: 'alloy',
                                input_audio_format: 'pcm16',  // Exotel sends PCM 16-bit
                                output_audio_format: 'pcm16', // Send back PCM 16-bit
                                input_audio_transcription: {
                                    model: 'whisper-1'
                                },
                                turn_detection: {
                                    type: 'server_vad',
                                    threshold: 0.5,
                                    prefix_padding_ms: 300,
                                    silence_duration_ms: 500
                                },
                                tools: TOOLS,
                                tool_choice: 'auto'
                            }
                        }))

                        // Send initial greeting
                        openaiWs.send(JSON.stringify({
                            type: 'response.create',
                            response: {
                                modalities: ['text', 'audio'],
                                instructions: 'Greet the caller warmly and ask how you can help them today.'
                            }
                        }))
                    })

                    openaiWs.on('message', async (openaiMessage) => {
                        try {
                            const response = JSON.parse(openaiMessage.toString())

                            switch (response.type) {
                                case 'response.audio.delta':
                                    // Send audio back to Exotel
                                    if (response.delta) {
                                        sequenceNumber++
                                        socket.send(JSON.stringify({
                                            event: 'media',
                                            sequence_number: sequenceNumber,
                                            stream_sid: streamSid,
                                            media: {
                                                chunk: response.delta,  // Exotel uses 'chunk' not 'payload'
                                                timestamp: Date.now()
                                            }
                                        }))
                                    }
                                    break

                                case 'response.audio.done':
                                    // Send mark to track when audio is done playing
                                    sequenceNumber++
                                    socket.send(JSON.stringify({
                                        event: 'mark',
                                        sequence_number: sequenceNumber,
                                        stream_sid: streamSid,
                                        mark: {
                                            name: `response-${Date.now()}`
                                        }
                                    }))
                                    break

                                case 'response.audio_transcript.done':
                                    console.log(`🤖 AI: ${response.transcript}`)
                                    transcript.push({ role: 'assistant', content: response.transcript })
                                    break

                                case 'conversation.item.input_audio_transcription.completed':
                                    console.log(`👤 User: ${response.transcript}`)
                                    transcript.push({ role: 'user', content: response.transcript })
                                    break

                                case 'response.function_call_arguments.done':
                                    const toolName = response.name
                                    const toolArgs = JSON.parse(response.arguments)

                                    console.log(`🔧 Tool call: ${toolName}`, toolArgs)

                                    const result = await handleToolCall(toolName, toolArgs, {
                                        businessId,
                                        callId,
                                        streamSid,
                                        socket
                                    })

                                    // Send tool result back to OpenAI
                                    openaiWs.send(JSON.stringify({
                                        type: 'conversation.item.create',
                                        item: {
                                            type: 'function_call_output',
                                            call_id: response.call_id,
                                            output: JSON.stringify(result)
                                        }
                                    }))

                                    // Trigger response after tool call
                                    openaiWs.send(JSON.stringify({
                                        type: 'response.create'
                                    }))
                                    break

                                case 'error':
                                    console.error('OpenAI error:', response.error)
                                    break
                            }
                        } catch (err) {
                            console.error('Error processing OpenAI message:', err)
                        }
                    })

                    openaiWs.on('close', () => {
                        console.log('🤖 OpenAI connection closed (Exotel)')
                    })

                    openaiWs.on('error', (err) => {
                        console.error('OpenAI WebSocket error:', err)
                    })
                    break

                case 'media':
                    // Forward audio to OpenAI
                    // Exotel sends audio in data.media.chunk (base64 PCM)
                    if (openaiWs && openaiWs.readyState === WebSocket.OPEN && data.media?.chunk) {
                        openaiWs.send(JSON.stringify({
                            type: 'input_audio_buffer.append',
                            audio: data.media.chunk
                        }))
                    }
                    break

                case 'dtmf':
                    // Handle DTMF tones if needed
                    console.log(`🔢 DTMF received: ${data.dtmf?.digit}`)
                    break

                case 'stop':
                    console.log('📴 Exotel call ended')
                    console.log(`   Reason: ${data.stop?.reason}`)

                    // Update call record
                    if (callId) {
                        await supabase
                            .from('calls')
                            .update({
                                ended_at: new Date().toISOString(),
                                transcript: transcript.map(t => `${t.role}: ${t.content}`).join('\n')
                            })
                            .eq('id', callId)
                    }

                    // Close OpenAI connection
                    if (openaiWs) {
                        openaiWs.close()
                    }
                    break
            }
        } catch (err) {
            console.error('Error handling Exotel message:', err)
        }
    })

    socket.on('close', async () => {
        console.log('📱 Exotel connection closed')

        // Cleanup
        if (openaiWs) {
            openaiWs.close()
        }

        // Final update to call record
        if (callId) {
            await supabase
                .from('calls')
                .update({
                    ended_at: new Date().toISOString(),
                    transcript: transcript.map(t => `${t.role}: ${t.content}`).join('\n')
                })
                .eq('id', callId)
        }
    })

    socket.on('error', (err) => {
        console.error('Exotel WebSocket error:', err)
    })
}

// Handle tool calls from the AI (same as Twilio handler)
async function handleToolCall(toolName, args, context) {
    const { businessId, callId } = context

    switch (toolName) {
        case 'check_availability':
            return await checkAvailability(businessId, args.date)

        case 'book_appointment':
            return await bookAppointment(businessId, callId, args)

        case 'cancel_appointment':
            return await cancelAppointment(businessId, args)

        case 'transfer_to_human':
            return {
                success: true,
                message: 'Transferring to human staff. Please hold.'
            }

        default:
            return { error: 'Unknown tool' }
    }
}

// Check available slots for a date
async function checkAvailability(businessId, date) {
    try {
        const { data: business } = await supabase
            .from('businesses')
            .select('working_hours, slot_duration_minutes, buffer_minutes')
            .eq('id', businessId)
            .single()

        if (!business) {
            return { error: 'Business not found' }
        }

        const startOfDay = `${date}T00:00:00`
        const endOfDay = `${date}T23:59:59`

        const { data: appointments } = await supabase
            .from('appointments')
            .select('scheduled_at, duration_minutes')
            .eq('business_id', businessId)
            .gte('scheduled_at', startOfDay)
            .lte('scheduled_at', endOfDay)
            .in('status', ['confirmed', 'pending'])

        const { data: blackout } = await supabase
            .from('blackout_dates')
            .select('id')
            .eq('business_id', businessId)
            .eq('date', date)
            .single()

        if (blackout) {
            return {
                available: false,
                message: 'Sorry, we are closed on this date.',
                slots: []
            }
        }

        const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' })
        const dayHours = business.working_hours?.[dayOfWeek]

        if (!dayHours || !dayHours.enabled) {
            return {
                available: false,
                message: 'Sorry, we are closed on this day.',
                slots: []
            }
        }

        const slotDuration = business.slot_duration_minutes || 30
        const buffer = business.buffer_minutes || 10
        const slots = []

        let [startHour, startMin] = dayHours.start.split(':').map(Number)
        let [endHour, endMin] = dayHours.end.split(':').map(Number)

        let currentTime = startHour * 60 + startMin
        const endTime = endHour * 60 + endMin

        while (currentTime + slotDuration <= endTime) {
            const slotHour = Math.floor(currentTime / 60)
            const slotMinute = currentTime % 60
            const slotTimeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`

            const slotStart = new Date(`${date}T${slotTimeStr}:00`)
            const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000)

            const hasConflict = appointments?.some(apt => {
                const aptStart = new Date(apt.scheduled_at)
                const aptEnd = new Date(aptStart.getTime() + (apt.duration_minutes || 30) * 60 * 1000)
                return slotStart < aptEnd && slotEnd > aptStart
            })

            if (!hasConflict) {
                slots.push(slotTimeStr)
            }

            currentTime += slotDuration + buffer
        }

        return {
            available: slots.length > 0,
            date: date,
            slots: slots,
            message: slots.length > 0
                ? `Available times on ${date}: ${slots.slice(0, 5).join(', ')}${slots.length > 5 ? ` and ${slots.length - 5} more` : ''}`
                : 'No available slots on this date.'
        }
    } catch (err) {
        console.error('Error checking availability:', err)
        return { error: 'Failed to check availability' }
    }
}

// Book an appointment
async function bookAppointment(businessId, callId, args) {
    try {
        const { customer_name, customer_phone, date, time, service, notes } = args

        let { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('business_id', businessId)
            .eq('phone', customer_phone)
            .single()

        if (!customer) {
            const { data: newCustomer } = await supabase
                .from('customers')
                .insert({
                    business_id: businessId,
                    phone: customer_phone,
                    name: customer_name
                })
                .select()
                .single()
            customer = newCustomer
        }

        const scheduledAt = `${date}T${time}:00`

        const { data: appointment, error } = await supabase
            .from('appointments')
            .insert({
                business_id: businessId,
                customer_id: customer?.id,
                call_id: callId,
                customer_name,
                customer_phone,
                scheduled_at: scheduledAt,
                status: 'confirmed',
                notes: notes || null
            })
            .select()
            .single()

        if (error) {
            console.error('Booking error:', error)
            return { success: false, error: 'Failed to book appointment' }
        }

        if (callId) {
            await supabase
                .from('calls')
                .update({ outcome: 'booked', intent_detected: 'book_appointment' })
                .eq('id', callId)
        }

        return {
            success: true,
            message: `Appointment confirmed for ${customer_name} on ${date} at ${time}`,
            appointment_id: appointment.id
        }
    } catch (err) {
        console.error('Error booking appointment:', err)
        return { success: false, error: 'Failed to book appointment' }
    }
}

// Cancel an appointment
async function cancelAppointment(businessId, args) {
    try {
        const { customer_phone, date } = args

        let query = supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('business_id', businessId)
            .eq('customer_phone', customer_phone)
            .eq('status', 'confirmed')

        if (date) {
            const startOfDay = `${date}T00:00:00`
            const endOfDay = `${date}T23:59:59`
            query = query.gte('scheduled_at', startOfDay).lte('scheduled_at', endOfDay)
        }

        const { data, error } = await query.select()

        if (error || !data || data.length === 0) {
            return { success: false, message: 'No appointment found to cancel' }
        }

        return {
            success: true,
            message: `Appointment cancelled successfully`,
            cancelled_count: data.length
        }
    } catch (err) {
        console.error('Error cancelling appointment:', err)
        return { success: false, error: 'Failed to cancel appointment' }
    }
}

module.exports = { handleExotelStream }
