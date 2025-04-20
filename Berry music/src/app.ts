import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { bearerAuth } from 'hono/bearer-auth'
import * as jose from 'jose'
import type { MiddlewareHandler, Context, Next } from 'hono'
import { Home } from './pages/home'
import type { Routes } from '#common/types'
import type { HTTPException } from 'hono/http-exception'

// --- Define Authentication Middleware ---
// Retrieve the Supabase JWT Secret from Environment Variables
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
let authMiddleware: MiddlewareHandler;

if (!JWT_SECRET) {
  // console.warn("SUPABASE_JWT_SECRET environment variable is not set! Auth middleware WILL NOT WORK.");
  // // Create a dummy middleware if secret is missing
  // authMiddleware = (c: Context, next: Next) => next();
  throw new Error("CRITICAL: SUPABASE_JWT_SECRET environment variable is not set. Application cannot start securely.");
} else {
  // Supabase requires the secret to be encoded
  const secret = new TextEncoder().encode(JWT_SECRET);
  
  authMiddleware = bearerAuth({
    verifyToken: async (token, c) => {
      try {
        const { payload } = await jose.jwtVerify(token, secret, {
          // audience: 'authenticated', // Optional: Add audience check
        });
        // Token is valid!
        if (payload.sub) {
          c.set('userId', payload.sub);
        }
        return true;
      } catch (e) {
        // Handle error type safely
        if (e instanceof Error) {
           console.error("JWT Verification failed:", e.message);
        } else {
           console.error("JWT Verification failed with unknown error type:", e);
        }
        return false;
      }
    }
  });
}
// --- End Authentication Middleware Definition ---

export class App {
  private app: OpenAPIHono

  constructor(routes: Routes[]) {
    this.app = new OpenAPIHono()

    this.initializeGlobalMiddlewares()
    this.initializeRoutes(routes)
    this.initializeSwaggerUI()
    this.initializeRouteFallback()
    this.initializeErrorHandler()
  }

  private initializeRoutes(routes: Routes[]) {
    // Create a single router where the auth middleware is applied to all routes
    const protectedApiRouter = new OpenAPIHono();
    protectedApiRouter.use('*/*', authMiddleware); // Apply auth middleware to all methods/paths within this router

    // Mount all controllers onto this protected router
    routes.forEach((route) => {
      route.initRoutes()
      console.log(`Mounting controller ${route.constructor.name} under protected /api`);
      protectedApiRouter.route('/', route.controller); // Mount controller routes relative to the protected router
    });

    // Mount the single protected router onto the main app at /api
    this.app.route('/api', protectedApiRouter); 

    // Mount the public Home route separately
    this.app.route('/', Home)
  }

  private initializeGlobalMiddlewares() {
    this.app.use(logger())
    this.app.use(prettyJSON())
    this.app.use(cors())
  }

  private initializeSwaggerUI() {
    this.app.doc31('/swagger', (c) => {
      const { protocol: urlProtocol, hostname, port } = new URL(c.req.url)
      const protocol = c.req.header('x-forwarded-proto') ? `${c.req.header('x-forwarded-proto')}:` : urlProtocol

      return {
        openapi: '3.1.0',

        info: {
          version: '1.0.0',
          title: 'JioSaavn API',
          description: `# Introduction 
        \nJioSaavn API, accessible at [saavn.dev](https://saavn.dev), is an unofficial API that allows users to download high-quality songs from [JioSaavn](https://jiosaavn.com). 
        It offers a fast, reliable, and easy-to-use API for developers. \n`
        },
        servers: [{ url: `${protocol}//${hostname}${port ? `:${port}` : ''}`, description: 'Current environment' }]
      }
    })

    this.app.get(
      '/docs',
      apiReference({
        pageTitle: 'JioSaavn API Documentation',
        theme: 'deepSpace',
        isEditable: false,
        layout: 'modern',
        darkMode: true,
        metaData: {
          applicationName: 'JioSaavn API',
          author: 'Sumit Kolhe',
          creator: 'Sumit Kolhe',
          publisher: 'Sumit Kolhe',
          robots: 'index, follow',
          description:
            'JioSaavn API is an unofficial wrapper written in TypeScript for jiosaavn.com providing programmatic access to a vast library of songs, albums, artists, playlists, and more.'
        },
        url: '/swagger'
      })
    )
  }

  private initializeRouteFallback() {
    this.app.notFound((ctx) => {
      return ctx.json({ success: false, message: 'route not found, check docs at https://saavn.dev/docs' }, 404)
    })
  }

  private initializeErrorHandler() {
    this.app.onError((err, ctx) => {
      const error = err as HTTPException
      return ctx.json({ success: false, message: error.message }, error.status || 500)
    })
  }

  public getApp() {
    return this.app
  }
}
