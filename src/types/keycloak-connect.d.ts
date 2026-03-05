declare module 'keycloak-connect' {
  import { RequestHandler } from 'express';

  interface KeycloakConfig {
    realm: string;
    'auth-server-url': string;
    'ssl-required'?: string;
    resource: string;
    'public-client'?: boolean;
    'confidential-port'?: number;
  }

  interface KeycloakOptions {
    store?: unknown;
  }

  class Keycloak {
    constructor(options: KeycloakOptions, config: KeycloakConfig);
    middleware(): RequestHandler;
    protect(role?: string): RequestHandler;
  }

  export = Keycloak;
}
