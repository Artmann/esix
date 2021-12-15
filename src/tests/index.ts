export function randomDatabaseName(): string {
  const length = 18;
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

  let name = 'test-';

  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * characters.length);

    name += characters[index];
  }

  return name;
}
