import { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import { CoreMessage } from 'ai'

export function convertToCore(messages: ChatCompletionMessageParam[]): CoreMessage[] {
  return messages
    .map(msg => {
      switch (msg.role) {
        case 'user':
          if (typeof msg.content === 'string') {
            return { role: 'user' as const, content: msg.content }
          }
          if (msg.content === null) {
            return { role: 'user' as const, content: '' }
          }
          if (Array.isArray(msg.content)) {
            const parts = msg.content
              .map(part => {
                if (part.type === 'text') {
                  return { type: 'text' as const, text: part.text }
                }
                if (part.type === 'image_url') {
                  return { type: 'image' as const, image: part.image_url.url }
                }
                return null
              })
              .filter((part): part is NonNullable<typeof part> => part !== null)

            return { role: 'user' as const, content: parts }
          }
          return null

        case 'assistant':
          if (msg.content && typeof msg.content === 'string') {
            return { role: 'assistant' as const, content: msg.content }
          }
          if (msg.content && Array.isArray(msg.content)) {
            return {
              role: 'assistant' as const,
              content: msg.content
                .map(c => {
                  if (c.type === 'text') {
                    return { type: 'text' as const, text: c.text }
                  }
                  return null
                })
                .filter((c): c is NonNullable<typeof c> => c !== null)
            }
          }

          if (msg.tool_calls) {
            return {
              role: 'assistant' as const,
              content: msg.tool_calls.map(tc => {
                return {
                  type: 'tool-call' as const,
                  toolCallId: tc.id,
                  toolName: tc.function.name,
                  args: JSON.parse(tc.function.arguments || '{}')
                }
              })
            }
          }

        default:
          return null
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}
