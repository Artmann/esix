import Post from './models/post.js'
import posts from './posts.json' assert { type: 'json' }

export default {
  code: async (): Promise<Post> => {
  const post = new Post()

  post.title = 'Creating & Updating Data'
  post.slug = 'creating-and-updating-data'

  await post.save()

  return post
},
  dataset: posts,
  output: {
    id: '63ee98b7357e3e41a307ec29',
    createdAt: 1676572245568,
    slug: 'creating-and-updating-data',
    title: 'Creating & Updating Data',
    updatedAt: null
  }
}
