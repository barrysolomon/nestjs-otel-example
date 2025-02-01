import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Store the list of routes you want to exclude
let excludedRoutes: string[] = ['/health'];

@Injectable()
export class ExcludeRoutesMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check if the request URL matches any of the excluded routes
    if (excludedRoutes.includes(req.url)) {
      return next();  // Skip tracing logic for excluded routes
    }

    // Otherwise, proceed with tracing logic
    next();
  }
}

// Function to dynamically add routes to be excluded
export function addExcludedRoute(route: string) {
  excludedRoutes.push(route);
  console.log(`Added route to exclusion list: ${route}`);
}

