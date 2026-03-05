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

    const recipients = Array.isArray(to) ? to : [to];

    // Use Resend HTTP API if host is smtp.resend.com (much more reliable in edge functions)
    if (host.toLowerCase().includes("resend")) {
      const resendApiKey = password; // Resend uses API key as SMTP password
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject,
          html: body,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Resend API error:", errorText);
        return new Response(JSON.stringify({ error: `Email send failed: ${errorText}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json();
      return new Response(JSON.stringify({ success: true, message: "Email sent successfully", id: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: Raw SMTP via Deno TCP
    const portNum = parseInt(port);
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Port 465 = implicit TLS, Port 587 = STARTTLS, others = plain
    if (portNum === 465) {
      // Implicit TLS (SMTPS)
      const tlsConn = await Deno.connectTls({ hostname: host, port: portNum });

      const tlsSend = async (cmd: string) => {
        await tlsConn.write(encoder.encode(cmd + "\r\n"));
        const buf = new Uint8Array(4096);
        const n = await tlsConn.read(buf);
        return n ? decoder.decode(buf.subarray(0, n)) : "";
      };

      const tlsRead = async () => {
        const buf = new Uint8Array(4096);
        const n = await tlsConn.read(buf);
        return n ? decoder.decode(buf.subarray(0, n)) : "";
      };

      await tlsRead(); // greeting
      await tlsSend(`EHLO localhost`);

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
    } else if (portNum === 587) {
      // STARTTLS
      const conn = await Deno.connect({ hostname: host, port: portNum });

      const send = async (cmd: string) => {
        await conn.write(encoder.encode(cmd + "\r\n"));
        const buf = new Uint8Array(4096);
        const n = await conn.read(buf);
        return n ? decoder.decode(buf.subarray(0, n)) : "";
      };

      const read = async () => {
        const buf = new Uint8Array(4096);
        const n = await conn.read(buf);
        return n ? decoder.decode(buf.subarray(0, n)) : "";
      };

      await read(); // greeting
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
      // Plain SMTP (port 25)
      const conn = await Deno.connect({ hostname: host, port: portNum });

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

      await read();
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
