---
title: Deleting Models
---

# Deleting Models

Once your data is no longer needed, Esix provides two ways of removing models
from the database. You can either use an instance of a model to delete that
model or you can create a query to remove multiple models.

## Deleting a Single Model

If you have a single model you want to delete, you can use the `delete` method
on the instance.

Keep in mind that the data is instantly removed and won't be recoverable.

```ts
const post = await BlogPost.find('5f5a4c36493d53b6caa8410e')

await post.delete()
```

## Deleting Multiple Models

If you want to remove models in bulk, you can use the normal methods available
on the QueryBuilder to create a matching selection.

```ts
await Jobs.where('completed', true).limit(12).delete()
```
