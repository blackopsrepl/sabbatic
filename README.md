# Sabbatic

**A fork of [once-campfire](https://github.com/basecamp/once-campfire) with AI agent support**

Sabbatic is a web-based chat application that extends Campfire with bot and AI agent capabilities. It supports all the features of Campfire, plus enhanced integration for automated agents:

## Core Features

- Multiple rooms, with access controls
- Direct messages
- File attachments with previews
- Search
- Notifications (via Web Push)
- @mentions
- API, with support for bot integrations
- **Enhanced bot/agent support with webhooks and API-based creation**

## AI Agent Capabilities

Sabbatic builds on Campfire's bot infrastructure to support AI agents:

- **Webhook-based bot system** - Bots can receive messages and respond automatically
- **API-based bot creation** - Create and configure bots programmatically
- **Automatic room subscription** - Bots can be added to rooms like regular users
- **Mention detection** - Bots respond when mentioned with @botname
- **Direct message support** - Bots can participate in DM conversations
- **File attachment support** - Bots can post files and images

## Deploying with Docker

Sabbatic's Docker image contains everything needed for a fully-functional,
single-machine deployment. This includes the web app, background jobs, caching,
file serving, and SSL.

To persist storage of the database and file attachments, map a volume to `/rails/storage`.

To configure additional features, you can set the following environment variables:

- `SSL_DOMAIN` - enable automatic SSL via Let's Encrypt for the given domain name
- `DISABLE_SSL` - alternatively, set `DISABLE_SSL` to serve over plain HTTP
- `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` - set these to a valid keypair to
  allow sending Web Push notifications. You can generate a new keypair by running
  `/script/admin/create-vapid-key`
- `SENTRY_DSN` - to enable error reporting to sentry in production, supply your
  DSN here

For example:

    docker build -t sabbatic .

    docker run \
      --publish 80:80 --publish 443:443 \
      --restart unless-stopped \
      --volume sabbatic:/rails/storage \
      --env SECRET_KEY_BASE=$YOUR_SECRET_KEY_BASE \
      --env VAPID_PUBLIC_KEY=$YOUR_PUBLIC_KEY \
      --env VAPID_PRIVATE_KEY=$YOUR_PRIVATE_KEY \
      --env SSL_DOMAIN=chat.example.com \
      sabbatic

## Running in development

    bin/setup
    bin/rails server

By default in development, Action Cable now uses the in-process `async` adapter, so real-time message updates work even if Redis is not running.

If you want to test Redis-backed Action Cable locally, set:

```bash
export ACTION_CABLE_ADAPTER=redis
export ACTION_CABLE_REDIS_URL=redis://localhost:6379
```

## Bot Integration

Bots can be created and managed through the admin interface or via API. Each bot receives:

- A unique bot_key for authentication
- Webhook URL for receiving messages
- API endpoints for posting messages

Example bot message posting:
```bash
# Text message
curl -d 'Hello from bot!' https://your-domain.com/rooms/1/BOT_KEY/messages

# File attachment
curl -F "attachment=@/path/to/file.png" https://your-domain.com/rooms/1/BOT_KEY/messages
```

## Worth Noting

When you start Sabbatic for the first time, you'll be guided through
creating an admin account.
The email address of this admin account will be shown on the login page
so that people who forget their password know who to contact for help.
(You can change this email later in the settings)

Sabbatic is single-tenant: any rooms designated "public" will be accessible by
all users in the system. To support entirely distinct groups of customers, you
would deploy multiple instances of the application.

## Attribution

This project is based on [Campfire](https://github.com/basecamp/campfire) by 37signals.
Campfire is open source software released under the MIT License.

## License

MIT License - see MIT-LICENSE file for details.
