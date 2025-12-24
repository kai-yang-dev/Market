# SMTP works locally but times out on Railway (Nodemailer / SMTP_* envs)

This repo sends email using **Nodemailer** (see `backend/src/auth/email.service.ts`) and reads these environment variables:

- `SMTP_HOST` (default: `smtp.gmail.com`)
- `SMTP_PORT` (default: `587`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (optional)

If it works in development but **times out only after deploying to Railway**, the cause is almost always **network egress** (can’t reach the SMTP host/port from the Railway container) rather than a bad username/password.

## 1) The most common root cause: Railway blocks outbound SMTP on some plans

Railway restricts **outbound SMTP traffic** on **Free/Trial/Hobby** plans to prevent abuse. When blocked, your app typically experiences connection **timeouts** (because it can’t open a TCP connection to `SMTP_HOST:SMTP_PORT`).

- Reference: Railway docs → Outbound networking: `https://docs.railway.com/reference/outbound-networking`

### Fix options (no code changes)

- **Upgrade Railway plan**: Use **Pro/Enterprise** so outbound SMTP is permitted.
- **Use an email provider that supports non-SMTP delivery**:
  - Many transactional providers offer an **HTTPS API** (works even when SMTP is blocked).
  - If you must keep SMTP, pick a provider that can be reached on allowed ports and does not require IP allowlisting (see below).

## 2) If your plan allows SMTP, the next most common causes of TIMEOUT

### A) Port / TLS mode mismatch (very common)

SMTP ports behave differently:

- **587**: plaintext connect, then **STARTTLS** upgrade (typical “submission” port)
- **465**: **implicit TLS** from the start (“smtps”)
- **25**: traditional server-to-server SMTP (often blocked by cloud networks)

If you set `SMTP_PORT=465` in Railway but your transporter is configured as **non-secure**, Nodemailer will wait for a plaintext SMTP greeting that never arrives, and you can hit a **greeting/socket timeout**.

What to check:

- **If you use port 587**: ensure your provider supports STARTTLS on 587 (Gmail does).
- **If you use port 465**: ensure you’re using implicit TLS for 465 (provider requirement).
- **Avoid port 25** on most cloud hosts unless you know it’s allowed.

> Why this repo is sensitive to this: `email.service.ts` sets short timeouts (`greetingTimeout` and `socketTimeout` are ~10 seconds). Any handshake stall becomes a visible **TIMEOUT** quickly.

### B) SMTP provider requires IP allowlisting / blocks datacenter IPs

Some SMTP servers only accept connections from approved IP ranges. Railway does not guarantee a single fixed outbound IP, so you may see:

- Silent drops / timeouts (SYN packets dropped or connection accepted then blackholed)
- Intermittent behavior between deploys

What to do:

- Prefer a transactional email provider designed for cloud apps (SES / Postmark / Mailgun / SendGrid / Resend, etc.).
- If your provider supports it, use **authenticated submission** without IP allowlisting.

### C) Wrong Railway environment variables (works locally, not in prod)

Even if you see “timeout”, misconfiguration can send you to a non-routable host/port.

Checklist:

- `SMTP_HOST` is a real public hostname (not `localhost`, not a private LAN IP).
- `SMTP_PORT` is exactly `587` or `465` (no quotes/spaces like `"587 "`).
- Railway **Variables** are set on the correct service (backend) and for the correct environment.
- After changing Variables, **redeploy** / restart the service.

### D) DNS / egress issues inside the container

Less common, but possible:

- DNS resolution failing
- Temporary network incidents

## 3) Quick “is the port reachable from Railway?” tests

Run these from **inside** the Railway service/container (via Railway shell / `railway run ...` from your machine).

### TCP reachability (basic)

```bash
nc -vz smtp.gmail.com 587
nc -vz smtp.gmail.com 465
```

### STARTTLS handshake test (587)

```bash
openssl s_client -starttls smtp -connect smtp.gmail.com:587 -crlf
```

If these commands **hang or time out** inside Railway but work on your laptop, that confirms an **egress restriction** (plan block, port block, or provider filtering).

## 4) What “TIMEOUT” usually means in Nodemailer

Typical timeout sources:

- **TCP connect can’t be established** (blocked egress / firewall)
- **TLS negotiation never completes** (wrong port/TLS mode)
- **SMTP greeting never arrives** (server expects TLS, client expects plaintext; or connection blackholed)

These differ from auth errors:

- Bad credentials usually produce `EAUTH`, not `ETIMEDOUT`.

## 5) Practical recommendation

- On Railway, the most reliable approach is to use a transactional email provider that supports both:
  - **SMTP on 587/465** (if your plan allows it), or
  - an **HTTPS API** (works even when SMTP egress is restricted)

If you tell me:

- your Railway plan (Free/Trial/Hobby/Pro),
- your SMTP provider,
- and the exact error code from logs (e.g., `ETIMEDOUT`, `ESOCKET`, `ECONNRESET`)

…I can point to the single most likely root cause for your case.


