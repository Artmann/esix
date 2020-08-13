import 'reflect-metadata';

import QueryBuilder from './query-builder';
import { ObjectType, Dictionary } from './types';

export default class BaseModel {
  public createdAt = 0;
  public id = '';
  public updatedAt: number | null = null;

  static async all<T extends BaseModel>(this: ObjectType<T>): Promise<T[]> {
    return new QueryBuilder(this).where({}).get();
  }

  static async create<T extends BaseModel>(this: ObjectType<T>, attributes: Dictionary): Promise<T> {
    const queryBuilder = new QueryBuilder(this);

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

  static whereIn<T extends BaseModel>(this: ObjectType<T>, fieldName: string, values: any[]): QueryBuilder<T> {
    const queryBuilder = new QueryBuilder(this);

    return queryBuilder.whereIn(fieldName, values);
  }

  async save(): Promise<void> {
    const queryBuilder = new QueryBuilder(this.constructor as ObjectType<BaseModel>);

    if (this.id) {
      this.updatedAt = Date.now();
    } else {
      this.createdAt = Date.now();
    }

    const attributes = { ...this };

    const id = await queryBuilder.save(attributes);

    if (!this.id) {
      this.id = id;
    }
  }
}
