import { Resend } from 'resend';
import { adminDb } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { EmailType, EmailDeliveryStatus } from '@/types';

const resendApiKey = process.env.RESEND_API_KEY || '';
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'Agricart ERP <erp@agricartfpc.in>';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  emailType: EmailType;
  staffUid?: string;
  reportId?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  emailType,
  staffUid,
  reportId,
}: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const emailLogRef = adminDb.collection(ERP_COLLECTIONS.emailLogs).doc();
  const now = new Date().toISOString();

  let messageId: string | undefined;
  let status: EmailDeliveryStatus = 'queued';
  let errorMessage: string | undefined;

  try {
    if (!resend) {
      console.warn(`[Resend Mock Mode] Email to ${to} (${emailType}) not sent because RESEND_API_KEY is not configured.`);
      status = 'accepted';
      messageId = `mock_msg_${Date.now()}`;
    } else {
      const response = await resend.emails.send({
        from: DEFAULT_FROM,
        to,
        subject,
        html,
      });

      if (response.error) {
        status = 'failed';
        errorMessage = response.error.message;
      } else if (response.data) {
        status = 'accepted';
        messageId = response.data.id;
      }
    }
  } catch (err: any) {
    status = 'failed';
    errorMessage = err.message || 'Unknown email delivery error';
  }

  // Save email log in Firestore for audit & dashboard tracking
  try {
    await emailLogRef.set({
      id: emailLogRef.id,
      recipient: to,
      emailType,
      subject,
      staffUid: staffUid || null,
      reportId: reportId || null,
      providerMessageId: messageId || null,
      deliveryStatus: status,
      attemptCount: 1,
      errorMessage: errorMessage || null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (logErr) {
    console.error('Failed to record email log in Firestore:', logErr);
  }

  if (status === 'failed') {
    return { success: false, error: errorMessage };
  }

  return { success: true, messageId };
}
