import Post from './models/post.js'
import posts from './posts.json' assert { type: 'json' }

export default {
  code: () => Post.create({
  slug: 'creating-and-updating-data',
  title: 'Creating & Updating Data'
}),
  dataset: posts,
  output: {
    id: '63ee98a9fb4581fb77e47311',
    createdAt: 1676572245568,
    slug: 'creating-and-updating-data',
    title: 'Creating & Updating Data',
    updatedAt: null
  }
}
