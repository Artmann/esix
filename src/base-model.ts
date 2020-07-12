import 'reflect-metadata';

import QueryBuilder from './query-builder';

type ObjectType<T> = { new (): T,  };

export default class BaseModel {
  public createdAt = 0;
  public id = '';
  public updatedAt = 0;

  static async all<T extends BaseModel>(this: ObjectType<T>): Promise<T[]> {
    return new QueryBuilder(this).where({}).get();
  }

  static async find<T extends BaseModel>(this: ObjectType<T>, id?: string | number): Promise<T | null> {
    return new QueryBuilder(this).findOne({
      _id: id
    });
  }
}
