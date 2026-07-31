import typescript from 'devicon/icons/typescript/typescript-original.svg'
import javascript from 'devicon/icons/javascript/javascript-original.svg'
import python from 'devicon/icons/python/python-original.svg'
import php from 'devicon/icons/php/php-original.svg'
import java from 'devicon/icons/java/java-original.svg'
import go from 'devicon/icons/go/go-original.svg'
import rust from 'devicon/icons/rust/rust-original.svg'
import c from 'devicon/icons/c/c-original.svg'
import cplusplus from 'devicon/icons/cplusplus/cplusplus-original.svg'
import csharp from 'devicon/icons/csharp/csharp-original.svg'
import html5 from 'devicon/icons/html5/html5-original.svg'
import css3 from 'devicon/icons/css3/css3-original.svg'
import sass from 'devicon/icons/sass/sass-original.svg'
import ruby from 'devicon/icons/ruby/ruby-original.svg'
import swift from 'devicon/icons/swift/swift-original.svg'
import kotlin from 'devicon/icons/kotlin/kotlin-original.svg'
import dart from 'devicon/icons/dart/dart-original.svg'
import vuejs from 'devicon/icons/vuejs/vuejs-original.svg'
import react from 'devicon/icons/react/react-original.svg'
import svelte from 'devicon/icons/svelte/svelte-original.svg'
import bash from 'devicon/icons/bash/bash-original.svg'
import powershell from 'devicon/icons/powershell/powershell-original.svg'
import json from 'devicon/icons/json/json-original.svg'
import yaml from 'devicon/icons/yaml/yaml-original.svg'
import markdown from 'devicon/icons/markdown/markdown-original.svg'
import mysql from 'devicon/icons/mysql/mysql-original.svg'
import postgresql from 'devicon/icons/postgresql/postgresql-original.svg'
import sqlite from 'devicon/icons/sqlite/sqlite-original.svg'
import mongodb from 'devicon/icons/mongodb/mongodb-original.svg'
import redis from 'devicon/icons/redis/redis-original.svg'
import nodejs from 'devicon/icons/nodejs/nodejs-original.svg'
import graphql from 'devicon/icons/graphql/graphql-plain.svg'
import lua from 'devicon/icons/lua/lua-original.svg'
import elixir from 'devicon/icons/elixir/elixir-original.svg'
import haskell from 'devicon/icons/haskell/haskell-original.svg'
import zig from 'devicon/icons/zig/zig-original.svg'
import terraform from 'devicon/icons/terraform/terraform-original.svg'
import tailwindcss from 'devicon/icons/tailwindcss/tailwindcss-original.svg'
import r from 'devicon/icons/r/r-original.svg'
import solidity from 'devicon/icons/solidity/solidity-original.svg'

const LANGUAGE_ICONS: Record<string, string> = {
  typescript,
  tsx: react,
  javascript,
  jsx: react,
  python,
  php,
  java,
  go: go,
  golang: go,
  rust,
  c,
  'c++': cplusplus,
  cpp: cplusplus,
  'c#': csharp,
  csharp,
  html: html5,
  html5: html5,
  css: css3,
  css3: css3,
  scss: sass,
  sass: sass,
  ruby,
  swift,
  kotlin,
  dart,
  vue: vuejs,
  'vue.js': vuejs,
  react,
  svelte,
  shell: bash,
  'shell script': bash,
  bash,
  zsh: bash,
  powershell,
  json,
  yaml,
  markdown,
  sql: sqlite,
  mysql,
  postgresql,
  sqlite,
  mongodb,
  redis,
  'node.js': nodejs,
  graphql,
  lua,
  elixir,
  haskell,
  zig,
  terraform,
  tailwind: tailwindcss,
  'tailwind css': tailwindcss,
  r,
  solidity,
}

export function getLanguageIcon(name: string): string | undefined {
  return LANGUAGE_ICONS[name.toLowerCase()]
}

export function languageHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 360
}
