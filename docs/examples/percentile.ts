import Product from './models/product.js'
import products from './products.json' assert { type: 'json' }

export default {
  code: () => Product
    .where('brand', 'Google')
    .percentile('price', 95),
  dataset: products,
  output: 700
}
