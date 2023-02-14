import React, { ReactElement } from 'react'

type HeaderProps = {
  title: string
}

export function Header({ title }: HeaderProps): ReactElement {
  return (
    <h2>
      { title }
    </h2>
  )
}
