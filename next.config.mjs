/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

// Card do lead dentro do Chatwoot (Dashboard App): só /embed/* pode abrir em iframe,
// e só dentro do Chatwoot do HSM. Mesma lista de src/lib/chatwoot/embed.ts.
function origem(url) {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}
const chatwootOrigens = Array.from(
  new Set(
    ['https://chat.hospitalsantamonica.com.br', process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL]
      .map(origem)
      .filter(Boolean)
  )
)
const embedHeaders = [
  ...securityHeaders.filter((h) => h.key !== 'X-Frame-Options'),
  { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${chatwootOrigens.join(' ')}` },
]

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/((?!embed/).*)', headers: securityHeaders },
      { source: '/embed/:path*', headers: embedHeaders },
    ]
  },
}

export default nextConfig
