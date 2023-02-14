import Comment from './models/comment.js'
import comments from './comments.json' assert { type: 'json' }

export default {
  code: () => Comment
    .where('postId', 'post-1')
    .limit(2),
  dataset: comments,
  output: [
    {
      id: 'comment-1',
      postId: 'post-1',
      text: 'Great Post!'
    },
    {
      id: 'comment-2',
      postId: 'post-1',
      text: 'Amazing Content 🔥'
    }
  ]
}
