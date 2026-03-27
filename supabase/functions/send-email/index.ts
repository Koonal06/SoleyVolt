import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
const postmarkToken = Deno.env.get("POSTMARK_SERVER_TOKEN");
const postmarkFromEmail = Deno.env.get("POSTMARK_FROM_EMAIL");
const postmarkMessageStream = Deno.env.get("POSTMARK_MESSAGE_STREAM") ?? "soleyvolt-auth";
const postmarkSenderName = Deno.env.get("POSTMARK_SENDER_NAME") ?? "SoleyVolt";

if (!hookSecret) {
  throw new Error("Missing SEND_EMAIL_HOOK_SECRET.");
}

if (!postmarkToken) {
  throw new Error("Missing POSTMARK_SERVER_TOKEN.");
}

if (!postmarkFromEmail) {
  throw new Error("Missing POSTMARK_FROM_EMAIL.");
}

type HookPayload = {
  user: {
    email: string;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type: string;
    site_url?: string;
    token_new?: string;
    old_email?: string;
    new_email?: string;
  };
};

function buildActionUrl(emailData: HookPayload["email_data"]) {
  if (emailData.redirect_to) {
    return emailData.redirect_to;
  }

  if (emailData.site_url) {
    return emailData.site_url;
  }

  return "";
}

function buildEmailContent(payload: HookPayload) {
  const { user, email_data } = payload;
  const actionUrl = buildActionUrl(email_data);

  const templates: Record<
    string,
    {
      subject: string;
      text: string;
      html: string;
    }
  > = {
    signup: {
      subject: "Confirm your SoleyVolt account",
      text: `Hello,\n\nConfirm your SoleyVolt account${
        actionUrl ? ` by opening this link: ${actionUrl}` : "."
      }\n\nVerification code: ${email_data.token ?? "Unavailable"}\n`,
      html: `<h2>Confirm your SoleyVolt account</h2><p>Hello,</p><p>${
        actionUrl
          ? `Open this link to confirm your account: <a href="${actionUrl}">${actionUrl}</a>`
          : "Use the verification code below to confirm your account."
      }</p><p><strong>Verification code:</strong> ${email_data.token ?? "Unavailable"}</p>`,
    },
    recovery: {
      subject: "Reset your SoleyVolt password",
      text: `Hello,\n\nReset your SoleyVolt password${
        actionUrl ? ` by opening this link: ${actionUrl}` : "."
      }\n\nReset code: ${email_data.token ?? "Unavailable"}\n`,
      html: `<h2>Reset your SoleyVolt password</h2><p>Hello,</p><p>${
        actionUrl
          ? `Open this link to reset your password: <a href="${actionUrl}">${actionUrl}</a>`
          : "Use the reset code below to continue."
      }</p><p><strong>Reset code:</strong> ${email_data.token ?? "Unavailable"}</p>`,
    },
    invite: {
      subject: "You have been invited to SoleyVolt",
      text: `Hello,\n\nYou have been invited to SoleyVolt${
        actionUrl ? `. Open this link to continue: ${actionUrl}` : "."
      }\n\nInvite code: ${email_data.token ?? "Unavailable"}\n`,
      html: `<h2>You have been invited to SoleyVolt</h2><p>Hello,</p><p>${
        actionUrl
          ? `Open this link to continue: <a href="${actionUrl}">${actionUrl}</a>`
          : "Use the invite code below to continue."
      }</p><p><strong>Invite code:</strong> ${email_data.token ?? "Unavailable"}</p>`,
    },
    magiclink: {
      subject: "Your SoleyVolt sign-in link",
      text: `Hello,\n\nUse this sign-in link for SoleyVolt${
        actionUrl ? `: ${actionUrl}` : "."
      }\n\nSign-in code: ${email_data.token ?? "Unavailable"}\n`,
      html: `<h2>Your SoleyVolt sign-in link</h2><p>Hello,</p><p>${
        actionUrl
          ? `Use this sign-in link: <a href="${actionUrl}">${actionUrl}</a>`
          : "Use the sign-in code below."
      }</p><p><strong>Sign-in code:</strong> ${email_data.token ?? "Unavailable"}</p>`,
    },
    email_change: {
      subject: "Confirm your SoleyVolt email change",
      text: `Hello,\n\nConfirm your SoleyVolt email change${
        actionUrl ? ` here: ${actionUrl}` : "."
      }\n\nCode: ${email_data.token ?? "Unavailable"}\n`,
      html: `<h2>Confirm your SoleyVolt email change</h2><p>Hello,</p><p>${
        actionUrl
          ? `Confirm the change here: <a href="${actionUrl}">${actionUrl}</a>`
          : "Use the code below to confirm the email change."
      }</p><p><strong>Code:</strong> ${email_data.token ?? "Unavailable"}</p>`,
    },
    reauthentication: {
      subject: "Confirm your SoleyVolt reauthentication",
      text: `Hello,\n\nYour SoleyVolt reauthentication code is: ${email_data.token ?? "Unavailable"}\n`,
      html: `<h2>Confirm your SoleyVolt reauthentication</h2><p>Hello,</p><p><strong>Code:</strong> ${email_data.token ?? "Unavailable"}</p>`,
    },
  };

  const fallback = {
    subject: "Your SoleyVolt email",
    text: `Hello,\n\nA SoleyVolt action was requested for ${user.email}.\n`,
    html: `<h2>Your SoleyVolt email</h2><p>Hello,</p><p>A SoleyVolt action was requested for ${user.email}.</p>`,
  };

  return templates[email_data.email_action_type] ?? fallback;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Not allowed", { status: 405 });
  }

  const payloadText = await req.text();
  const headers = Object.fromEntries(req.headers);
  const webhook = new Webhook(hookSecret.replace("v1,whsec_", ""));

  try {
    const payload = webhook.verify(payloadText, headers) as HookPayload;
    const content = buildEmailContent(payload);

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": postmarkToken,
      },
      body: JSON.stringify({
        From: `${postmarkSenderName} <${postmarkFromEmail}>`,
        To: payload.user.email,
        Subject: content.subject,
        HtmlBody: content.html,
        TextBody: content.text,
        MessageStream: postmarkMessageStream,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: errorText }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown send-email hook error.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
