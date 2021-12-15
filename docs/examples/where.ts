import { Product } from './models/product';
import products from './data-sets/products/products.json';

export default {
  code: () => Product.where('brand', 'Google').get(),
  dataset: products,
  output: [
    {
      id: '1',
      brand: 'Google',
      name: 'Pixel 5',
      price: 500
    },
    {
      id: '2',
      brand: 'Google',
      name: 'Pixel 6',
      price: 700
    }
  ]
}
