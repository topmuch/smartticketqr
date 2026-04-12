// ============================================================
// 💬 WHATSAPP SERVICE - wa.me links + Cloud API adapter
// ============================================================
// Builds optimized wa.me links for ticket sharing.
// Includes adapter structure for WhatsApp Cloud API (future).
// Handles phone number cleaning, country code management.
// ============================================================

// ============================================================
// TYPES
// ============================================================

export interface WhatsAppMessage {
  phone: string;
  message: string;
  publicUrl?: string;
}

export interface WhatsAppLinkResult {
  url: string;
  phone: string;
  message: string;
  isInternational: boolean;
}

export interface WhatsAppCloudAPIConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion?: string;
}

// ============================================================
// PHONE NUMBER UTILITIES
// ============================================================

/**
 * Clean a phone number to digits only.
 * Handles various formats: +221 77 123 4567, (221)771234567, etc.
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Ensure phone has country code prefix.
 * If phone starts with '0', replaces with the given country code.
 * Default country code: 221 (Senegal).
 */
export function ensureCountryCode(phone: string, defaultCountryCode = '221'): string {
  const cleaned = cleanPhoneNumber(phone);

  // Already has country code (longer than 9 digits or starts with +)
  if (cleaned.length > 9) return cleaned;

  // Starts with 0, replace with country code
  if (cleaned.startsWith('0')) {
    return defaultCountryCode + cleaned.substring(1);
  }

  // Short number, prepend country code
  return defaultCountryCode + cleaned;
}

// ============================================================
// WA.ME LINK BUILDER
// ============================================================

/**
 * Build a wa.me link for sending a ticket via WhatsApp.
 *
 * The message includes:
 * - Ticket holder name
 * - Event name and details
 * - Public ticket URL (for QR code viewing)
 * - Organization branding
 */
export function buildWhatsAppLink(params: {
  phone: string;
  holderName: string;
  eventName: string;
  eventDate: string;
  eventLocation?: string;
  ticketCode: string;
  ticketType: string;
  publicUrl: string;
  orgName?: string;
  countryCode?: string;
}): WhatsAppLinkResult {
  const {
    phone,
    holderName,
    eventName,
    eventDate,
    eventLocation,
    ticketCode,
    ticketType,
    publicUrl,
    orgName,
    countryCode,
  } = params;

  const cleanPhone = ensureCountryCode(phone, countryCode);
  const isInternational = cleanPhone.length > 9;

  // Build the WhatsApp message
  const message = [
    `🎟️ *${orgName || 'SmartTicketQR'} - Votre Ticket*`,
    '',
    `👤 *Passager* : ${holderName}`,
    `🎫 *Événement* : ${eventName}`,
    `📅 *Date* : ${eventDate}`,
    eventLocation ? `📍 *Lieu* : ${eventLocation}` : '',
    `🏷️ *Type* : ${ticketType}`,
    `🔢 *Code* : ${ticketCode}`,
    '',
    `👉 *Voir votre ticket (QR Code)* :`,
    publicUrl,
    '',
    'Ce ticket est personnel et non transférable. Présentez-le à l\'entrée.',
    `Powered by ${orgName || 'SmartTicketQR'} 💚`,
  ]
    .filter(Boolean)
    .join('\n');

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return { url, phone: cleanPhone, message, isInternational };
}

/**
 * Build a simple wa.me link with custom message.
 */
export function buildSimpleWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = ensureCountryCode(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// ============================================================
// WHATSAPP CLOUD API ADAPTER (Future-ready)
// ============================================================

/**
 * Send a message via WhatsApp Cloud API.
 * Requires valid API credentials configured in organization settings.
 *
 * NOTE: This is a stub/adaptor structure. To activate:
 * 1. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_BUSINESS_ID in env
 * 2. Configure webhook endpoint in Meta Business settings
 * 3. Update sendMessage() implementation below
 */
export async function sendWhatsAppCloudMessage(
  config: WhatsAppCloudAPIConfig,
  recipientPhone: string,
  message: string,
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiVersion = config.apiVersion || 'v21.0';
  const baseUrl = `https://graph.facebook.com/${apiVersion}/${config.phoneNumberId}/messages`;

  try {
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: ensureCountryCode(recipientPhone),
      type: 'text',
      text: {
        body: message,
        preview_url: true,
      },
    };

    // If media URL provided, switch to media message type
    if (mediaUrl) {
      body.type = 'image';
      body.image = {
        link: mediaUrl,
        caption: message.substring(0, 1024), // WhatsApp caption limit
      };
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.error) {
      console.error('[WhatsApp Cloud API Error]', data.error);
      return { success: false, error: data.error.message };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error('[WhatsApp Cloud API] Request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if WhatsApp Cloud API is configured for an organization.
 */
export function getWhatsAppCloudConfig(orgSettings?: string): WhatsAppCloudAPIConfig | null {
  if (!orgSettings) return null;

  try {
    const settings = JSON.parse(orgSettings);
    const accessToken = settings.whatsapp_access_token;
    const phoneNumberId = settings.whatsapp_phone_number_id;
    const businessAccountId = settings.whatsapp_business_account_id;

    if (!accessToken || !phoneNumberId || !businessAccountId) return null;

    return {
      accessToken,
      phoneNumberId,
      businessAccountId,
      apiVersion: settings.whatsapp_api_version || 'v21.0',
    };
  } catch {
    return null;
  }
}

/**
 * Generate a plain-text ticket message (for clipboard copy fallback).
 */
export function generateTicketTextMessage(params: {
  holderName: string;
  eventName: string;
  eventDate: string;
  ticketCode: string;
  ticketType: string;
  publicUrl: string;
  orgName?: string;
}): string {
  return [
    `🎟️ ${params.orgName || 'SmartTicketQR'} - Votre Ticket`,
    `Passager : ${params.holderName}`,
    `Événement : ${params.eventName}`,
    `Date : ${params.eventDate}`,
    `Type : ${params.ticketType}`,
    `Code : ${params.ticketCode}`,
    `Voir ticket : ${params.publicUrl}`,
  ].join('\n');
}
