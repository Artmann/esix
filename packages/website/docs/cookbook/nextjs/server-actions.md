---
title: Mutations with Server Actions
description: Build a comment form that creates and edits records using React Server Actions and Esix. Covers FormData parsing, validation, and revalidatePath.
---

Reads in the App Router happen inside async server components. Writes happen
through Server Actions — server functions you can hand directly to a `<form>`.
This recipe walks through both halves of the write path: posting a new
comment, and editing an existing one.

Esix features used: `create`, `save`, `find`. Next.js features used: `'use
server'`, FormData parsing, and `revalidatePath`.

## What You'll Build

A blog post page with a comment list and a form that appends a new comment.
The form submits to a Server Action — no `fetch`, no JSON handlers, no
`useState` for the input.

## The Comment Model

```ts
// app/models/comment.ts
import { BaseModel } from 'esix'

export default class Comment extends BaseModel {
  public postId = ''
  public authorName = ''
  public body = ''
}
```

## The Schema

Define what a valid comment looks like with zod — it doubles as the inferred
TypeScript type. Add `zod` to the project first:

```sh
yarn add zod
```

```ts
// app/posts/[id]/schema.ts
import { z } from 'zod'

export const CommentSchema = z.object({
  authorName: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(2000)
})

export type CommentInput = z.infer<typeof CommentSchema>
```

## The Action

Server Actions are async functions marked with the `'use server'` directive.
Keep them in their own file so the boundary is unmistakable, and the action
can be imported by both server *and* client components:

```ts
// app/posts/[id]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import Comment from '../../models/comment'
import { CommentSchema } from './schema'

export async function postComment(
  postId: string,
  formData: FormData
): Promise<void> {
  const input = CommentSchema.parse({
    authorName: formData.get('authorName'),
    body: formData.get('body')
  })

  await Comment.create({
    postId,
    authorName: input.authorName,
    body: input.body
  })

  revalidatePath(`/posts/${postId}`)
}
```

Three things are worth pointing out:

- **Validate before you write.** `CommentSchema.parse(...)` is one line and
  catches empty input, oversized payloads, and the wrong types in one go.
- **`Comment.create` returns the saved model.** If you need the new id for a
  redirect, capture the return value.
- **`revalidatePath` is what makes the new comment appear.** Without it
  Next.js will keep serving the cached HTML it built before the comment
  existed.

## Wiring the Form

Pass the action to the form's `action` prop. The hidden `postId` field is the
simplest way to bind the action to the current post:

```tsx
// app/posts/[id]/comment-form.tsx
import { postComment } from './actions'

interface Props {
  postId: string
}

export default function CommentForm({ postId }: Props) {
  return (
    <form action={postComment.bind(null, postId)}>
      <label>
        Your name
        <input name="authorName" required />
      </label>
      <label>
        Comment
        <textarea name="body" required />
      </label>
      <button type="submit">Post</button>
    </form>
  )
}
```

`bind` partially applies `postId` so the form only needs to carry the user's
input. This is a server component, so the action arrives at the form already
wired — there's no client-side `fetch` to write.

## The Page

Render the comments and the form together. Both queries run on the server,
inlined into the HTML on the way out:

```tsx
// app/posts/[id]/page.tsx
import { notFound } from 'next/navigation'
import Comment from '../../models/comment'
import Post from '../../models/post'
import CommentForm from './comment-form'

interface PageProps {
  params: { id: string }
}

export default async function PostPage({ params }: PageProps) {
  const post = await Post.find(params.id)

  if (!post) {
    notFound()
  }

  const comments = await Comment.where('postId', post.id)
    .orderBy('createdAt', 'asc')
    .get()

  return (
    <main>
      <h1>{post.title}</h1>
      <article>{post.body}</article>

      <section>
        <h2>Comments</h2>
        <ul>
          {comments.map((comment) => (
            <li key={comment.id}>
              <strong>{comment.authorName}:</strong> {comment.body}
            </li>
          ))}
        </ul>

        <CommentForm postId={post.id} />
      </section>
    </main>
  )
}
```

## Editing an Existing Record

The pattern is the same — load, mutate, save. The update schema is a partial
of `CommentSchema`, and the action assigns each validated field onto the model
one at a time so a client can't sneak in fields the form doesn't expose:

```ts
// app/posts/[id]/schema.ts (additional export)
export const UpdateCommentSchema = CommentSchema.partial()
```

```ts
// app/posts/[id]/actions.ts (additional export)
import { UpdateCommentSchema } from './schema'

export async function updateComment(
  commentId: string,
  formData: FormData
): Promise<void> {
  const comment = await Comment.find(commentId)

  if (!comment) {
    throw new Error('Comment not found')
  }

  const input = UpdateCommentSchema.parse({
    authorName: formData.get('authorName') ?? undefined,
    body: formData.get('body') ?? undefined
  })

  if (input.authorName !== undefined) comment.authorName = input.authorName
  if (input.body !== undefined) comment.body = input.body

  await comment.save()

  revalidatePath(`/posts/${comment.postId}`)
}
```

Setting fields one at a time — rather than spreading the parsed input or using
`Object.assign` — makes the writable surface explicit. Adding a new editable
field means touching this file, which is exactly the kind of review-prompting
friction you want when expanding what a form is allowed to change.

## Pattern Notes

- **One Server Actions file per route.** Co-locate the actions next to the
  page that uses them; the import graph stays obvious and the `'use server'`
  boundary is easy to audit.
- **`revalidatePath` for any data the user just changed.** Skipping it is the
  most common reason a form submission "did nothing" — the action ran, the
  page just rendered stale HTML afterwards.
- **Validate at the action, not the form.** Anyone can craft a request that
  bypasses HTML validation; trust only what your zod schema accepts.
- **Assign one field at a time.** Spreading parsed input into the model lets
  hidden form fields land in the database. Explicit `comment.body = input.body`
  lines spell out the writable surface.

## What's Next

- [Querying in Server Components](/docs/cookbook/nextjs/server-components) —
  the reads that pair with these writes.
- [Inserting and Updating Models](/docs/inserting-and-updating-models) — full
  reference for `create` and `save`.
- [Authentication with JWT](/docs/cookbook/express/authentication) — adapt the
  hashing pattern for a Next.js sign-up Server Action.
