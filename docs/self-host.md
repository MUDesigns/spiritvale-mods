# Self-host SpiritVale Mods on OVH + Dokploy

The catalog is a Next.js app with Postgres and files on local disk. Clerk, VirusTotal, and Resend stay as hosted services. Do not run MinIO, Redis, or `next build` on the 4 GB VPS.

## 1. Order the VPS (OVH Control Panel)

Dokploy / OVH APIs cannot place the order. Buy:

- 2 vCores, 4 GB RAM, Ubuntu 24.04
- Public IPv4
- US datacenter (Vint Hill / Hillsboro) unless you prefer Canada
- Enable automated backups/snapshots
- Open **22, 80, 443**

After first boot, add 2 GB swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 2. Install Dokploy

SSH as root (or a sudo user):

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Open `http://YOUR_VPS_IP:3000` (or the URL the installer prints), create the admin account, then put the panel behind HTTPS in Dokploy’s domain settings.

## 3. Deploy from GitHub Actions

Do not run `next build` on the 4 GB VPS. Pushes to `main` build the image on GitHub, push it to GHCR, then SSH into the VPS and recreate only the `web` container. Dokploy/Traefik keeps serving HTTPS.

Required GitHub configuration (`MUDesigns/spiritvale-mods`):

- Variable `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (production `pk_live_…`)
- Secrets `CLERK_SECRET_KEY` (production `sk_live_…`), `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (deploy key whose public half is in `ubuntu`'s `authorized_keys`)

Manual run: Actions → **Deploy catalog** → Run workflow.

Local/VPS fallback:

```bash
docker build -t ghcr.io/mudesigns/spiritvale-mods:latest .
docker push ghcr.io/mudesigns/spiritvale-mods:latest
```

On the VPS, `WEB_IMAGE` in `/opt/spiritvale-mods/.env` is updated by the workflow. Postgres and `catalog_storage` volumes are left in place.

## 4. Create the Dokploy project

1. Project **spiritvale-mods**.
2. Compose service using this repo’s `docker-compose.yml`. Host port **3001** maps to the app so it does not collide with Dokploy’s panel on 3000; attach domains in the Dokploy UI rather than relying on that port.
3. Env vars from `.env.example`, plus a strong `POSTGRES_PASSWORD`.
4. `DATABASE_URL` is injected by compose as `postgres://spiritvale:${POSTGRES_PASSWORD}@postgres:5432/spiritvale`.
5. Persist volumes **postgres_data** and **catalog_storage**. The web user is uid **1001**; if uploads fail with EACCES, `chown -R 1001:1001` the storage volume.
6. Domains: `spiritvalemods.com` and `www.spiritvalemods.com` with Let’s Encrypt (Dokploy domain UI). Pages on apex 308 to www; **`/api` on apex is not redirected** so `Authorization` survives. Upload URLs are always `https://www.spiritvalemods.com/api/upload/blob`.
7. Traefik must allow large request bodies for `/api/upload/blob` (community zips 50 MB, manager installer 512 MB). Compose sets `buffering.maxRequestBodyBytes` on the upload router. If PUTs still fail, raise the same limit in Dokploy’s Traefik/proxy settings.
8. Set `SITE_URL=https://www.spiritvalemods.com` (runtime). Do not let the app issue `http://` or Docker-hostname upload URLs — API clients will PUT to an address they cannot reach, or follow an HTTP→HTTPS redirect and drop the Bearer token.

## 5. Migrate data (before flipping DNS)

From a machine that still has Neon + Blob credentials in `spiritvale-mods/.env.local`:

```bash
node scripts/migrate-to-selfhost.mjs blobs
node scripts/migrate-to-selfhost.mjs dump
```

Copy `data/storage` onto the VPS volume (`catalog_storage` → `/data/storage` in the web container). Restore Postgres:

```bash
psql "postgres://spiritvale:PASSWORD@127.0.0.1:5432/spiritvale" -f backups/neon.sql
```

The app runs `ensureSchema` on boot, but restore the dump **after** the first start (or restore into an empty database, then start web).

Rewrite Blob URLs on the **VPS** database only:

```bash
TARGET_DATABASE_URL="postgres://spiritvale:PASSWORD@HOST:5432/spiritvale" \
NEXT_PUBLIC_SITE_URL=https://www.spiritvalemods.com \
node scripts/migrate-to-selfhost.mjs rewrite
```

## 6. Cron

Vercel’s daily `GET /api/cron/retry-scans` becomes a Dokploy scheduled job:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://www.spiritvalemods.com/api/cron/retry-scans
```

Schedule: `0 6 * * *`. Nightly, also snapshot Postgres and tarball `/data/storage`.

## 7. DNS cutover

1. Note the VPS IPv4.
2. At the DNS host for `spiritvalemods.com`: `A` for `@` and `www` → VPS IP. Remove Vercel A/CNAME/ALIAS. TTL 300 first.
3. Wait for Traefik certificates. Confirm `/`, `/api/app`, and sign-in on **www**.
4. Remove the Vercel project domain alias so it cannot steal the hostname.

Clerk already allows both apex and www. Existing Plugin Manager installs that use `https://www.spiritvalemods.com` do not need a rebuild.

## 8. Clerk production

The catalog image bakes `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at **build** time. Production must use `pk_live_` / `sk_live_`. GitHub variable `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and secret `CLERK_SECRET_KEY` are applied on each deploy.

1. In the [Clerk Dashboard](https://dashboard.clerk.com), switch to the **Production** instance.
2. **Domains** — add `spiritvalemods.com` (www is covered as a subdomain). Copy the DNS records Clerk shows (`clerk`, `accounts`, `clk._domainkey`, `clk2._domainkey`, and any others). Add them at the DNS host. If you use Cloudflare, set those Clerk hostnames to **DNS only** (grey cloud) or Clerk’s check fails. Then click **Deploy certificates**.
3. **Paths** — these do not copy from development. Set:
   - Home: `https://www.spiritvalemods.com`
   - Sign-in: `https://www.spiritvalemods.com/sign-in`
   - Sign-up: `https://www.spiritvalemods.com/sign-up`
   - After sign-in / sign-up: `https://www.spiritvalemods.com/upload`
   - Allowed redirect: `https://www.spiritvalemods.com/sso-callback` (and the same on the apex host if Clerk asks)
4. **SSO** — Google and Discord **must** use your own OAuth apps in production. Clerk’s shared credentials only work in development. Create Web credentials, paste Clerk’s redirect URI, then put the client id/secret back in Clerk. Google’s OAuth consent screen should be **In production**.
5. **Subdomain allowlist** — restrict Frontend API CORS to `www.spiritvalemods.com` (and apex if needed).
6. Redeploy after changing keys so the Docker image and `/opt/spiritvale-mods/.env` pick them up.

Keep local `.env.local` on `pk_test_` / `sk_test_` so `next dev` stays on the development instance.

The Discord bot is the `bot` service in this compose file (`ghcr.io/mudesigns/spiritvale-mods-discord-bot`). GitHub secrets `DISCORD_TOKEN` and `DISCORD_BOT_SECRET` are written onto the VPS `.env` the same way as `CLERK_SECRET_KEY`. The website calls `http://bot:8080/internal/event` for scan queue alerts and instant release posts.

## 9. Aftercare

- Keep Clerk, VirusTotal, and Resend env vars as they are.
- Publisher and `scripts/publish-app.mjs` PUT to `/api/upload` then `/api/upload/blob` (no Vercel Blob).
- Do not compile Next on the box. Rebuild the image locally (or CI) and redeploy.
