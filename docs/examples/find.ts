import Product from './models/product.js'
import products from './products.json' assert { type: 'json' }

export default {
  code: () => Product.find('2'),
  dataset: products,
  output: {
    id: '2',
    brand: 'Google',
    name: 'Pixel 6',
    price: 700
  }
}
