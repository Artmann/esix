import { Product } from './models/product';
import products from './data-sets/products/products.json';

export default {
  code: () => Product.where('brand', 'Google').max('price'),
  dataset: products,
  output: 700
}
