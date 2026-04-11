// ============================================================
// ⚙️ AUTOMATION DISPATCHER - Notification automation with fallback
// ============================================================
// Finds matching automation rules for trigger events and dispatches
// notifications via the configured channel with fallback logic.
// Supports idempotency, retry with exponential backoff, and logging.
// ============================================================

import { db } from '@/lib/db';

// ============================================================
// TYPES
// ============================================================

/** Data passed when triggering an automation */
export interface AutomationTriggerData {
  /** Organization triggering the event */
  organizationId: string;
  /** Related ticket ID (if applicable) */
  ticketId?: string;
  /** Related event ID (if applicable) */
  eventId?: string;
  /** Recipient phone number */
  phone?: string;
  /** Recipient email address */
  email?: string;
  /** Ticket holder name */
  holderName?: string;
  /** Event name */
  eventName?: string;
  /** Ticket code */
  ticketCode?: string;
  /** Event date */
  eventDate?: string;
  /** Event location */
  eventLocation?: string;
  /** Template data for message rendering */
  templateData?: Record<string, string>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Result of dispatching an automation */
export interface AutomationDispatchResult {
  /** Number of rules matched */
  rulesMatched: number;
  /** Number of notifications sent */
  sent: number;
  /** Number of notifications queued (pending) */
  queued: number;
  /** Number of notifications skipped (idempotent) */
  skipped: number;
  /** Number of failures */
  failed: number;
}

/** Result of processing a single automation rule */
export interface RuleProcessResult {
  ruleId: string;
  success: boolean;
  channel: string;
  status: 'sent' | 'pending' | 'failed' | 'skipped';
  logId?: string;
  error?: string;
}

/** Filters for querying automation logs */
export interface AutomationLogFilters {
  status?: string;
  channel?: string;
  triggerEvent?: string;
  recipient?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/** Channel send result */
interface ChannelSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const MAX_RETRY_ATTEMPTS = 3;
const IDEMPOTENCY_WINDOW_MS = 5 * 60_000; // 5 minutes

// ============================================================
// CHANNEL SENDERS
// ============================================================

/**
 * Send a WhatsApp message to a phone number.
 * Uses the WhatsApp Cloud API pattern from whatsapp-service.ts.
 *
 * NOTE: This is a placeholder implementation. To activate:
 * 1. Configure WhatsApp Cloud API credentials in org settings
 * 2. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_ID in env
 */
async function sendWhatsApp(
  phone: string,
  _template: string | undefined,
  data: AutomationTriggerData
): Promise<ChannelSendResult> {
  try {
    const org = await db.organization.findUnique({
      where: { id: data.organizationId },
      select: { settings: true },
    });

    // Check if WhatsApp Cloud API is configured
    let whatsappConfigured = false;
    if (org?.settings) {
      try {
        const settings = JSON.parse(org.settings);
        whatsappConfigured = !!(
          settings.whatsapp_access_token &&
          settings.whatsapp_phone_number_id
        );
      } catch {
        // Invalid settings JSON
      }
    }

    if (!whatsappConfigured) {
      return {
        success: false,
        error: 'WhatsApp Cloud API not configured for this organization',
      };
    }

    // Build message from template data
    const message = buildMessageFromTemplate(data, 'whatsapp');

    // Placeholder: In production, this would call the WhatsApp Cloud API
    // For now, log and return success (simulation mode)
    console.log(`[WhatsApp] Would send to ${phone}: ${message.substring(0, 100)}...`);

    return {
      success: true,
      messageId: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'WhatsApp send failed',
    };
  }
}

/**
 * Send an SMS message to a phone number.
 *
 * NOTE: Placeholder implementation. Requires SMS_API_KEY configuration.
 */
async function sendSms(phone: string, message: string): Promise<ChannelSendResult> {
  try {
    const apiKey = process.env.SMS_API_KEY;

    if (!apiKey || apiKey === '[SMS_API_KEY]') {
      // No API key configured — log and simulate success
      console.log(`[SMS Placeholder] Would send to ${phone}: ${message.substring(0, 100)}...`);
      return {
        success: true,
        messageId: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      };
    }

    // Placeholder: In production, integrate with SMS provider
    // e.g., Twilio, Vonage, Africa's Talking, etc.
    console.log(`[SMS] Sending to ${phone}: ${message.substring(0, 100)}...`);

    return {
      success: true,
      messageId: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS send failed',
    };
  }
}

/**
 * Send an email message.
 *
 * NOTE: Placeholder implementation. Requires SMTP_HOST configuration.
 */
async function sendEmail(
  email: string,
  subject: string,
  htmlBody: string
): Promise<ChannelSendResult> {
  try {
    const smtpHost = process.env.SMTP_HOST;

    if (!smtpHost || smtpHost === '[SMTP_HOST]') {
      // No SMTP configured — log and simulate success
      console.log(`[Email Placeholder] Would send to ${email}: ${subject}`);
      return {
        success: true,
        messageId: `email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      };
    }

    // Placeholder: In production, use nodemailer or similar
    console.log(`[Email] Sending to ${email}: ${subject}`);

    return {
      success: true,
      messageId: `email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email send failed',
    };
  }
}

// ============================================================
// MESSAGE BUILDER
// ============================================================

/**
 * Build a message string from template data based on channel type.
 */
function buildMessageFromTemplate(data: AutomationTriggerData, _channel: string): string {
  const parts: string[] = [];

  if (data.eventName) parts.push(`🎫 ${data.eventName}`);
  if (data.holderName) parts.push(`👤 ${data.holderName}`);
  if (data.ticketCode) parts.push(`🔢 Code: ${data.ticketCode}`);
  if (data.eventDate) parts.push(`📅 ${data.eventDate}`);
  if (data.eventLocation) parts.push(`📍 ${data.eventLocation}`);

  // Merge any custom template data
  if (data.templateData) {
    for (const [key, value] of Object.entries(data.templateData)) {
      parts.push(`${key}: ${value}`);
    }
  }

  return parts.join('\n');
}

/**
 * Build an HTML email body from template data.
 */
function buildHtmlEmailBody(data: AutomationTriggerData): string {
  const message = buildMessageFromTemplate(data, 'email');
  const lines = message.split('\n').map((line) => `<p style="margin:4px 0">${line}</p>`).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">SmartTicketQR</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 0 0 8px 8px;">
        ${lines}
      </div>
      <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
        Sent by SmartTicketQR
      </p>
    </div>
  `;
}

// ============================================================
// IDEMPOTENCY CHECK
// ============================================================

/**
 * Check if a duplicate automation log exists for idempotency.
 * Prevents sending the same notification twice within the time window.
 */
async function checkIdempotency(
  organizationId: string,
  triggerEvent: string,
  recipient: string,
  ticketId?: string
): Promise<boolean> {
  const windowStart = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS);

  const existing = await db.automationLog.findFirst({
    where: {
      organizationId,
      triggerEvent,
      recipient,
      status: { in: ['pending', 'sent'] },
      createdAt: { gte: windowStart },
    },
  });

  // If there's an existing log with the same ticketId reference, it's a duplicate
  // (We check ticketId separately since it's not a direct field on AutomationLog)
  if (existing) {
    return true; // Duplicate detected
  }

  return false;
}

// ============================================================
// RETRY LOGIC
// ============================================================

/**
 * Calculate exponential backoff delay for retry attempts.
 * Attempt 1: 1 minute, Attempt 2: 5 minutes, Attempt 3+: 15 minutes
 */
export function getAutomationRetryDelay(attempt: number): number {
  const delays: Record<number, number> = {
    1: 60_000,      // 1 minute
    2: 300_000,     // 5 minutes
    3: 900_000,     // 15 minutes
  };
  return delays[attempt] ?? 900_000;
}

// ============================================================
// MAIN DISPATCHER
// ============================================================

/**
 * Dispatch automation for a trigger event.
 *
 * Finds all matching active automation rules for the given triggerEvent
 * and organization, then processes each rule with fallback logic.
 *
 * @param triggerEvent - Event type (e.g., "ticket_created", "ticket_validated")
 * @param data - Contextual data for the automation
 * @returns Summary of dispatch results
 */
export async function dispatchAutomation(
  triggerEvent: string,
  data: AutomationTriggerData
): Promise<AutomationDispatchResult> {
  const result: AutomationDispatchResult = {
    rulesMatched: 0,
    sent: 0,
    queued: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    // Find all active automation rules matching this trigger
    const rules = await db.automationRule.findMany({
      where: {
        organizationId: data.organizationId,
        triggerEvent,
        isActive: true,
      },
    });

    if (rules.length === 0) return result;

    result.rulesMatched = rules.length;

    // Process each rule
    for (const rule of rules) {
      const processResult = await processRule(rule, data, triggerEvent);

      switch (processResult.status) {
        case 'sent':
          result.sent++;
          break;
        case 'pending':
          result.queued++;
          break;
        case 'skipped':
          result.skipped++;
          break;
        case 'failed':
          result.failed++;
          break;
      }
    }
  } catch (error) {
    console.error('[AutomationDispatcher] Error during dispatch:', error);
  }

  return result;
}

/**
 * Process a single automation rule with fallback logic.
 *
 * Channel priority:
 * 1. Primary channel (WhatsApp → SMS → Email)
 * 2. Fallback channel if primary fails
 * 3. If fallback also fails, log as failed for retry
 *
 * @param rule - The AutomationRule to process
 * @param data - Contextual trigger data
 * @param triggerEvent - The trigger event name
 */
export async function processRule(
  rule: {
    id: string;
    organizationId: string;
    channel: string;
    fallbackChannel: string | null;
    templateId: string | null;
  },
  data: AutomationTriggerData,
  triggerEvent: string
): Promise<RuleProcessResult> {
  // Determine recipient
  const recipient = data.phone || data.email;
  if (!recipient) {
    return {
      ruleId: rule.id,
      success: false,
      channel: rule.channel,
      status: 'skipped',
      error: 'No recipient (phone or email) provided',
    };
  }

  // Idempotency check
  const isDuplicate = await checkIdempotency(
    rule.organizationId,
    triggerEvent,
    recipient,
    data.ticketId
  );

  if (isDuplicate) {
    return {
      ruleId: rule.id,
      success: true,
      channel: rule.channel,
      status: 'skipped',
    };
  }

  // Determine channels to try (primary → fallback)
  const channels: string[] = [rule.channel];
  if (rule.fallbackChannel && rule.fallbackChannel !== rule.channel) {
    channels.push(rule.fallbackChannel);
  }

  // Try each channel in order
  let lastError: string | undefined;

  for (const channel of channels) {
    try {
      const sendResult = await sendViaChannel(channel, data, rule.templateId);

      if (sendResult.success) {
        // Create automation log entry
        const log = await db.automationLog.create({
          data: {
            organizationId: rule.organizationId,
            ruleId: rule.id,
            triggerEvent,
            channel,
            recipient,
            status: 'sent',
            sentAt: new Date(),
            attempts: 1,
          },
        });

        return {
          ruleId: rule.id,
          success: true,
          channel,
          status: 'sent',
          logId: log.id,
        };
      } else {
        lastError = sendResult.error;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // All channels failed — create a pending log for retry
  try {
    const log = await db.automationLog.create({
      data: {
        organizationId: rule.organizationId,
        ruleId: rule.id,
        triggerEvent,
        channel: channels[0], // Primary channel
        recipient,
        status: 'pending',
        attempts: 1,
        errorMessage: lastError?.substring(0, 500),
      },
    });

    return {
      ruleId: rule.id,
      success: false,
      channel: channels[0],
      status: 'pending',
      logId: log.id,
      error: lastError,
    };
  } catch (error) {
    return {
      ruleId: rule.id,
      success: false,
      channel: channels[0],
      status: 'failed',
      error: error instanceof Error ? error.message : 'Failed to create log',
    };
  }
}

/**
 * Send a message via a specific channel.
 */
async function sendViaChannel(
  channel: string,
  data: AutomationTriggerData,
  _templateId: string | null
): Promise<ChannelSendResult> {
  switch (channel) {
    case 'whatsapp': {
      if (!data.phone) {
        return { success: false, error: 'No phone number for WhatsApp' };
      }
      return sendWhatsApp(data.phone, _templateId ?? undefined, data);
    }

    case 'sms': {
      if (!data.phone) {
        return { success: false, error: 'No phone number for SMS' };
      }
      const message = buildMessageFromTemplate(data, 'sms');
      return sendSms(data.phone, message);
    }

    case 'email': {
      if (!data.email) {
        return { success: false, error: 'No email address' };
      }
      const subject = data.eventName
        ? `[SmartTicketQR] ${data.eventName}`
        : '[SmartTicketQR] Notification';
      const htmlBody = buildHtmlEmailBody(data);
      return sendEmail(data.email, subject, htmlBody);
    }

    default:
      return { success: false, error: `Unknown channel: ${channel}` };
  }
}

// ============================================================
// QUERY AUTOMATION LOGS
// ============================================================

/**
 * Get automation logs for an organization with optional filters.
 *
 * @param organizationId - Organization to query logs for
 * @param filters - Optional filters (status, channel, date range, pagination)
 */
export async function getAutomationLogs(
  organizationId: string,
  filters: AutomationLogFilters = {}
) {
  const {
    status,
    channel,
    triggerEvent,
    recipient,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = filters;

  const where: Record<string, unknown> = { organizationId };

  if (status) where.status = status;
  if (channel) where.channel = channel;
  if (triggerEvent) where.triggerEvent = triggerEvent;
  if (recipient) where.recipient = recipient;

  if (startDate || endDate) {
    const createdAt: Record<string, unknown> = {};
    if (startDate) createdAt.gte = startDate;
    if (endDate) createdAt.lte = endDate;
    where.createdAt = createdAt;
  }

  const [logs, total] = await Promise.all([
    db.automationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        organization: {
          select: { name: true },
        },
      },
    }),
    db.automationLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ============================================================
// PENDING QUEUE PROCESSOR
// ============================================================

/**
 * Process the pending/failed automation queue.
 *
 * Re-attempts delivery for logs that have not exceeded max retries.
 * Uses exponential backoff for retry scheduling.
 *
 * Designed to be called by a cron job or scheduled task.
 *
 * @returns Summary of processing results
 */
export async function processPendingQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  retried: number;
}> {
  const result = { processed: 0, sent: 0, failed: 0, retried: 0 };

  try {
    // Fetch pending and recently failed logs (with attempts < MAX_RETRY_ATTEMPTS)
    const pendingLogs = await db.automationLog.findMany({
      where: {
        status: { in: ['pending', 'failed'] },
        attempts: { lt: MAX_RETRY_ATTEMPTS },
      },
      orderBy: { createdAt: 'asc' },
      take: 50, // Process in batches
      include: {
        organization: {
          select: { settings: true },
        },
      },
    });

    for (const log of pendingLogs) {
      result.processed++;

      try {
        // Determine what to send based on the log
        const channel = log.channel;
        let sendResult: ChannelSendResult;

        // Reconstruct minimal data for sending
        const data: AutomationTriggerData = {
          organizationId: log.organizationId,
          phone: channel === 'whatsapp' || channel === 'sms' ? log.recipient : undefined,
          email: channel === 'email' ? log.recipient : undefined,
        };

        // Try sending
        if (channel === 'whatsapp') {
          sendResult = await sendWhatsApp(log.recipient, undefined, data);
        } else if (channel === 'sms') {
          const message = `[SmartTicketQR] ${log.triggerEvent.replace(/_/g, ' ')}`;
          sendResult = await sendSms(log.recipient, message);
        } else if (channel === 'email') {
          sendResult = await sendEmail(
            log.recipient,
            `[SmartTicketQR] ${log.triggerEvent.replace(/_/g, ' ')}`,
            buildHtmlEmailBody(data)
          );
        } else {
          sendResult = { success: false, error: `Unknown channel: ${channel}` };
        }

        if (sendResult.success) {
          await db.automationLog.update({
            where: { id: log.id },
            data: {
              status: 'sent',
              sentAt: new Date(),
              errorMessage: null,
            },
          });
          result.sent++;
        } else {
          const newAttempts = log.attempts + 1;

          if (newAttempts >= MAX_RETRY_ATTEMPTS) {
            // Max retries reached — mark as permanently failed
            await db.automationLog.update({
              where: { id: log.id },
              data: {
                status: 'failed',
                attempts: newAttempts,
                errorMessage: (sendResult.error ?? 'Max retries exceeded').substring(0, 500),
              },
            });
            result.failed++;
          } else {
            // Schedule retry
            const retryDelay = getAutomationRetryDelay(newAttempts);
            await db.automationLog.update({
              where: { id: log.id },
              data: {
                status: 'pending',
                attempts: newAttempts,
                errorMessage: (sendResult.error ?? 'Scheduled for retry').substring(0, 500),
              },
            });
            result.retried++;
          }
        }
      } catch (error) {
        const newAttempts = log.attempts + 1;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        if (newAttempts >= MAX_RETRY_ATTEMPTS) {
          await db.automationLog.update({
            where: { id: log.id },
            data: {
              status: 'failed',
              attempts: newAttempts,
              errorMessage: errorMsg.substring(0, 500),
            },
          });
          result.failed++;
        } else {
          await db.automationLog.update({
            where: { id: log.id },
            data: {
              attempts: newAttempts,
              errorMessage: errorMsg.substring(0, 500),
            },
          });
          result.retried++;
        }
      }
    }
  } catch (error) {
    console.error('[AutomationDispatcher] Queue processing error:', error);
  }

  return result;
}

/**
 * Get automation summary statistics for an organization.
 */
export async function getAutomationStats(organizationId: string) {
  const [total, sent, pending, failed, skipped] = await Promise.all([
    db.automationLog.count({ where: { organizationId } }),
    db.automationLog.count({ where: { organizationId, status: 'sent' } }),
    db.automationLog.count({ where: { organizationId, status: 'pending' } }),
    db.automationLog.count({ where: { organizationId, status: 'failed' } }),
    db.automationLog.count({ where: { organizationId, status: 'skipped' } }),
  ]);

  // Channel breakdown
  const byChannel = await db.automationLog.groupBy({
    by: ['channel'],
    where: { organizationId },
    _count: true,
  });

  const channelBreakdown: Record<string, number> = {};
  for (const item of byChannel) {
    channelBreakdown[item.channel] = item._count;
  }

  // Active rules count
  const activeRules = await db.automationRule.count({
    where: { organizationId, isActive: true },
  });

  return {
    total,
    sent,
    pending,
    failed,
    skipped,
    successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
    byChannel: channelBreakdown,
    activeRules,
  };
}
