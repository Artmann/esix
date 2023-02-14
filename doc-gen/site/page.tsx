import React, { ReactElement } from 'react'
import _styled from 'styled-components'

import { GlobalStyle } from './global-styles.js'
import { Sidebar } from './sidebar.js'

// @ts-ignore
const styled = _styled.default

type PageProps = {
  children: ReactElement
  slug: string
  title: string
}

export function Page({ children, slug, title }: PageProps): ReactElement {
  return (
    <>
      <GlobalStyle/>

      <Header>
        <HeaderContainer>
          <HeaderLogoContainer>
            <HeaderLogo href="/">ESIX</HeaderLogo>
          </HeaderLogoContainer>
        </HeaderContainer>
      </Header>

      <Container>
        <Sidebar slug={ slug } />

        <ContentContainer>
          <h1>
            { title }
          </h1>

          <Content className='content'>
            { children }
          </Content>
        </ContentContainer>
      </Container>
    </>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: row;
  margin: 0 auto;
  max-width: 1200px;
  padding: 0 2rem;
  width: calc(100% - 4rem);
`

const ContentContainer = styled.div`
  padding: 2rem;
  padding-bottom: 16rem;
`

const Content = styled.div`
  font-size: 16px;
  line-height: 1.75;
`

const Header = styled.header`
  background: #fff;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  left: 0px;
  position: sticky;
  right: 0px;
  top: 0px;
  transition: box-shadow 0.2s ease 0s, background-color 0.2s ease 0s;
  width: 100%;
  z-index: 3;
}
`

const HeaderContainer = styled.div`
  display: flex;
  max-width: 1200px;
  margin: 0 auto;
`

const HeaderLogoContainer = styled.div`
  flex-grow: 1;
  padding: 0.5rem 1.5rem;
`

const HeaderLogo = styled.a`
  color: #374151;
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  text-decoration: none;
`
