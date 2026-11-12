import { createApiReference } from 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.78.0/esm.js'

createApiReference('#app', {
  url: '/api/openapi.json',
  theme: 'default',
  layout: 'modern',
  hideClientButton: true,
  mcp: { disabled: true },
  withDefaultFonts: false,
})

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const scalarCredit = 'a[href*="scalar.com"]'
const themeControl = '[aria-label$=" mode"]'
let fallbackTimer = 0
let themeTransition

if (!brandFooter()) {
  const brandObserver = new MutationObserver(() => {
    if (!brandFooter()) return
    window.clearTimeout(brandTimeout)
    brandObserver.disconnect()
  })
  const brandTimeout = window.setTimeout(() => brandObserver.disconnect(), 10_000)
  brandObserver.observe(document.querySelector('#app'), { childList: true, subtree: true })
}

document.addEventListener('click', animateThemeChange, true)

function brandFooter() {
  // shortcut: Scalar standalone has no footer slot, remove this DOM seam when one is exposed
  const link = [...document.querySelectorAll(scalarCredit)]
    .find((candidate) => candidate.textContent?.trim() === 'Powered by Scalar')
  if (!link) return false

  const brand = document.createElement('span')
  brand.className = `${link.className} nerdrage-brand`
  brand.textContent = 'Powered by NerdRage'
  link.replaceWith(brand)
  return true
}

function animateThemeChange(event) {
  const button = event.target instanceof Element
    ? event.target.closest('button[aria-pressed]')
    : null
  if (
    !button ||
    button.dataset.themeReplay ||
    !button.querySelector(themeControl) ||
    reducedMotion.matches
  ) return

  setThemeGeometry(button)
  if (typeof document.startViewTransition !== 'function') {
    clearTimeout(fallbackTimer)
    document.body.classList.remove('theme-fade')
    requestAnimationFrame(() => document.body.classList.add('theme-fade'))
    fallbackTimer = window.setTimeout(() => document.body.classList.remove('theme-fade'), 220)
    return
  }

  event.preventDefault()
  event.stopImmediatePropagation()
  themeTransition?.skipTransition?.()
  document.documentElement.classList.add('theme-wave')

  try {
    themeTransition = document.startViewTransition(() => replayClick(button))
  } catch (_) {
    document.documentElement.classList.remove('theme-wave')
    replayClick(button)
    return
  }

  const current = themeTransition
  const finish = () => {
    if (themeTransition !== current) return
    themeTransition = null
    document.documentElement.classList.remove('theme-wave')
  }
  current.finished.then(finish, finish)
}

function replayClick(button) {
  // Replay through Scalar so it keeps persistence and ARIA state
  button.dataset.themeReplay = 'true'
  button.click()
  delete button.dataset.themeReplay
}

function setThemeGeometry(button) {
  const rect = button.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )
  const root = document.documentElement.style
  root.setProperty('--theme-x', `${x}px`)
  root.setProperty('--theme-y', `${y}px`)
  root.setProperty('--theme-radius', `${radius}px`)
}
