# Deploying Your Agent

This guide walks you through deploying your agent to the web using Railway.
After following these steps, you'll have a public URL anyone can use to
interact with your agent.

## Prerequisites

- A GitHub account (you should already have this)
- An Anthropic API key from https://console.anthropic.com/settings/keys
  (you should already have this from class)

## Step 1: Create a Railway Account

1. Go to https://railway.com
2. Click **Login** then **Login with GitHub**
3. Railway has a free trial tier. The Hobby plan is $5/month with $5 of
   included usage -- more than enough for a class project.

## Step 2: Install the Railway CLI

```bash
npm install -g @railway/cli
```

Verify it works:
```bash
railway --help
```

## Step 3: Log In

```bash
railway login
```

This opens your browser. Log in with the same GitHub account.

## Step 4: Create a Project

```bash
# From your project directory
railway init
```

Give your project a name when prompted (e.g., "mindful-consumption-guide").

## Step 5: Link Your Directory

```bash
railway link
```

Select the project you just created.

## Step 6: Set Your API Key

```bash
railway vars set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

## Step 7: Deploy

```bash
railway up
```

Railway detects the Dockerfile, builds your app, and deploys it.
First deploy takes 2-3 minutes.

## Step 8: Get Your URL

Generate a public domain for your deployed app:

```bash
railway domain
```

Your agent is now live at the URL Railway gives you.
Share this link with anyone who should use your agent.

## Updating Your Agent

After changing skills or config:

```bash
railway up
```

Or connect your GitHub repo in the Railway dashboard -- then every push
to your main branch auto-deploys.

## Useful Commands

```bash
railway logs          # See server output (useful for debugging)
railway status        # Check deployment status
railway vars          # View environment variables
railway vars set KEY=VALUE  # Set an environment variable
railway down          # Remove most recent deployment
railway delete        # Delete the project entirely
```

## Troubleshooting

**App won't start or crashes**
- Check `railway logs` for error messages
- Most common: missing ANTHROPIC_API_KEY. Run `railway vars set` again.

**Build fails**
- Make sure `npm run build` works locally first
- Check that all dependencies are in package.json

**Agent doesn't respond or gives generic responses**
- Check that `.claude/skills/` is in the repo and not in `.gitignore`
- Check `railway logs` for errors during skill loading

**No public URL**
- Run `railway domain` to generate one

**File uploads fail**
- Max file size is 10MB
- Check that the uploads directory is writable

## Cost

- Railway Hobby plan: $5/month with $5 included usage
- API costs depend on usage -- each conversation uses Anthropic API tokens
- For class purposes, this should be well within your budget
