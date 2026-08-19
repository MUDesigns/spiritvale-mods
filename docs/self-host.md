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

- Variable `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (deploy key whose public half is in `ubuntu`'s `authorized_keys`)

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
6. Domains: `spiritvalemods.com` and `www.spiritvalemods.com` with Let’s Encrypt (Dokploy domain UI). Apex is 308-redirected to www in the app.
7. Traefik must allow **512 MB** request bodies for manager installer uploads. In Dokploy, raise the proxy/body limit if PUTs to `/api/upload/blob` fail.

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

Clerk already allows both apex and www. Existing Mod Manager installs that use `https://www.spiritvalemods.com` do not need a rebuild.

## 8. Aftercare

- Keep Clerk, VirusTotal, and Resend env vars as they are.
- Publisher and `scripts/publish-app.mjs` PUT to `/api/upload` then `/api/upload/blob` (no Vercel Blob).
- Do not compile Next on the box. Rebuild the image locally (or CI) and redeploy.
