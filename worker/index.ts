interface Env {
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/geo') {
      return Response.json(
        { country: request.cf?.country ?? null },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
