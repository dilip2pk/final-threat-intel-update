import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { to, subject, body, smtpConfig } = await req.json();

    if (!to || !subject || !body || !smtpConfig) {
      return jsonRes({ error: "Missing required fields: to, subject, body, smtpConfig" }, 400);
    }

    const { host, port, username, password, from } = smtpConfig;

    if (!host || !port || !username || !password || !from) {
      return jsonRes({ error: "Incomplete SMTP configuration. Please configure all SMTP fields in Settings → Email." }, 400);
    }

    const recipients = Array.isArray(to) ? to : [to];

    // Detect Resend and use their HTTP API (more reliable in edge functions)
    if (host.toLowerCase().includes("resend")) {
      return await sendViaResend(password, from, recipients, subject, body);
    }

    // Generic SMTP via raw TCP/TLS
    return await sendViaSMTP(host, parseInt(port), username, password, from, recipients, subject, body);
  } catch (e) {
    console.error("send-email error:", e);
    return jsonRes({ error: e instanceof Error ? e.message : "Failed to send email" }, 500);
  }
});

// --- Resend HTTP API ---
async function sendViaResend(apiKey: string, from: string, to: string[], subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Resend API error:", errorText);
    return jsonRes({ error: `Email send failed: ${errorText}` }, 500);
  }

  const result = await response.json();
  return jsonRes({ success: true, message: "Email sent successfully via Resend", id: result.id });
}

// --- Generic SMTP (supports port 25, 465, 587, and Outlook 365) ---
async function sendViaSMTP(
  host: string, port: number, username: string, password: string,
  from: string, recipients: string[], subject: string, body: string
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const buildEmail = () => [
    `From: ${from}`,
    `To: ${recipients.join(", ")}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    body,
    `.`,
  ].join("\r\n");

  const makeSend = (conn: Deno.Conn) => async (cmd: string) => {
    await conn.write(encoder.encode(cmd + "\r\n"));
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    const resp = n ? decoder.decode(buf.subarray(0, n)) : "";
    console.log(`SMTP > ${cmd.substring(0, 50)}... < ${resp.substring(0, 100)}`);
    return resp;
  };

  const makeRead = (conn: Deno.Conn) => async () => {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    return n ? decoder.decode(buf.subarray(0, n)) : "";
  };

  const doAuth = async (send: (cmd: string) => Promise<string>) => {
    // Try AUTH PLAIN first, then AUTH LOGIN
    const authCreds = btoa(`\x00${username}\x00${password}`);
    const authResp = await send(`AUTH PLAIN ${authCreds}`);
    if (authResp.startsWith("5")) {
      // Fallback to AUTH LOGIN (common for Outlook/Exchange)
      await send(`AUTH LOGIN`);
      await send(btoa(username));
      await send(btoa(password));
    }
  };

  const doSend = async (send: (cmd: string) => Promise<string>) => {
    await send(`MAIL FROM:<${from}>`);
    for (const r of recipients) {
      await send(`RCPT TO:<${r.trim()}>`);
    }
    await send(`DATA`);
    await send(buildEmail());
    await send(`QUIT`);
  };

  if (port === 465) {
    // Implicit TLS (SMTPS) - used by Outlook, Gmail legacy
    const tlsConn = await Deno.connectTls({ hostname: host, port });
    const send = makeSend(tlsConn);
    const read = makeRead(tlsConn);

    await read(); // greeting
    await send(`EHLO localhost`);
    await doAuth(send);
    await doSend(send);
    tlsConn.close();
  } else if (port === 587) {
    // STARTTLS - used by Outlook 365, Gmail, most modern providers
    const conn = await Deno.connect({ hostname: host, port });
    const send = makeSend(conn);
    const read = makeRead(conn);

    await read(); // greeting
    await send(`EHLO localhost`);
    await send(`STARTTLS`);

    const tlsConn = await Deno.startTls(conn, { hostname: host });
    const tlsSend = makeSend(tlsConn);

    await tlsSend(`EHLO localhost`);
    await doAuth(tlsSend);
    await doSend(tlsSend);
    tlsConn.close();
  } else {
    // Plain SMTP (port 25)
    const conn = await Deno.connect({ hostname: host, port });
    const send = makeSend(conn);
    const read = makeRead(conn);

    await read();
    await send(`EHLO localhost`);
    await doAuth(send);
    await doSend(send);
    conn.close();
  }

  return jsonRes({ success: true, message: "Email sent successfully via SMTP" });
}

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
