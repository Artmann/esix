import { sanitize } from './sanitize'

describe('sanitize', () => {
  it('handles objects', () => {
    const query = {
      password: 'hunter1',
      username: 'john'
    }

    expect(sanitize(query)).toEqual({
      password: 'hunter1',
      username: 'john'
    })
  })

  it('removes keys starting with $.', () => {
    const query = {
      password: { $ne: null },
      username: { $ne: null }
    }

    expect(sanitize(query)).toEqual({
      password: {},
      username: {}
    })
  })

  it.each([
    [null],
    [undefined],
    [32],
    [['5f0aeaeacff57e3ec676b340', '5f0aefba348289a81889a920']],
    ['Hello World'],
    [true],
    [false]
  ])('does not modify %p values.', (value) => {
    expect(sanitize(value)).toEqual(value)
  })
})
