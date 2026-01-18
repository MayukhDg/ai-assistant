/**
 * Booking Service
 * 
 * Handles all appointment-related operations.
 * Used by both the webhook flow and WebSocket handler.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { format, parse, addMinutes, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

/**
 * Check available slots for a given date
 */
export async function checkAvailability(businessId, dateStr) {
  const supabase = createAdminClient()
  
  // Get business settings
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('working_hours, slot_duration_minutes, buffer_minutes, timezone')
    .eq('id', businessId)
    .single()
  
  if (bizError || !business) {
    return { error: 'Business not found', available: false, slots: [] }
  }
  
  // Check for blackout date
  const { data: blackout } = await supabase
    .from('blackout_dates')
    .select('id')
    .eq('business_id', businessId)
    .eq('date', dateStr)
    .single()
  
  if (blackout) {
    return { 
      available: false, 
      message: 'Sorry, we are closed on this date.',
      slots: [] 
    }
  }
  
  // Get day of week
  const date = new Date(dateStr)
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayOfWeek = days[date.getDay()]
  const dayHours = business.working_hours?.[dayOfWeek]
  
  if (!dayHours || !dayHours.enabled) {
    return { 
      available: false, 
      message: `Sorry, we are closed on ${dayOfWeek}s.`,
      slots: [] 
    }
  }
  
  // Get existing appointments for this date
  const dayStart = `${dateStr}T00:00:00`
  const dayEnd = `${dateStr}T23:59:59`
  
  const { data: appointments } = await supabase
    .from('appointments')
    .select('scheduled_at, duration_minutes')
    .eq('business_id', businessId)
    .gte('scheduled_at', dayStart)
    .lte('scheduled_at', dayEnd)
    .in('status', ['confirmed', 'pending'])
  
  // Generate available slots
  const slotDuration = business.slot_duration_minutes || 30
  const buffer = business.buffer_minutes || 10
  const slots = []
  
  const [startHour, startMin] = dayHours.start.split(':').map(Number)
  const [endHour, endMin] = dayHours.end.split(':').map(Number)
  
  let currentMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  while (currentMinutes + slotDuration <= endMinutes) {
    const slotHour = Math.floor(currentMinutes / 60)
    const slotMinute = currentMinutes % 60
    const timeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`
    
    // Check for conflicts
    const slotStart = new Date(`${dateStr}T${timeStr}:00`)
    const slotEnd = addMinutes(slotStart, slotDuration)
    
    const hasConflict = appointments?.some(apt => {
      const aptStart = new Date(apt.scheduled_at)
      const aptEnd = addMinutes(aptStart, apt.duration_minutes || 30)
      return slotStart < aptEnd && slotEnd > aptStart
    })
    
    if (!hasConflict) {
      slots.push(timeStr)
    }
    
    currentMinutes += slotDuration + buffer
  }
  
  return {
    available: slots.length > 0,
    date: dateStr,
    slots,
    message: slots.length > 0
      ? `Available times: ${slots.slice(0, 5).join(', ')}${slots.length > 5 ? ` and ${slots.length - 5} more` : ''}`
      : 'No available slots on this date.'
  }
}

/**
 * Book an appointment
 */
export async function bookAppointment(businessId, { 
  customer_name, 
  customer_phone, 
  date, 
  time, 
  service,
  notes,
  callId 
}) {
  const supabase = createAdminClient()
  
  // First verify the slot is still available
  const availability = await checkAvailability(businessId, date)
  if (!availability.slots.includes(time)) {
    return { 
      success: false, 
      error: 'This time slot is no longer available. Please choose another time.' 
    }
  }
  
  // Get or create customer
  let customerId = null
  
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('business_id', businessId)
    .eq('phone', customer_phone)
    .single()
  
  if (existingCustomer) {
    customerId = existingCustomer.id
    
    // Update name if provided
    if (customer_name) {
      await supabase
        .from('customers')
        .update({ name: customer_name })
        .eq('id', customerId)
    }
  } else {
    const { data: newCustomer } = await supabase
      .from('customers')
      .insert({
        business_id: businessId,
        phone: customer_phone,
        name: customer_name
      })
      .select()
      .single()
    
    if (newCustomer) {
      customerId = newCustomer.id
    }
  }
  
  // Get service ID if service name provided
  let serviceId = null
  if (service) {
    const { data: serviceData } = await supabase
      .from('services')
      .select('id, duration_minutes')
      .eq('business_id', businessId)
      .ilike('name', `%${service}%`)
      .single()
    
    if (serviceData) {
      serviceId = serviceData.id
    }
  }
  
  // Get business slot duration and timezone
  const { data: business } = await supabase
    .from('businesses')
    .select('slot_duration_minutes, timezone')
    .eq('id', businessId)
    .single()
  
  // Create appointment with proper timezone
  // Convert local time to UTC for storage
  const localDateTime = `${date}T${time}:00`
  const timezone = business?.timezone || 'America/New_York'
  const scheduledAt = fromZonedTime(new Date(localDateTime), timezone).toISOString()
  
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      service_id: serviceId,
      call_id: callId || null,
      customer_name,
      customer_phone,
      scheduled_at: scheduledAt,
      duration_minutes: business?.slot_duration_minutes || 30,
      status: 'confirmed',
      notes: notes || null
    })
    .select()
    .single()
  
  if (error) {
    console.error('Booking error:', error)
    return { success: false, error: 'Failed to create appointment' }
  }
  
  return {
    success: true,
    message: `Appointment confirmed for ${customer_name} on ${date} at ${time}`,
    appointment
  }
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(businessId, { customer_phone, date, appointmentId }) {
  const supabase = createAdminClient()
  
  let query = supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('business_id', businessId)
    .eq('status', 'confirmed')
  
  if (appointmentId) {
    query = query.eq('id', appointmentId)
  } else if (customer_phone) {
    query = query.eq('customer_phone', customer_phone)
    
    if (date) {
      const dayStart = `${date}T00:00:00`
      const dayEnd = `${date}T23:59:59`
      query = query.gte('scheduled_at', dayStart).lte('scheduled_at', dayEnd)
    }
  } else {
    return { success: false, error: 'Please provide appointment ID or customer phone' }
  }
  
  const { data, error } = await query.select()
  
  if (error) {
    console.error('Cancel error:', error)
    return { success: false, error: 'Failed to cancel appointment' }
  }
  
  if (!data || data.length === 0) {
    return { success: false, error: 'No appointment found to cancel' }
  }
  
  return {
    success: true,
    message: `Cancelled ${data.length} appointment(s)`,
    cancelled: data
  }
}

/**
 * Reschedule an appointment
 */
export async function rescheduleAppointment(businessId, { 
  customer_phone, 
  oldDate,
  newDate, 
  newTime 
}) {
  // First cancel the old appointment
  const cancelResult = await cancelAppointment(businessId, { 
    customer_phone, 
    date: oldDate 
  })
  
  if (!cancelResult.success) {
    return cancelResult
  }
  
  // Get customer info from cancelled appointment
  const cancelled = cancelResult.cancelled[0]
  
  // Book new appointment
  const bookResult = await bookAppointment(businessId, {
    customer_name: cancelled.customer_name,
    customer_phone: cancelled.customer_phone,
    date: newDate,
    time: newTime
  })
  
  if (!bookResult.success) {
    // TODO: Restore the cancelled appointment if rebooking fails
    return bookResult
  }
  
  return {
    success: true,
    message: `Appointment rescheduled from ${oldDate} to ${newDate} at ${newTime}`,
    appointment: bookResult.appointment
  }
}

/**
 * Get upcoming appointments for a customer
 */
export async function getCustomerAppointments(businessId, customerPhone) {
  const supabase = createAdminClient()
  
  const now = new Date().toISOString()
  
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      scheduled_at,
      duration_minutes,
      status,
      customer_name,
      services (name)
    `)
    .eq('business_id', businessId)
    .eq('customer_phone', customerPhone)
    .gte('scheduled_at', now)
    .eq('status', 'confirmed')
    .order('scheduled_at', { ascending: true })
  
  if (error) {
    return { appointments: [] }
  }
  
  return { appointments: data || [] }
}

/**
 * Get appointments for a business (dashboard)
 */
export async function getBusinessAppointments(businessId, { 
  startDate, 
  endDate,
  status 
} = {}) {
  const supabase = createAdminClient()
  
  let query = supabase
    .from('appointments')
    .select(`
      *,
      customers (id, name, phone, email),
      services (id, name, duration_minutes, price_cents)
    `)
    .eq('business_id', businessId)
    .order('scheduled_at', { ascending: true })
  
  if (startDate) {
    query = query.gte('scheduled_at', `${startDate}T00:00:00`)
  }
  
  if (endDate) {
    query = query.lte('scheduled_at', `${endDate}T23:59:59`)
  }
  
  if (status) {
    query = query.eq('status', status)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching appointments:', error)
    return { appointments: [] }
  }
  
  return { appointments: data || [] }
}
