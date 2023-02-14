import Product from './models/product.js'
import products from './products.json' assert { type: 'json' }

export default {
  code: () => Product
    .where('brand', 'Google')
    .sum('price'),
  dataset: products,
  output: 1200
}
