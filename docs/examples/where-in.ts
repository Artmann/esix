import Comment from './models/comment.js'
import comments from './comments.json' assert { type: 'json' }

export default {
  code: () => Comment
    .whereIn('postId', ['post-3', 'post-4'])
    .get(),
  dataset: comments,
  output: [
   {
      id: 'comment-5',
      postId: 'post-3',
      text: 'Is MongoDB webscale?'
    },
    {
      id: 'comment-6',
      postId: 'post-4',
      text: 'Needs more jQuery!'
    }
  ]
}
