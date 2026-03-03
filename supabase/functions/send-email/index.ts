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
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, body, smtpConfig" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { host, port, username, password, from } = smtpConfig;

    if (!host || !port || !username || !password || !from) {
      return new Response(JSON.stringify({ error: "Incomplete SMTP configuration. Please configure SMTP settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email content using raw SMTP via Deno TCP
    const recipients = Array.isArray(to) ? to : [to];

    // Use a simple HTTP-based email approach via SMTP relay
    // For production, this uses basic SMTP protocol over TCP
    const conn = await Deno.connect({ hostname: host, port: parseInt(port) });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const send = async (cmd: string) => {
      await conn.write(encoder.encode(cmd + "\r\n"));
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return n ? decoder.decode(buf.subarray(0, n)) : "";
    };

    const read = async () => {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return n ? decoder.decode(buf.subarray(0, n)) : "";
    };

    // Read greeting
    await read();

    // If port is 587, use STARTTLS
    if (parseInt(port) === 587) {
      await send(`EHLO localhost`);
      await send(`STARTTLS`);

      const tlsConn = await Deno.startTls(conn, { hostname: host });

      const tlsSend = async (cmd: string) => {
        await tlsConn.write(encoder.encode(cmd + "\r\n"));
        const buf = new Uint8Array(4096);
        const n = await tlsConn.read(buf);
        return n ? decoder.decode(buf.subarray(0, n)) : "";
      };

      await tlsSend(`EHLO localhost`);

      // AUTH LOGIN
      const authCreds = btoa(`\x00${username}\x00${password}`);
      await tlsSend(`AUTH PLAIN ${authCreds}`);

      await tlsSend(`MAIL FROM:<${from}>`);
      for (const recipient of recipients) {
        await tlsSend(`RCPT TO:<${recipient.trim()}>`);
      }
      await tlsSend(`DATA`);

      const emailContent = [
        `From: ${from}`,
        `To: ${recipients.join(", ")}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        body,
        `.`,
      ].join("\r\n");

      await tlsSend(emailContent);
      await tlsSend(`QUIT`);
      tlsConn.close();
    } else {
      // Plain SMTP (port 25 or 465)
      await send(`EHLO localhost`);

      const authCreds = btoa(`\x00${username}\x00${password}`);
      await send(`AUTH PLAIN ${authCreds}`);

      await send(`MAIL FROM:<${from}>`);
      for (const recipient of recipients) {
        await send(`RCPT TO:<${recipient.trim()}>`);
      }
      await send(`DATA`);

      const emailContent = [
        `From: ${from}`,
        `To: ${recipients.join(", ")}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        body,
        `.`,
      ].join("\r\n");

      await send(emailContent);
      await send(`QUIT`);
      conn.close();
    }

    return new Response(JSON.stringify({ success: true, message: "Email sent successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Failed to send email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
