import lodash from 'lodash'
import React, { ReactElement } from 'react'
import _styled from 'styled-components'

// @ts-ignore
const styled = _styled.default
const { capitalize } = lodash

export function Table(props: { rows: any[], type: string } ): ReactElement {
  const [ firstRow ] = props.rows
  const keys = Object.keys(firstRow)

  return (
    <ExampleTable>
      <ExampleTableHeader>
        <tr>
          {
            keys.map((key: string) => (
              <ExampleTableHeaderColumn key={ key }>
                { capitalize(key) }
              </ExampleTableHeaderColumn>
            ))
          }
          <ExampleTableHeaderColumn center>
            <Type>
              { props.type }
            </Type>
          </ExampleTableHeaderColumn>
        </tr>
      </ExampleTableHeader>
      <tbody>
        {
          props.rows.map((row: any, index: number) => (
            <tr key={ index }>
              {
                keys.map((key: string) => <ExampleTableColumn key={ `${ key }-${ index }` }>{ row[key] }</ExampleTableColumn>)
              }
              <ExampleTableColumn />
            </tr>
          ))
        }
      </tbody>
    </ExampleTable>
  )
}

const ExampleTable = styled.table`
  border-collapse: collapse;
  border: solid 1px rgb(241, 245, 249);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  font-size: .875rem;
  line-height: 1.25rem;
  margin: 1rem 0;
  table-layout: auto;
  width: 100%;
`

const ExampleTableHeader = styled.thead`
  color: #4b5563;
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
`

const ExampleTableHeaderColumn = styled.th<{ center?: boolean }>`
  background: #f1f5f9;
  border-bottom: solid 1px rgb(226, 232, 240);
  padding: 0.75rem 0;
  text-align: ${ props => props.center ? 'center' : 'left' };
  width: ${ props => props.center ? '5rem' : 'auto' };

  &:first-child {
    padding-left: 1.25rem;
  }

  &:last-child {
    padding-right: 1.25rem;
  }
`

const ExampleTableColumn = styled.td`
  border-bottom: solid 1px rgb(241, 245, 249);
  color: rgb(100, 116, 139);
  padding: 0.75rem 0;

  &:first-child {
    padding-left: 1.25rem;
  }

  &:last-child {
    padding-right: 1.25rem;
  }
`

const Type = styled.span`
  background: #cbd5e1;
  border-radius: 8px;
  color: #047857;
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 0.3rem 0.75rem;
  text-transform: uppercase;
`
