import { Product } from './models/product';
import products from './data-sets/products/products.json';

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
