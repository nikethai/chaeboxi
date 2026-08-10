# Team API Sharing (Optional)

Share a single OpenAI-compatible API key with your team without embedding the key in every client.

This helper ships as a small Docker/Caddy reverse-proxy setup. Server networking must be able to reach your upstream provider (for example openai.com).

## 1. Prepare a server

Any VPS (AWS, GCP, DigitalOcean, etc.) with Docker is fine.

## 2. Install Docker

```shell
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

## 3. Start the shared proxy (HTTP)

Replace `<YOUR_OPENAI_KEY>` with your key:

```shell
docker run -p 80:80 -p 443:443 \
  -v ./caddy_config:/config -v ./caddy_data:/data \
  -e KEY=<YOUR_OPENAI_KEY> \
  -e BASE=https://api.openai.com \
  your-image-or-compose-setup
```

See `Dockerfile`, `Caddyfile`, and `main.sh` in this directory for the concrete image used by this project.

## 4. Point Chaeboxi at the proxy

In **Settings → Provider → OpenAI** (or a custom OpenAI-compatible provider), set **API Host** to your server URL (for example `https://share.example.com`).

## Security notes

- Prefer HTTPS and restrict who can reach the proxy.
- Rotate keys if the server is compromised.
- This is optional infrastructure; most users only need a personal API key.
