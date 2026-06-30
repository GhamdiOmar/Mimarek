type EmailLang = "ar" | "en";

function shell(title: string, body: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif;color:#263142">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f6f8;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e7ec;border-radius:10px;overflow:hidden">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #e4e7ec">
                <strong style="font-size:18px;color:#00707A">MIMAREK</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:28px">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;color:#263142">${title}</h1>
                ${body}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function cta(label: string, url: string): string {
  return `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#00707A;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700">${label}</a></p>`;
}

function linkFallback(url: string): string {
  return `<p style="margin:18px 0 0;color:#667085;font-size:13px;line-height:1.6">If the button does not work, copy this link:<br><span style="word-break:break-all">${url}</span></p>`;
}

export function passwordResetEmail(input: { name?: string | null; resetUrl: string; lang?: EmailLang }) {
  const ar = input.lang !== "en";
  const title = ar ? "إعادة تعيين كلمة المرور" : "Reset your password";
  const body = ar
    ? `<p style="margin:0 0 12px;line-height:1.7">مرحباً${input.name ? ` ${input.name}` : ""}،</p>
       <p style="margin:0 0 12px;line-height:1.7">وصلنا طلب لإعادة تعيين كلمة مرور حسابك في معمارك. ينتهي الرابط خلال ساعة واحدة.</p>
       ${cta("إعادة تعيين كلمة المرور", input.resetUrl)}
       <p style="margin:0;line-height:1.7;color:#667085">إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.</p>
       ${linkFallback(input.resetUrl)}`
    : `<p style="margin:0 0 12px;line-height:1.7">Hello${input.name ? ` ${input.name}` : ""},</p>
       <p style="margin:0 0 12px;line-height:1.7">We received a request to reset your Mimarek password. This link expires in one hour.</p>
       ${cta("Reset password", input.resetUrl)}
       <p style="margin:0;line-height:1.7;color:#667085">If you did not request this, you can ignore this email.</p>
       ${linkFallback(input.resetUrl)}`;

  return {
    subject: ar ? "إعادة تعيين كلمة مرور معمارك" : "Reset your Mimarek password",
    html: shell(title, body),
    text: ar
      ? `إعادة تعيين كلمة المرور: ${input.resetUrl}`
      : `Reset your Mimarek password: ${input.resetUrl}`,
  };
}

export function verificationEmail(input: { name?: string | null; verifyUrl: string; lang?: EmailLang }) {
  const ar = input.lang !== "en";
  const title = ar ? "تأكيد بريدك الإلكتروني" : "Verify your email";
  const body = ar
    ? `<p style="margin:0 0 12px;line-height:1.7">مرحباً${input.name ? ` ${input.name}` : ""}،</p>
       <p style="margin:0 0 12px;line-height:1.7">شكراً لإنشاء حسابك في معمارك. أكّد بريدك الإلكتروني لتفعيل الحساب وتسجيل الدخول. ينتهي الرابط خلال 24 ساعة.</p>
       ${cta("تأكيد البريد الإلكتروني", input.verifyUrl)}
       <p style="margin:0;line-height:1.7;color:#667085">إذا لم تنشئ هذا الحساب، يمكنك تجاهل هذه الرسالة بأمان.</p>
       ${linkFallback(input.verifyUrl)}`
    : `<p style="margin:0 0 12px;line-height:1.7">Hello${input.name ? ` ${input.name}` : ""},</p>
       <p style="margin:0 0 12px;line-height:1.7">Thanks for creating your Mimarek account. Verify your email to activate your account and sign in. This link expires in 24 hours.</p>
       ${cta("Verify email", input.verifyUrl)}
       <p style="margin:0;line-height:1.7;color:#667085">If you didn't create an account, you can safely ignore this email.</p>
       ${linkFallback(input.verifyUrl)}`;

  return {
    subject: ar ? "أكّد بريدك الإلكتروني في معمارك" : "Verify your Mimarek email",
    html: shell(title, body),
    text: ar
      ? `تأكيد البريد الإلكتروني: ${input.verifyUrl}`
      : `Verify your Mimarek email: ${input.verifyUrl}`,
  };
}

export function invitationEmail(input: {
  inviteUrl: string;
  organizationName: string;
  inviterName?: string | null;
  role: string;
  resend?: boolean;
  lang?: EmailLang;
}) {
  const ar = input.lang !== "en";
  const title = input.resend
    ? ar ? "تم إرسال دعوة معمارك مرة أخرى" : "Your Mimarek invitation was resent"
    : ar ? "دعوة للانضمام إلى معمارك" : "You are invited to Mimarek";
  const body = ar
    ? `<p style="margin:0 0 12px;line-height:1.7">${input.inviterName ?? "مسؤول الفريق"} دعاك للانضمام إلى ${input.organizationName} في معمارك بدور ${input.role}.</p>
       <p style="margin:0 0 12px;line-height:1.7">أنشئ كلمة المرور من الرابط التالي. تنتهي الدعوة خلال 7 أيام.</p>
       ${cta("قبول الدعوة", input.inviteUrl)}
       ${linkFallback(input.inviteUrl)}`
    : `<p style="margin:0 0 12px;line-height:1.7">${input.inviterName ?? "A team admin"} invited you to join ${input.organizationName} in Mimarek as ${input.role}.</p>
       <p style="margin:0 0 12px;line-height:1.7">Create your password from the link below. The invitation expires in 7 days.</p>
       ${cta("Accept invitation", input.inviteUrl)}
       ${linkFallback(input.inviteUrl)}`;

  return {
    subject: ar ? `دعوة للانضمام إلى ${input.organizationName}` : `Invitation to join ${input.organizationName}`,
    html: shell(title, body),
    text: ar ? `قبول الدعوة: ${input.inviteUrl}` : `Accept invitation: ${input.inviteUrl}`,
  };
}

export function testEmail(input: { appUrl: string; lang?: EmailLang }) {
  const ar = input.lang !== "en";
  const title = ar ? "اختبار بريد معمارك" : "Mimarek email test";
  const body = ar
    ? `<p style="margin:0 0 12px;line-height:1.7">تم إرسال هذه الرسالة من إعدادات Hostinger SMTP داخل معمارك.</p>
       <p style="margin:0;line-height:1.7;color:#667085">إذا وصلت الرسالة، يمكن استخدام نفس الإعدادات لتدفقات إعادة تعيين كلمة المرور والدعوات.</p>`
    : `<p style="margin:0 0 12px;line-height:1.7">This message was sent from the Hostinger SMTP settings configured in Mimarek.</p>
       <p style="margin:0;line-height:1.7;color:#667085">If it arrived, password reset and invitation emails can use the same settings.</p>`;
  return {
    subject: ar ? "اختبار إعدادات بريد معمارك" : "Mimarek email settings test",
    html: shell(title, body),
    text: ar ? `تم إرسال اختبار البريد من ${input.appUrl}` : `Email test sent from ${input.appUrl}`,
  };
}

export function scheduledPlanChangeEmail(input: {
  name?: string | null;
  sourcePlanName: string;
  targetPlanName?: string | null;
  effectiveAt: Date;
  isMigration: boolean;
  billingUrl: string;
  lang?: EmailLang;
}) {
  const ar = input.lang !== "en";
  const dateStr = input.effectiveAt.toLocaleDateString(ar ? "ar-SA-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const title = ar ? "تغيير قادم على اشتراكك" : "An upcoming change to your subscription";
  const what =
    input.isMigration && input.targetPlanName
      ? ar
        ? `سيتم نقل اشتراكك من «${input.sourcePlanName}» إلى «${input.targetPlanName}»`
        : `Your subscription will move from "${input.sourcePlanName}" to "${input.targetPlanName}"`
      : ar
        ? `سيتم تحديث سعر خطة «${input.sourcePlanName}»`
        : `The price of your "${input.sourcePlanName}" plan will be updated`;
  const body = ar
    ? `<p style="margin:0 0 12px;line-height:1.7">مرحباً${input.name ? ` ${input.name}` : ""}،</p>
       <p style="margin:0 0 12px;line-height:1.7">${what} اعتباراً من ${dateStr}. يبقى سعرك الحالي سارياً حتى ذلك التاريخ.</p>
       ${cta("عرض الفوترة", input.billingUrl)}
       <p style="margin:0;line-height:1.7;color:#667085">لأي استفسار، تواصل مع فريق الدعم.</p>
       ${linkFallback(input.billingUrl)}`
    : `<p style="margin:0 0 12px;line-height:1.7">Hello${input.name ? ` ${input.name}` : ""},</p>
       <p style="margin:0 0 12px;line-height:1.7">${what}, effective ${dateStr}. Your current price stays in effect until then.</p>
       ${cta("View billing", input.billingUrl)}
       <p style="margin:0;line-height:1.7;color:#667085">If you have any questions, contact support.</p>
       ${linkFallback(input.billingUrl)}`;
  return {
    subject: ar ? "تغيير قادم على اشتراك معمارك" : "An upcoming change to your Mimarek subscription",
    html: shell(title, body),
    text: ar ? `${what} اعتباراً من ${dateStr}. ${input.billingUrl}` : `${what}, effective ${dateStr}. ${input.billingUrl}`,
  };
}
