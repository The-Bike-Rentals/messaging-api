const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Message API',
      version: '1.0.0',
      description:
        'Unified messaging API supporting WhatsApp (Baileys), Email, and SMS.',
    },
    servers: [{ url: '/api', description: 'API base path' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for external callers. Admin session cookie is also accepted.',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
        Session: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            sessionId: { type: 'string' },
            label: { type: 'string' },
            webhookUrl: { type: 'string' },
            status: { type: 'string', enum: ['connecting', 'connected', 'disconnected'] },
            isLive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            channel: { type: 'string', enum: ['whatsapp', 'email', 'sms'] },
            sessionId: { type: 'string' },
            direction: { type: 'string', enum: ['inbound', 'outbound'] },
            from: { type: 'string' },
            to: { type: 'string' },
            messageType: { type: 'string' },
            text: { type: 'string' },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        EmailConfig: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            host: { type: 'string' },
            port: { type: 'integer', example: 587 },
            secure: { type: 'boolean' },
            user: { type: 'string' },
            from: { type: 'string' },
            isActive: { type: 'boolean' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SmsConfig: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            provider: { type: 'string' },
            apiUrl: { type: 'string' },
            apiUsername: { type: 'string' },
            from: { type: 'string' },
            isActive: { type: 'boolean' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    tags: [
      { name: 'Send', description: 'Unified send endpoint (WhatsApp, Email, SMS)' },
      { name: 'WhatsApp Sessions', description: 'Manage WhatsApp sessions' },
      { name: 'WhatsApp Messages', description: 'Send messages via a WhatsApp session' },
      { name: 'Message History', description: 'Retrieve stored message history' },
      { name: 'Config', description: 'Email and SMS configuration (admin only)' },
    ],
    paths: {
      // ── Unified Send ─────────────────────────────────────────────────────────
      '/send': {
        post: {
          tags: ['Send'],
          summary: 'Send a message (WhatsApp / Email / SMS)',
          description:
            'Unified endpoint. Accepts JSON or `multipart/form-data`. Attach a file using the `file` field for media messages.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['channel', 'to'],
                  properties: {
                    channel: { type: 'string', enum: ['whatsapp', 'email', 'sms'], description: 'Messaging channel' },
                    to: { type: 'string', description: 'Recipient phone number or email address' },
                    sessionId: { type: 'string', description: 'WhatsApp session ID (required for whatsapp)' },
                    messageType: {
                      type: 'string',
                      enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker'],
                      description: 'Auto-detected from file when omitted',
                    },
                    text: { type: 'string', description: 'Message body / caption' },
                    caption: { type: 'string', description: 'Alias for text when sending media' },
                    subject: { type: 'string', description: 'Email subject' },
                    html: { type: 'string', description: 'Email HTML body' },
                    mediaBase64: { type: 'string', description: 'Base64-encoded file content' },
                    mediaUrl: { type: 'string', description: 'Remote URL to fetch file from' },
                    mimetype: { type: 'string', description: 'Override detected MIME type' },
                    fileName: { type: 'string', description: 'Override detected file name' },
                    lat: { type: 'number', description: 'Latitude (location messages)' },
                    lng: { type: 'number', description: 'Longitude (location messages)' },
                    locationName: { type: 'string' },
                    contactName: { type: 'string' },
                    contactPhone: { type: 'string' },
                  },
                },
              },
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['channel', 'to'],
                  properties: {
                    channel: { type: 'string', enum: ['whatsapp', 'email', 'sms'] },
                    to: { type: 'string' },
                    sessionId: { type: 'string' },
                    messageType: { type: 'string' },
                    text: { type: 'string' },
                    caption: { type: 'string' },
                    file: { type: 'string', format: 'binary', description: 'File attachment (max 64 MB)' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Message sent',
              content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { type: 'object', properties: { data: { type: 'object' } } }] } } },
            },
            400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            401: { description: 'Missing API key' },
            403: { description: 'Invalid API key' },
            500: { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      // ── WhatsApp Sessions ─────────────────────────────────────────────────────
      '/whatsapp/sessions': {
        get: {
          tags: ['WhatsApp Sessions'],
          summary: 'List all sessions',
          responses: {
            200: {
              description: 'Session list',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Session' } } } },
                    ],
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
          },
        },
        post: {
          tags: ['WhatsApp Sessions'],
          summary: 'Create / connect a new session',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: { type: 'string', description: 'Unique session identifier' },
                    label: { type: 'string', description: 'Human-readable label' },
                    webhookUrl: { type: 'string', description: 'URL to receive incoming-message webhooks' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Session created', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { type: 'object', properties: { data: { $ref: '#/components/schemas/Session' } } }] } } } },
            400: { description: 'sessionId missing', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        get: {
          tags: ['WhatsApp Sessions'],
          summary: 'Get a single session',
          responses: {
            200: { description: 'Session details', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { type: 'object', properties: { data: { $ref: '#/components/schemas/Session' } } }] } } } },
            404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['WhatsApp Sessions'],
          summary: 'Logout and delete session',
          responses: {
            200: { description: 'Session deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            500: { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/logout': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Sessions'],
          summary: 'Logout session (keep DB record)',
          responses: {
            200: { description: 'Logged out', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/reconnect': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Sessions'],
          summary: 'Reconnect / restart a session',
          responses: {
            200: { description: 'Reconnecting', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      // ── WhatsApp Messages ─────────────────────────────────────────────────────
      '/whatsapp/sessions/{sessionId}/messages/text': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send text message',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jid', 'text'],
                  properties: {
                    jid: { type: 'string', description: 'Recipient JID (e.g. 15551234567 or 15551234567@s.whatsapp.net)' },
                    text: { type: 'string' },
                    mentionedJids: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/image': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send image',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['jid'],
                  properties: {
                    jid: { type: 'string' },
                    caption: { type: 'string' },
                    file: { type: 'string', format: 'binary' },
                    base64: { type: 'string', description: 'Base64 alternative to file upload' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/video': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send video',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['jid'],
                  properties: {
                    jid: { type: 'string' },
                    caption: { type: 'string' },
                    file: { type: 'string', format: 'binary' },
                    base64: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/audio': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send audio',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['jid'],
                  properties: {
                    jid: { type: 'string' },
                    ptt: { type: 'boolean', description: 'Send as voice note (push-to-talk)', default: false },
                    mimetype: { type: 'string', default: 'audio/mp4' },
                    file: { type: 'string', format: 'binary' },
                    base64: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/document': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send document',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['jid'],
                  properties: {
                    jid: { type: 'string' },
                    fileName: { type: 'string', default: 'file' },
                    mimetype: { type: 'string', default: 'application/octet-stream' },
                    caption: { type: 'string' },
                    file: { type: 'string', format: 'binary' },
                    base64: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/sticker': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send sticker',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['jid'],
                  properties: {
                    jid: { type: 'string' },
                    file: { type: 'string', format: 'binary' },
                    base64: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/location': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send location',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jid', 'lat', 'lng'],
                  properties: {
                    jid: { type: 'string' },
                    lat: { type: 'number', description: 'Latitude' },
                    lng: { type: 'number', description: 'Longitude' },
                    name: { type: 'string', description: 'Location name' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/contact': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send contact card',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jid', 'contactName', 'contactPhone'],
                  properties: {
                    jid: { type: 'string' },
                    contactName: { type: 'string' },
                    contactPhone: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/reaction': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send reaction to a message',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jid', 'messageId', 'emoji'],
                  properties: {
                    jid: { type: 'string' },
                    messageId: { type: 'string' },
                    remoteJid: { type: 'string' },
                    fromMe: { type: 'boolean' },
                    emoji: { type: 'string', example: '👍' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/poll': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send a poll',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jid', 'name', 'values'],
                  properties: {
                    jid: { type: 'string' },
                    name: { type: 'string', description: 'Poll question' },
                    values: { type: 'array', items: { type: 'string' }, minItems: 2, description: 'Poll options (at least 2)' },
                    selectableCount: { type: 'integer', default: 1 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/reply': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Reply to a message',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jid', 'messageId', 'text'],
                  properties: {
                    jid: { type: 'string' },
                    messageId: { type: 'string' },
                    remoteJid: { type: 'string' },
                    fromMe: { type: 'boolean' },
                    text: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/read': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Mark messages as read',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['keys'],
                  properties: {
                    keys: {
                      type: 'array',
                      description: 'Array of message keys to mark as read',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          remoteJid: { type: 'string' },
                          fromMe: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Marked', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },

      '/whatsapp/sessions/{sessionId}/messages/{messageId}': {
        parameters: [
          { name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'messageId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        put: {
          tags: ['WhatsApp Messages'],
          summary: 'Edit a message',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jid', 'text'],
                  properties: {
                    jid: { type: 'string' },
                    remoteJid: { type: 'string' },
                    fromMe: { type: 'boolean' },
                    text: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Edited', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
        delete: {
          tags: ['WhatsApp Messages'],
          summary: 'Delete a message',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jid'],
                  properties: {
                    jid: { type: 'string' },
                    remoteJid: { type: 'string' },
                    fromMe: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },

      // ── Legacy WA routes (wa.js) ──────────────────────────────────────────────
      '/{sessionId}/messages/send': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send text (legacy endpoint)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jid'],
                  properties: {
                    jid: { type: 'string' },
                    type: { type: 'string', enum: ['individual', 'group'], default: 'individual' },
                    message: {
                      type: 'object',
                      properties: {
                        text: { type: 'string' },
                        body: { type: 'string', description: 'Alias for text' },
                        mentions: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },

      '/{sessionId}/messages/send/bulk': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Bulk send text messages (legacy endpoint)',
          description: 'Sends text messages sequentially with a configurable delay between each. Numbers are verified before sending.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['jid'],
                        properties: {
                          jid: { type: 'string' },
                          type: { type: 'string', enum: ['number', 'group'], default: 'number' },
                          delay: { type: 'integer', description: 'Delay in ms before this message', default: 1000 },
                          message: { type: 'object', properties: { text: { type: 'string' } } },
                        },
                      },
                    },
                    {
                      type: 'object',
                      properties: {
                        messages: {
                          type: 'array',
                          items: { type: 'object' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Bulk result',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'object',
                            properties: {
                              results: { type: 'array', items: { type: 'object' } },
                              errors: { type: 'array', items: { type: 'object' } },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },

      '/{sessionId}/send-media/send': {
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['WhatsApp Messages'],
          summary: 'Send media (legacy endpoint)',
          description: 'Send image / video / audio / document via multipart form. File type is auto-detected.',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['media', 'data'],
                  properties: {
                    media: { type: 'string', format: 'binary', description: 'Media file (max 64 MB)' },
                    data: {
                      type: 'string',
                      description: 'JSON string: { jid, type?, message?, caption? }',
                      example: '{"jid":"15551234567","caption":"Hello!"}',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      // ── Message History ───────────────────────────────────────────────────────
      '/messages': {
        get: {
          tags: ['Message History'],
          summary: 'Get paginated message history',
          parameters: [
            { name: 'channel', in: 'query', schema: { type: 'string', enum: ['whatsapp', 'email', 'sms'] } },
            { name: 'sessionId', in: 'query', schema: { type: 'string' } },
            { name: 'direction', in: 'query', schema: { type: 'string', enum: ['inbound', 'outbound'] } },
            { name: 'jid', in: 'query', schema: { type: 'string' }, description: 'Filter by phone number or JID' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: {
            200: {
              description: 'Messages list',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
                          total: { type: 'integer' },
                          skip: { type: 'integer' },
                          limit: { type: 'integer' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
          },
        },
      },

      '/messages/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'MongoDB ObjectId' }],
        get: {
          tags: ['Message History'],
          summary: 'Get a single message by ID',
          responses: {
            200: { description: 'Message', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { type: 'object', properties: { data: { $ref: '#/components/schemas/Message' } } }] } } } },
            404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      // ── Config ────────────────────────────────────────────────────────────────
      '/config/email': {
        get: {
          tags: ['Config'],
          summary: 'List email configurations (admin)',
          security: [],
          description: 'Requires an active admin session (cookie-based). Not accessible via API key.',
          responses: {
            200: { description: 'Email configs', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/EmailConfig' } } } }] } } } },
            401: { description: 'Not authenticated' },
          },
        },
        post: {
          tags: ['Config'],
          summary: 'Create email configuration (admin)',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['host'],
                  properties: {
                    name: { type: 'string' },
                    host: { type: 'string' },
                    port: { type: 'integer', default: 587 },
                    secure: { type: 'boolean', default: false },
                    user: { type: 'string' },
                    pass: { type: 'string', format: 'password' },
                    from: { type: 'string' },
                    isActive: { type: 'boolean', default: true },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Created', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { type: 'object', properties: { data: { $ref: '#/components/schemas/EmailConfig' } } }] } } } },
          },
        },
      },

      '/config/email/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        put: {
          tags: ['Config'],
          summary: 'Update email configuration (admin)',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EmailConfig' } } },
          },
          responses: {
            200: { description: 'Updated' },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Config'],
          summary: 'Delete email configuration (admin)',
          security: [],
          responses: {
            200: { description: 'Deleted' },
          },
        },
      },

      '/config/email/test': {
        post: {
          tags: ['Config'],
          summary: 'Test email connection (admin)',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    host: { type: 'string' },
                    port: { type: 'integer' },
                    secure: { type: 'boolean' },
                    user: { type: 'string' },
                    pass: { type: 'string', format: 'password' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Connection OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            500: { description: 'Connection failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      '/config/sms': {
        get: {
          tags: ['Config'],
          summary: 'List SMS configurations (admin)',
          security: [],
          responses: {
            200: { description: 'SMS configs', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/SmsConfig' } } } }] } } } },
          },
        },
        post: {
          tags: ['Config'],
          summary: 'Create SMS configuration (admin)',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    provider: { type: 'string', example: 'generic_http' },
                    apiUrl: { type: 'string' },
                    apiUsername: { type: 'string' },
                    apiPassword: { type: 'string', format: 'password' },
                    apiKey: { type: 'string', format: 'password' },
                    from: { type: 'string' },
                    isActive: { type: 'boolean', default: true },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Created', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { type: 'object', properties: { data: { $ref: '#/components/schemas/SmsConfig' } } }] } } } },
          },
        },
      },

      '/config/sms/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        put: {
          tags: ['Config'],
          summary: 'Update SMS configuration (admin)',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SmsConfig' } } },
          },
          responses: {
            200: { description: 'Updated' },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Config'],
          summary: 'Delete SMS configuration (admin)',
          security: [],
          responses: {
            200: { description: 'Deleted' },
          },
        },
      },
    },
  },
  apis: [], // spec is fully inline above
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
