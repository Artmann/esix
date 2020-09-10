# A really slick ORM for MongoDB.

Inspired by ActiveRecord and Eloquent, Esix is a great way to work with your database in TypeScript. 🥧

Esix uses a Convention over Configuration approach where you define your models as normal TypeScript classes and minimal boilerplate.

## Getting Started

```sh
yarn add esix mongodb
```

Define a model.

```ts
import { BaseModel } from 'esix';

class Post extends BaseModel {
  public title = '';
  public text = '';
}
```

Then you can query the database for your models.

```ts
async function postsHandler(request: Request, response: Response): Promise<void> {
  const posts = await Post.all();

  response.json({ posts });
}

async function postHandler(request: Request, response: Response): Promise<void> {
  const post = await Post.find(request.params.id);

  response.json({ post });
}
```

You can read more about how to use Esix at the docuementation site [https://esix.netlify.app/](https://esix.netlify.app/).
