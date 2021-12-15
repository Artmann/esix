import { createElement } from 'react';
import ReactDOMServer from 'react-dom/server';

import { Example } from './example';
import { ExampleComponent } from './example-component';

export function renderExample(example: Example): string {
  const component = createElement(ExampleComponent, {
    example
  });

  const html = ReactDOMServer.renderToString(component);

  return html;
}
