import { v1 as createUuid } from 'uuid';
import mongodb from 'mongo-mock';

import { BaseModel } from './';
import { connectionHandler } from './connection-handler';

mongodb.max_delay = 1;

class User extends BaseModel {
  public password = '';
  public username = '';
}

describe('Injections', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      'DB_ADAPTER': 'mock',
      'DB_DATABASE': `test-${ createUuid() }`
    });
  });

  afterAll(() => {
    connectionHandler.closeConnections();
  });

  it('prevents NoSQL injections using an object', async() => {
    const username = 'Tim';
    const password = { $ne: 1 };

    await User.create({
      password: 'secretstuff',
      username: 'Tim'
    });

    const user = await User
      .where('username', username)
      .where('password', password)
      .first();

    expect(user).toBeNull();
  });

});
