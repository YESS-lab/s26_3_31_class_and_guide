# Deploying Your Agent

This guide walks you through deploying your agent to the web using Fly.io.
After following these steps, you'll have a public URL anyone can use to
interact with your agent.

## Prerequisites

- A GitHub account (you should already have this)
- An Anthropic API key from https://console.anthropic.com/settings/keys
  (you should already have this from class)

## Step 1: Create a Fly.io Account

1. Go to https://fly.io/app/sign-up
2. Sign up with your GitHub account (easiest option)
3. You'll need to add a credit card for verification, but the free tier
   covers small apps. A small agent like this costs ~$3-5/month if left
   running, and $0 when stopped.

## Step 2: Install the Fly CLI

**macOS (Homebrew):**
```bash
brew install flyctl
```

**macOS/Linux (curl):**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell):**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

After installing, verify it works:
```bash
fly version
```

## Step 3: Log In

```bash
fly auth login
```

This opens your browser. Log in with the same account you created in Step 1.

## Step 4: Deploy

From your project directory (the one with `fly.toml`):

```bash
# First time only -- creates the app on Fly.io
fly launch --no-deploy

# Set your Anthropic API key as a secret
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here

# Deploy
fly deploy
```

The first deploy takes 2-3 minutes. Fly.io builds your Docker container
in the cloud and starts it.

## Step 5: Get Your URL

After deploy completes, your agent is live at:

```
https://your-app-name.fly.dev
```

The exact URL is shown in the deploy output. Share this link with anyone
who should be able to use your agent.

## Updating Your Agent

After changing skills or config:

```bash
fly deploy
```

That's it. Changes go live in ~1 minute.

## Useful Commands

```bash
fly logs          # See server output (useful for debugging)
fly status        # Check if your app is running
fly ssh console   # Shell into the running machine
fly apps destroy your-app-name  # Delete the app entirely
```

## Troubleshooting

**"Error: no machines" or app won't start**
- Check `fly logs` for error messages
- Most common: missing ANTHROPIC_API_KEY. Run `fly secrets set` again.

**"Cannot connect" in the browser**
- The app may have auto-stopped. Just refresh -- it auto-starts on traffic.
  First request after a stop takes ~10 seconds.

**Agent doesn't respond or gives generic responses**
- Check that `.claude/skills/` is in the repo and not in `.gitignore`
- Check `fly logs` for "Loaded N skills" -- should show 5 (or however
  many you have)

**File uploads fail**
- Max file size is 10MB
- Check that the uploads directory is writable (it should be by default)

## Cost

- Fly.io machines auto-stop when idle (no traffic = no charge)
- When running: ~$3-5/month for a small machine
- API costs depend on usage -- each conversation uses Anthropic API tokens
- For class purposes, this should be well within your API budget
