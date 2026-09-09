import { expect, it } from 'vitest'
import { BaseModel } from './index'
class TypedModel extends BaseModel {
  name = ''
  score = 0
}
it('restricts increment and decrement to numeric model properties', () => {
  // Compile this function without executing database operations.
  const check = () => {
    TypedModel.where('name', 'x').increment('score')
    // @ts-expect-error strings cannot be incremented
    TypedModel.where('name', 'x').increment('name')
    // @ts-expect-error methods cannot be decremented
    TypedModel.where('name', 'x').decrement('save')
  }
  expect(typeof check).toBe('function')
})
