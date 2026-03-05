export interface KeycloakUser {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  enabled?: boolean;
  requiredActions?: string[];
  attributes?: Record<string, string[]>;
  federationLink?: string;
}
