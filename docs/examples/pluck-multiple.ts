import Product from './models/product.js'
import products from './products.json' assert { type: 'json' }

export default {
  code: () => Product
    .where('brand', 'Google')
    .pluck('name', 'price'),
  dataset: products,
  output: [
    {
      name: 'Pixel 5',
      price: 500
    },
    {
      name: 'Pixel 6',
      price: 700
    }
  ]
}
