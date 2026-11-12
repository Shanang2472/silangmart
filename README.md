## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `GEMINI_API_KEY` in `.env.local` for text chat. The chatbot defaults to built-in browser speech for faster voice output and uses browser voice recognition where supported, so local voice testing does not require a separate speech token. Set `HUGGINGFACE_API_TOKEN` to enable Whisper voice-message transcription on browsers without built-in recognition and Facebook MMS-TTS Tagalog voice output. To enable Piper as another Tagalog voice option, install Piper and a Tagalog voice model whose license permits your intended use, then set `PIPER_EXECUTABLE` and `PIPER_MODEL_PATH` in `.env.local`. Set `PIPER_CONFIG_PATH` if the model has a separate config file. No Piper model is bundled. Set `TTS_PROVIDER` to `mms`, `piper`, or `browser` to choose a default. Browser voice starts with short text segments to reduce time to first audio.
3. Run the app:
   `npm run dev`

### Live delivery GPS

For real rider tracking, serve the app over HTTPS (or use `localhost` during development). On an active delivery, the rider must allow browser location access, keep the dashboard open, and maintain an internet connection. Customer and admin maps update from the rider's actual device GPS; browser background tracking is not guaranteed.

#### Enable trusted HTTPS for a Windows LAN

Changing `http://` to `https://` in the address bar does not enable HTTPS. The server needs a TLS certificate that includes the LAN IP, and the rider's phone must trust the certificate issuer.

1. Give the store PC a stable LAN IP (DHCP reservation recommended). The example below uses `192.168.254.107`; replace it if the address changes.
2. Install [mkcert](https://github.com/FiloSottile/mkcert) on the store PC and run PowerShell in the project folder:

   ```powershell
   mkcert -install
   New-Item -ItemType Directory -Force certs
   mkcert -cert-file certs/lan-cert.pem -key-file certs/lan-key.pem 192.168.254.107 localhost 127.0.0.1
   ```

3. Configure the Node server to use these files. Add the following to the existing `.env.local` (do not replace its current settings):

   ```env
   PORT=3000
   HTTPS_CERT_FILE=certs/lan-cert.pem
   HTTPS_KEY_FILE=certs/lan-key.pem
   ```

4. Restart `npm run dev`. The server should print `https://192.168.254.107:3000`. If Windows Firewall prompts, allow Node.js on the **Private** network only. The phone must use the same Wi-Fi/LAN.
5. Trust the mkcert local CA on the rider's phone. Find its public root certificate with `mkcert -CAROOT` on the PC; transfer **only `rootCA.pem`**, never `rootCA-key.pem`. Install and trust the CA certificate in the phone's certificate settings. Android/iOS wording varies by version; iPhone may require enabling full trust under **Settings → General → About → Certificate Trust Settings**.
6. Open the printed HTTPS address on the phone. Check that the browser shows a secure connection before granting Location permission and installing the Rider App.

If the phone cannot trust a locally issued CA, use a real domain with a publicly trusted certificate (for example, through a properly configured HTTPS reverse proxy/tunnel). A self-signed certificate that produces a browser warning is not sufficient for reliable GPS/PWA installation. Keep the mkcert private key and CA private key on the server PC; do not expose port 3000 to the public internet.

### Install on a rider's phone

1. Deploy the app at an HTTPS address that the rider's phone can open. A plain `http://192.168...` LAN address is not sufficient for phone GPS or PWA installation.
2. Open that address in Chrome on Android, sign in as the rider, then tap **I-install ang Rider App** and confirm **Install**.
3. On iPhone/iPad, open the HTTPS address in Safari, sign in, tap **I-install ang Rider App**, then use **Share → Add to Home Screen → Add**.

The installed Rider App launches the same live system and uses the rider's existing account; it is not a standalone APK or a separate native app.

### Store notifications, payments, and product labels

- Notifications are scoped to the signed-in account and role. The app pushes alerts over Server-Sent Events, refreshes the notification list every 20 seconds as recovery, and refreshes delivery data every 5 seconds. The installable Rider App uses the same live dashboard and GPS tracking while open on the rider's device. The local sound prompt is an in-app control, not an operating-system notification permission.
- POS and delivery receipts use Philippine pesos. POS item prices are treated as VAT-inclusive; the 12% VAT amount is shown as a breakdown and is not added a second time to the displayed price.
- For GCash/Maya deliveries, the rider submits the payment reference before dispatch. An admin must compare the reference and exact amount in the official merchant account and approve it; the rider cannot mark a digital payment as paid. This manual check is not a direct GCash/Maya gateway integration.
- Inventory traceability is manually recorded per product (not automated authenticity validation or multi-lot stock tracking). POS sales, delivery checkout, and dispatch require staff-verified authenticity plus supplier, batch/lot, and a recorded non-expired expiry date. The rider and delivery queue show these records; the server rechecks them before dispatch. GCash/Maya verification remains a separate required admin check in the official merchant account.

## Deploy frontend to Vercel and backend to Render

The React/Vite frontend is hosted on Vercel. The Express API, SSE notifications, and database migrations run on Render. Aiven provides MySQL, and Cloudinary stores newly uploaded images.

1. Create an Aiven MySQL service and note its host, port, user, password, and database name. Download the service CA certificate.
2. In Aiven network access controls, allow the Render service's outbound IP ranges. Add your own current public IP if you will connect through MySQL Workbench; avoid opening the database to every IP unless you accept that risk.
3. Before deploying the backend, connect to Aiven in MySQL Workbench using **Standard (TCP/IP)** and the Aiven CA certificate with SSL/CA verification enabled. Import `silang_mini_mart.sql` into a **new, empty target database** using **Server → Data Import → Import from Self-Contained File** and select that target schema. The dump contains table definitions and existing user, customer, order, and inventory records; review it locally and only migrate data you are authorized to use. It has no `USE` or `CREATE DATABASE` statement, so select the target schema in Workbench. Do not import it over a database that already contains production data. Test the import into a separate staging database first and keep a protected backup. If you want an empty production database instead, skip this import; the first backend startup creates the schema from `src/db/schema.sql`.
4. Create a Cloudinary account and copy its cloud name, API key, and API secret. These are backend secrets and must only be entered in Render.
5. Push the project to a Git provider and create a Render **Blueprint** from the repository. Render reads [render.yaml](./render.yaml), builds the service, and starts it with `npm start`. The API health check is `/api/health`. For an SQL migration, import into Aiven before the first Render deploy; startup migrations then add the app's newer schema fields.
6. In Render's environment settings, set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_SSL_CA`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `GEMINI_API_KEY`. Paste the full Aiven CA certificate into `MYSQL_SSL_CA`. Use a random `JWT_SECRET` of at least 32 characters. Keep every secret in Render, not in Git or Vercel.
7. Import the same repository into Vercel with the repository root as the project root. [vercel.json](./vercel.json) selects the Vite frontend build, `dist` output, and SPA route fallback.
8. Add the Vercel environment variable `VITE_API_BASE_URL` with the full Render service URL, for example `https://your-api.onrender.com` (no trailing slash). It is a public API URL, not a secret. Never put database, JWT, Cloudinary, or AI credentials in Vercel. Redeploy after setting or changing this value.
9. After the Vercel domain is known, set Render's `CORS_ORIGINS` to that exact origin, such as `https://your-project.vercel.app` (no path). For multiple frontend domains, use comma-separated origins. Save and redeploy/restart the Render service.
10. Wait for `/api/health` to succeed, then open the Vercel site and test login, image upload, and notifications. Render may take a short time to wake on the first request.

`HUGGINGFACE_API_TOKEN` is optional and enables Whisper voice transcription and Facebook MMS Tagalog voice output. Piper is optional and requires an installed compatible executable and a separately licensed Tagalog voice model (`PIPER_EXECUTABLE`, `PIPER_MODEL_PATH`, and optionally `PIPER_CONFIG_PATH`). Set `TTS_PROVIDER=piper` or `TTS_PROVIDER=mms` only when that provider is configured; browser speech is the default.

With a blank database, production does not create development admin/rider accounts; create the initial admin account yourself after the health check succeeds. Staff, rider, supplier, and customer passwords/PINs are stored with salted scrypt hashes. On startup, existing imported staff passwords and plain customer PINs are migrated automatically; legacy customer SHA-256 passwords are upgraded to scrypt after a successful login. Review and replace weak imported credentials before public launch.

Plan and verify a separate data migration before switching users over. Existing image paths such as `/uploads/...` point to local disk and are not available on Vercel/Render; migrate them to Cloudinary and update their database URLs or upload them again. New product, variant, store, and proof-of-delivery uploads use Cloudinary in production. The landing-page logo and background are bundled as static Vercel assets in `public/`. Local development continues to store uploads under `uploads/` when Cloudinary credentials are absent.

Do not set `HTTPS_CERT_FILE` or `HTTPS_KEY_FILE` on Render; its public endpoint already uses HTTPS. Rider GPS still requires permission and the rider app to remain open while the delivery is active.
