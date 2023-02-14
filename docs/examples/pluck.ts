import Product from './models/product.js'
import products from './products.json' assert { type: 'json' }

export default {
  code: () => Product
    .where('brand', 'Google')
    .pluck('name'),
  dataset: products,
  output: [
    'Pixel 5',
    'Pixel 6'
  ]
}
