import Product from './models/product.js'
import products from './products.json' assert { type: 'json' }

export default {
  code: () => Product.findBy('name', 'Galaxy A71'),
  dataset: products,
  output: {
    id: '3',
    brand: 'Samsung',
    name: 'Galaxy A71',
    price: 300
  }
}
