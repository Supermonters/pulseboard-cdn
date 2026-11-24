import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { messagingSchemas } from './schemas/messaging-schema'
import { aiChatSchemas } from './schemas/ai-chat-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  ...messagingSchemas,
  ...aiChatSchemas,
]
