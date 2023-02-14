import { createGlobalStyle } from 'styled-components'

export const GlobalStyle = createGlobalStyle`
  body {
    color: #374151;
    font-family: 'Inter', sans-serif;
    font-size: 16px;
    font-weight: 400;
    margin: 0;
    padding: 0;

    -webkit-font-smoothing: antialiased;
  }

  div {
    display: flex;
    flex-direction: column;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'Poppins', sans-serif;
    font-weight: 700;
    margin: 0;
    margin-bottom: 0.5rem;
  }

  h1 {
    font-size: 1.875rem;
  }

  h2 {
    font-size: 1.5rem;
    margin-top: 1rem;
  }

  h3, h4 {
    font-size: 1.25rem;
    margin-top: 1rem;
  }

  code {
    font-family: 'Source Code Pro', source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace;
  }

  .content p, .content pre, .content img, .content iframe, .content h2, .content h3, .content h4 {
    height: auto;
    margin-top: 1rem;
    max-width: 100%;
  }

  .content a {
    color: #7e22ce;
    padding-bottom: 12rem;
    text-decoration: none;
  }

  .content a:hover {
    text-decoration: underline;
  }

  .content a:visited {
    color: #7e22ce;
    text-decoration: none;
  }

  .content p > code {
    background-color: rgba(175, 184, 193, 0.3);
    border-radius: 6px;
    color: rgba(167, 21, 21, 0.9);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 85%;
    margin: 0;
    padding: .2em .4em;
  }


  .content pre {
    background-color: rgba(17, 24, 39, 0.9);
    color: #dcd6b0;
    font-size: 0.875rem;
    line-height: 1.5rem;
    overflow-x: auto;
    word-break: break-all;

    --tw-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
  }

  .content pre > code {
    background-color: transparent;
  }
`
