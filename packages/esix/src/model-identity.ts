import type { ObjectId } from 'mongodb'
import type BaseModel from './base-model'

const identities = new WeakMap<
  BaseModel,
  { id: string; raw: string | ObjectId }
>()

export function rememberIdentity(
  model: BaseModel,
  raw: string | ObjectId
): void {
  identities.set(model, { id: model.id, raw })
}

export function modelIdentity(model: BaseModel): string | ObjectId {
  const saved = identities.get(model)
  return saved?.id === model.id ? saved.raw : model.id
}
