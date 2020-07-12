# A really slick ORM for MongoDB.

## Getting Started

```sh
yarn add esix
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
