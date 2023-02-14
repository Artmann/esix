import Product from './models/product.js'
import products from './products.json' assert { type: 'json' }

export default {
  code: () => Product
    .where('brand', 'Google')
    .first(),
  dataset: products,
  output: {
    id: '1',
    brand: 'Google',
    name: 'Pixel 5',
    price: 500
  }
}
