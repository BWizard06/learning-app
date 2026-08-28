import { useDb } from '../db/client'
import { saveSession } from '../services/persist'
import { parseSessionPayload, ValidationError } from '../utils/validate'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let payload
  try {
    payload = parseSessionPayload(body)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof ValidationError ? error.message : 'invalid payload',
    })
  }

  try {
    const result = saveSession(useDb(), payload)
    setResponseStatus(event, result.created ? 201 : 200)
    return { id: payload.id, created: result.created, note: result.note }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'could not save session',
    })
  }
})
