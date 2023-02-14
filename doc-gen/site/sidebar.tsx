import React, { ReactElement } from 'react'
import _styled from 'styled-components'

// @ts-ignore
const styled = _styled.default

type SidebarProps = {
  slug: string
}

export function Sidebar({ slug }: SidebarProps): ReactElement {
  const links = {
    'Getting Started': '/',
    'Defining Models': '/defining-models',
    'Reading Data': '/reading-data',
    'Creating & Updating Data': '/creating-and-updating-data',
    'Deleting Data': '/deleting-data',
    'Configuring Esix': '/configuration',
    'API Reference': '/api-reference',
    'GitHub': 'https://github.com/artmann/esix'
  }

  return (
    <Container aria-label='Main Navigation'>
      {
        Object.entries(links).map(([title, href]) => (
          <SidebarItem key={ title } active={ href.includes(slug) }>
            <SidebarLink
              href={ href }
              title={ title }
            >
              { title }
            </SidebarLink>
          </SidebarItem>
        ))
      }
    </Container>
  )
}

const Container = styled.nav`
  display: flex;
  flex-direction: column;
  flex-gap: 0.5rem;
  flex-shrink: 0;
  gap: 1rem;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 1.5rem;
  padding-right: 2rem;
  position: sticky;
  top: 4rem;
  width: calc(280px - 4rem);

  @media (max-width: 768px) {
    position: relative;
  }
`

const SidebarItem = styled.div<{ active?: boolean }>`
  background: ${ props => props.active ? '#e9d5ff' : 'transparent' };
  border-radius: 0.2rem;
  color: #7e22ce;
  display: flex;
  margin-left: -0.75rem;
  padding: 0.5rem 0.75rem;
  user-select: none;
`

const SidebarLink = styled.a`
  color: #374151;
  display: block;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
`
