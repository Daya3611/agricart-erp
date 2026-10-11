interface BaseEmailParams {
  recipientName: string;
  appName?: string;
  companyName?: string;
}

const PRIMARY_GREEN = '#16a34a';
const BRAND_HEADER = `
  <div style="background-color: #064e3b; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-family: sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">
      🌾 AGRICART FPC
    </h1>
    <p style="color: #a7f3d0; margin: 4px 0 0 0; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
      Farmers Producer Company Ltd | ERP Portal
    </p>
  </div>
`;

const BRAND_FOOTER = `
  <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0; font-family: sans-serif; font-size: 12px; color: #64748b;">
    <p style="margin: 0 0 4px 0; font-weight: 600;">Agricart Farmers Producer Company Ltd</p>
    <p style="margin: 0;">Automated Activity Reporting & Operations System</p>
    <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">If you received this email by mistake, please contact administration.</p>
  </div>
`;

export function getStaffInvitationEmail({
  recipientName,
  employeeId,
  setupUrl,
  role,
}: BaseEmailParams & { employeeId: string; setupUrl: string; role: string }) {
  const subject = 'Welcome to Agricart FPC - Set Up Your Staff Account';
  const html = `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: sans-serif; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${BRAND_HEADER}
      <div style="padding: 32px 24px;">
        <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px;">Welcome aboard, ${recipientName}!</h2>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
          Your staff account has been created in the Agricart FPC Activity Reporting ERP system.
        </p>
        <div style="background-color: #f0fdf4; border-left: 4px solid ${PRIMARY_GREEN}; padding: 16px; margin: 0 0 24px 0; border-radius: 4px;">
          <p style="margin: 0 0 6px 0; color: #166534; font-size: 14px;"><strong>Employee ID:</strong> ${employeeId}</p>
          <p style="margin: 0; color: #166534; font-size: 14px;"><strong>Role:</strong> ${role.toUpperCase()}</p>
        </div>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 24px 0;">
          Please click the button below to set up your secure password and access your dashboard.
        </p>
        <div style="text-align: center; margin: 0 0 32px 0;">
          <a href="${setupUrl}" style="background-color: ${PRIMARY_GREEN}; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block; font-size: 15px;">
            Set Up Your Password & Login
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">
          This link will expire for security reasons. If the button above doesn't work, copy and paste this URL into your browser:<br/>
          <a href="${setupUrl}" style="color: ${PRIMARY_GREEN}; text-break: break-all;">${setupUrl}</a>
        </p>
      </div>
      ${BRAND_FOOTER}
    </div>
  `;
  return { subject, html };
}

export function getDailyReminderEmail({
  recipientName,
  reportDate,
  deadlineTime,
  portalUrl,
}: BaseEmailParams & { reportDate: string; deadlineTime: string; portalUrl: string }) {
  const subject = `Reminder: Submit Your Daily Activity Report for ${reportDate}`;
  const html = `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: sans-serif; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${BRAND_HEADER}
      <div style="padding: 32px 24px;">
        <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 18px;">Daily Report Reminder</h2>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
          Dear <strong>${recipientName}</strong>,
        </p>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
          Our records show that your daily activity report for <strong>${reportDate}</strong> has not been submitted yet.
        </p>
        <div style="background-color: #fffbe6; border: 1px solid #ffe58f; padding: 16px; margin: 0 0 24px 0; border-radius: 6px;">
          <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 600;">
            ⏳ Daily Deadline: ${deadlineTime}
          </p>
          <p style="margin: 6px 0 0 0; color: #856404; font-size: 13px;">
            Please log in and submit your completed activities along with photo or video evidence before the deadline.
          </p>
        </div>
        <div style="text-align: center; margin: 0 0 24px 0;">
          <a href="${portalUrl}" style="background-color: ${PRIMARY_GREEN}; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block;">
            Submit Daily Report Now
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; margin: 0;">
          If you have already submitted your report, please disregard this automated notification.
        </p>
      </div>
      ${BRAND_FOOTER}
    </div>
  `;
  return { subject, html };
}

export function getCorrectionRequestedEmail({
  recipientName,
  reportDate,
  reviewerName,
  comment,
  portalUrl,
}: BaseEmailParams & { reportDate: string; reviewerName: string; comment: string; portalUrl: string }) {
  const subject = `Correction Requested: Daily Report for ${reportDate}`;
  const html = `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: sans-serif; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${BRAND_HEADER}
      <div style="padding: 32px 24px;">
        <h2 style="color: #b91c1c; margin: 0 0 16px 0; font-size: 18px;">Action Required: Report Correction</h2>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
          Dear <strong>${recipientName}</strong>,
        </p>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
          Your reviewer <strong>${reviewerName}</strong> has reviewed your daily activity report for <strong>${reportDate}</strong> and requested corrections.
        </p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 0 0 24px 0; border-radius: 4px;">
          <p style="margin: 0 0 4px 0; color: #991b1b; font-size: 13px; font-weight: 700; text-transform: uppercase;">Reviewer Feedback:</p>
          <p style="margin: 0; color: #7f1d1d; font-size: 14px; font-style: italic; line-height: 1.5;">"${comment}"</p>
        </div>
        <div style="text-align: center; margin: 0 0 24px 0;">
          <a href="${portalUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block;">
            Edit & Resubmit Report
          </a>
        </div>
      </div>
      ${BRAND_FOOTER}
    </div>
  `;
  return { subject, html };
}

export function getReportApprovedEmail({
  recipientName,
  reportDate,
  reviewerName,
}: BaseEmailParams & { reportDate: string; reviewerName: string }) {
  const subject = `Report Approved: Daily Activity Report for ${reportDate}`;
  const html = `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: sans-serif; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${BRAND_HEADER}
      <div style="padding: 32px 24px;">
        <h2 style="color: #15803d; margin: 0 0 16px 0; font-size: 18px;">✅ Daily Report Approved</h2>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
          Dear <strong>${recipientName}</strong>,
        </p>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
          Great news! Your daily activity report for <strong>${reportDate}</strong> has been reviewed and approved by <strong>${reviewerName}</strong>.
        </p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; margin: 0 0 24px 0; border-radius: 6px; text-align: center;">
          <p style="margin: 0; color: #166534; font-weight: 600; font-size: 15px;">
            Status: Approved
          </p>
        </div>
      </div>
      ${BRAND_FOOTER}
    </div>
  `;
  return { subject, html };
}

export function getManagerEscalationEmail({
  managerName,
  staffName,
  employeeId,
  reportDate,
  portalUrl,
}: { managerName: string; staffName: string; employeeId: string; reportDate: string; portalUrl: string }) {
  const subject = `ESCALATION: Overdue Missing Report for ${staffName} (${employeeId})`;
  const html = `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: sans-serif; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${BRAND_HEADER}
      <div style="padding: 32px 24px;">
        <h2 style="color: #c2410c; margin: 0 0 16px 0; font-size: 18px;">⚠️ Manager Escalation Notice</h2>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
          Dear <strong>${managerName}</strong>,
        </p>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
          This is an automated escalation notice that staff member <strong>${staffName}</strong> (${employeeId}) has not submitted their required daily activity report for <strong>${reportDate}</strong> despite multiple automated reminders.
        </p>
        <div style="text-align: center; margin: 0 0 24px 0;">
          <a href="${portalUrl}" style="background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block;">
            View Missing Reports Dashboard
          </a>
        </div>
      </div>
      ${BRAND_FOOTER}
    </div>
  `;
  return { subject, html };
}

export function getReportReviewStatusEmail({
  recipientName,
  reportDate,
  status,
  reviewerName,
  comments,
}: { recipientName: string; reportDate: string; status: string; reviewerName: string; comments?: string }) {
  if (status === 'approved') {
    return getReportApprovedEmail({ recipientName, reportDate, reviewerName });
  } else {
    return getCorrectionRequestedEmail({
      recipientName,
      reportDate,
      reviewerName,
      comment: comments || 'Please review and update your report.',
      portalUrl: `${process.env.APP_URL || 'http://localhost:3000'}/staff/daily-report?date=${reportDate}`,
    });
  }
}

export function getPasswordResetEmail({
  recipientName,
  resetUrl,
}: { recipientName: string; resetUrl: string }) {
  const subject = 'Agricart ERP - Password Reset Request';
  const html = `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: sans-serif; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${BRAND_HEADER}
      <div style="padding: 32px 24px;">
        <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px;">Password Reset Request</h2>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
          Hello ${recipientName},
        </p>
        <p style="color: #334155; line-height: 1.6; margin: 0 0 24px 0;">
          A password reset was requested for your Agricart FPC ERP account. Click the button below to choose a new password:
        </p>
        <div style="text-align: center; margin: 0 0 32px 0;">
          <a href="${resetUrl}" style="background-color: ${PRIMARY_GREEN}; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block; font-size: 15px;">
            Reset Password
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">
          If you did not request this, you can safely ignore this email. This link will expire shortly.<br/>
          <a href="${resetUrl}" style="color: ${PRIMARY_GREEN}; text-break: break-all;">${resetUrl}</a>
        </p>
      </div>
      ${BRAND_FOOTER}
    </div>
  `;
  return { subject, html };
}



