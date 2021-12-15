import hljs from 'highlight.js';
import { capitalize } from 'lodash';
import React, { ReactElement } from 'react';

import { Example } from '.';

interface ExampleProps {
  example: Example;
};

export function ExampleComponent({ example }: ExampleProps): ReactElement {
  const isNumber = (a: any): a is number => !isNaN(a);
  const isObject = (a: any): a is object => (typeof a === 'object' || typeof a === 'function') && (a !== null);
  const isString = (a: any): a is string => typeof a === 'string';

  const text = example.text || '';

  if (isNumber(example.output) || isString(example.output)) {
    return (
      <CodeTag
        code={
`${ text }
// => ${ example.output }
`}
      />
    );
  }

  // The Array check has to come before the Object one as an Array is also an Object.
  if (Array.isArray(example.output)) {
    return (
      <>
        <CodeTag code={ text } />
        <Table rows={ example.output } type="array" />
      </>
    );
  }

  if (isObject(example.output)) {
    return (
      <>
        <CodeTag code={ text } />
        <Table rows={ [ example.output ] } type="object" />
      </>
    );
  }

  return (
    <>
      <CodeTag code={ text } />

      <CodeTag code={ JSON.stringify(example.output, null, 2) } />
    </>
  );
}

function CodeTag(props: { code: string } ): ReactElement {
  const html = hljs.highlight('ts', props.code).value;

  return (
    <pre>
      <code
        className='language-ts'
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
}

function Table(props: { rows: any[], type: string } ): ReactElement {
  const [ firstRow ] = props.rows;
  const keys = Object.keys(firstRow);

  return (
    <table className="example-table">
      <thead>
        <tr>
          { keys.map((key: string) => <th key={ key }>{ capitalize(key) }</th>) }
          <th className="type">
            <span>
              { props.type }
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {
          props.rows.map((row: any, index: number) => (
            <tr key={ index }>
              { keys.map((key: string) => <td key={ `${ key }-${ index }` }>{ row[key] }</td>) }
              <td></td>
            </tr>
          ))
        }
      </tbody>
    </table>
  );
}
