import { z } from 'zod'

// Base webhook payload from Chatwoot
export const chatwootWebhookSchema = z.object({
  event: z.string(),
  id: z.number().optional(),
  account: z.object({
    id: z.number(),
  }).optional(),
})

// Contact payload
export const chatwootContactSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  custom_attributes: z.record(z.unknown()).optional().default({}),
})

// Conversation payload
export const chatwootConversationSchema = z.object({
  id: z.number(),
  status: z.string().optional(),
  assignee: z.object({
    name: z.string().optional(),
  }).nullable().optional(),
  inbox: z.object({
    name: z.string().optional(),
  }).nullable().optional(),
  contact: chatwootContactSchema.optional(),
  custom_attributes: z.record(z.unknown()).optional().default({}),
  labels: z.array(z.string()).optional().default([]),
})

// Message payload
export const chatwootMessageSchema = z.object({
  id: z.number(),
  message_type: z.number(), // 0 = incoming, 1 = outgoing
  conversation: z.object({
    id: z.number(),
  }).optional(),
  created_at: z.number().optional(),
})

// Full webhook event payloads
export const conversationCreatedSchema = chatwootWebhookSchema.extend({
  event: z.literal('conversation_created'),
  ...chatwootConversationSchema.shape,
})

export const conversationUpdatedSchema = chatwootWebhookSchema.extend({
  event: z.literal('conversation_updated'),
  ...chatwootConversationSchema.shape,
})

export const contactCreatedSchema = chatwootWebhookSchema.extend({
  event: z.literal('contact_created'),
  ...chatwootContactSchema.shape,
})

export const contactUpdatedSchema = chatwootWebhookSchema.extend({
  event: z.literal('contact_updated'),
  ...chatwootContactSchema.shape,
})

export const messageCreatedSchema = chatwootWebhookSchema.extend({
  event: z.literal('message_created'),
  ...chatwootMessageSchema.shape,
})

export type ChatwootWebhookPayload = z.infer<typeof chatwootWebhookSchema>
export type ChatwootContact = z.infer<typeof chatwootContactSchema>
export type ChatwootConversation = z.infer<typeof chatwootConversationSchema>
export type ChatwootMessage = z.infer<typeof chatwootMessageSchema>
