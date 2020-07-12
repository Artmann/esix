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

  static async create<T extends BaseModel>(this: ObjectType<T>, attributes: { [index: string]: any }): Promise<T> {
    const queryBuilder = new QueryBuilder(this);

    if (attributes.hasOwnProperty('id')) {
      attributes._id = attributes.id;
      delete attributes.id;
    }

    const id = await queryBuilder.create(attributes);
    const model = await queryBuilder.findOne({
      _id: id
    });

    if (!model) {
      throw new Error('Failed to create model.');
    }

    return model;
  }

  static async find<T extends BaseModel>(this: ObjectType<T>, id?: string | number): Promise<T | null> {
    return new QueryBuilder(this).findOne({
      _id: id
    });
  }

  static where<T extends BaseModel>(this: ObjectType<T>, key: string, value: any): QueryBuilder<T> {
    return new QueryBuilder(this).where(key, value);
  }
}
