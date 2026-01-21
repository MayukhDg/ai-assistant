/**
 * Telephony Provider Utilities
 * 
 * Handles detection and routing between different telephony providers
 * (Twilio for international, Exotel for India).
 */

/**
 * Detect the appropriate telephony provider based on phone number prefix.
 * @param {string} phoneNumber - Phone number in E.164 format (e.g., +919876543210)
 * @returns {'exotel' | 'twilio'} The provider to use
 */
export function getProviderFromNumber(phoneNumber) {
    if (!phoneNumber) return 'twilio'

    // Normalize the phone number
    const normalized = phoneNumber.replace(/\s+/g, '').replace(/-/g, '')

    // Indian numbers start with +91
    if (normalized.startsWith('+91') || normalized.startsWith('91')) {
        return 'exotel'
    }

    // All other numbers use Twilio
    return 'twilio'
}

/**
 * Get the WebSocket URL for the voice server based on provider.
 * @param {'exotel' | 'twilio'} provider - The telephony provider
 * @param {string} businessId - The business ID to pass as parameter
 * @returns {string} The WebSocket URL
 */
export function getVoiceServerUrl(provider, businessId) {
    const baseUrl = process.env.VOICE_SERVER_URL || 'http://localhost:8080'
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://')

    if (provider === 'exotel') {
        return `${wsUrl}/exotel-stream?businessId=${businessId}`
    }

    return `${wsUrl}/media-stream?businessId=${businessId}`
}

/**
 * Validate if a phone number is valid for a specific provider.
 * @param {string} phoneNumber - Phone number to validate
 * @param {'exotel' | 'twilio'} provider - Expected provider
 * @returns {boolean} Whether the number is valid for the provider
 */
export function isValidForProvider(phoneNumber, provider) {
    const detectedProvider = getProviderFromNumber(phoneNumber)
    return detectedProvider === provider
}

/**
 * Format display name for provider.
 * @param {'exotel' | 'twilio'} provider 
 * @returns {string} Human-readable provider name
 */
export function getProviderDisplayName(provider) {
    switch (provider) {
        case 'exotel':
            return 'Exotel (India)'
        case 'twilio':
            return 'Twilio (International)'
        default:
            return 'Unknown'
    }
}
