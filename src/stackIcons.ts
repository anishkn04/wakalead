import vscode from 'devicon/icons/vscode/vscode-original.svg'
import intellij from 'devicon/icons/intellij/intellij-original.svg'
import pycharm from 'devicon/icons/pycharm/pycharm-original.svg'
import webstorm from 'devicon/icons/webstorm/webstorm-original.svg'
import phpstorm from 'devicon/icons/phpstorm/phpstorm-original.svg'
import goland from 'devicon/icons/goland/goland-original.svg'
import clion from 'devicon/icons/clion/clion-original.svg'
import rider from 'devicon/icons/rider/rider-original.svg'
import androidstudio from 'devicon/icons/androidstudio/androidstudio-original.svg'
import xcode from 'devicon/icons/xcode/xcode-original.svg'
import eclipse from 'devicon/icons/eclipse/eclipse-original.svg'
import vim from 'devicon/icons/vim/vim-original.svg'
import neovim from 'devicon/icons/neovim/neovim-original.svg'
import emacs from 'devicon/icons/emacs/emacs-original.svg'
import atom from 'devicon/icons/atom/atom-original.svg'
import jetbrains from 'devicon/icons/jetbrains/jetbrains-original.svg'
import datagrip from 'devicon/icons/datagrip/datagrip-original.svg'
import jupyter from 'devicon/icons/jupyter/jupyter-original.svg'
import rstudio from 'devicon/icons/rstudio/rstudio-original.svg'
import gcc from 'devicon/icons/gcc/gcc-original.svg'

import windows11 from 'devicon/icons/windows11/windows11-original.svg'
import windows8 from 'devicon/icons/windows8/windows8-original.svg'
import apple from 'devicon/icons/apple/apple-original.svg'
import linux from 'devicon/icons/linux/linux-original.svg'
import ubuntu from 'devicon/icons/ubuntu/ubuntu-original.svg'
import fedora from 'devicon/icons/fedora/fedora-original.svg'
import archlinux from 'devicon/icons/archlinux/archlinux-original.svg'
import debian from 'devicon/icons/debian/debian-original.svg'
import centos from 'devicon/icons/centos/centos-original.svg'
import almalinux from 'devicon/icons/almalinux/almalinux-original.svg'
import linuxmint from 'devicon/icons/linuxmint/linuxmint-original.svg'
import kalilinux from 'devicon/icons/kalilinux/kalilinux-original.svg'

/** Resolve a WakaTime editor name to a devicon SVG. */
const EDITOR_ICONS: Record<string, string> = {
  'vs code': vscode,
  vscode: vscode,
  'visual studio code': vscode,
  'visual studio': vscode,
  'code': vscode,
  intellij: intellij,
  'intellij idea': intellij,
  'idea': intellij,
  pycharm: pycharm,
  webstorm: webstorm,
  phpstorm: phpstorm,
  goland: goland,
  clion: clion,
  rider: rider,
  'android studio': androidstudio,
  xcode: xcode,
  eclipse: eclipse,
  vim: vim,
  neovim: neovim,
  emacs: emacs,
  atom: atom,
  jetbrains: jetbrains,
  datagrip: datagrip,
  jupyter: jupyter,
  'jupyter notebook': jupyter,
  rstudio: rstudio,
  'gcc': gcc,
  'textmate': atom,
  'sublime': atom,
  'sublime text': atom,
  'notepad++': atom,
}

/** Resolve a WakaTime OS name to a devicon SVG. */
const OS_ICONS: Record<string, string> = {
  windows: windows11,
  'windows 11': windows11,
  'windows 10': windows8,
  'windows 8': windows8,
  win: windows11,
  macos: apple,
  'mac os': apple,
  'mac os x': apple,
  osx: apple,
  'os x': apple,
  'darwin': apple,
  mac: apple,
  linux: linux,
  'gnu/linux': linux,
  ubuntu: ubuntu,
  fedora: fedora,
  arch: archlinux,
  'arch linux': archlinux,
  debian: debian,
  centos: centos,
  'alma linux': almalinux,
  'linux mint': linuxmint,
  mint: linuxmint,
  kali: kalilinux,
  'kali linux': kalilinux,
}

export function getEditorIcon(name: string): string | undefined {
  return EDITOR_ICONS[name.toLowerCase()]
}

export function getOsIcon(name: string): string | undefined {
  return OS_ICONS[name.toLowerCase()]
}
